import "server-only";

import {
  IntegrationPlatform,
  SyncDirection,
  SyncStatus,
  SyncType,
  AlertSeverity,
  AlertType,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { getIntegrationConfig } from "./config";
import { katana, netAvailable, type KatanaInventory } from "./katana";
import { reverb, type ReverbListing } from "./reverb";
import { listSyncableItems } from "./sku-resolver";
import { recordSyncLog, recordAlert, clearAlerts, touchIntegrationLastSync } from "./sync-logger";

export interface ReverbSyncItemResult {
  canonicalSku: string;
  reverbSku: string | null;
  reverbListingId: string | null;
  previousQty: number | null;
  targetQty: number;
  action: "updated" | "unpublished" | "noop" | "skipped" | "failed" | "would-update" | "would-unpublish";
  dryRun: boolean;
  error?: string;
}

export interface ReverbSyncRunResult {
  startedAt: string;
  finishedAt: string;
  writesEnabled: boolean;
  totalConsidered: number;
  updated: number;
  unpublished: number;
  noop: number;
  skipped: number;
  failed: number;
  items: ReverbSyncItemResult[];
}

/**
 * Pushes Katana "available to sell" (in_stock - committed) quantities onto the
 * matching Reverb listings. When Katana availability hits 0 the Reverb listing
 * is unpublished (per client decision). All writes respect the Reverb feature
 * flag - with writes off, we run a full dry-run and log exactly what WOULD
 * happen without touching Reverb.
 */
export async function runKatanaToReverbSync(options: {
  locationIds?: number[];
  /** Override only specific canonical SKUs (used by webhooks). */
  onlyCanonicalSkus?: string[];
} = {}): Promise<ReverbSyncRunResult> {
  const startedAt = new Date();
  const { flags } = getIntegrationConfig();
  // Master dry-run switch overrides the per-platform write flag.
  const writesEnabled = flags.reverbWritesEnabled && !flags.dryRun;

  console.log(
    `[ReverbSync] Starting Katana -> Reverb sync (writes ${writesEnabled ? "ENABLED" : "DISABLED - dry run"}${flags.dryRun ? ", SYNC_DRY_RUN on" : ""})`
  );

  const result: ReverbSyncRunResult = {
    startedAt: startedAt.toISOString(),
    finishedAt: startedAt.toISOString(),
    writesEnabled,
    totalConsidered: 0,
    updated: 0,
    unpublished: 0,
    noop: 0,
    skipped: 0,
    failed: 0,
    items: [],
  };

  let syncable = await listSyncableItems();
  if (options.onlyCanonicalSkus?.length) {
    const set = new Set(options.onlyCanonicalSkus);
    syncable = syncable.filter((s) => set.has(s.canonicalSku));
  }
  result.totalConsidered = syncable.length;

  console.log(`[ReverbSync] Resolving inventory for ${syncable.length} mapped items...`);

  // Pull Katana inventory in one batch keyed by variant id.
  const variantIds = syncable
    .map((s) => Number(s.katanaVariantId))
    .filter((n) => Number.isFinite(n));

  let inventoryByVariant = new Map<number, KatanaInventory>();
  try {
    const inventory = await katana.getInventoryForVariants({
      variantIds,
      locationIds: options.locationIds,
      limit: 250,
    });
    inventoryByVariant = aggregateInventory(inventory);
    // Recovery: the batch fetch succeeded, so clear any prior fetch-failure alert.
    await clearAlerts({
      type: AlertType.CONNECTION_ERROR,
      relatedPlatform: IntegrationPlatform.KATANA,
      relatedSku: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[ReverbSync] Failed to fetch Katana inventory:", msg);
    await recordSyncLog({
      syncType: SyncType.INVENTORY_QUANTITY,
      platform: IntegrationPlatform.KATANA,
      status: SyncStatus.FAILED,
      direction: SyncDirection.INBOUND,
      errorMessage: msg,
      details: "Batch inventory fetch from Katana failed",
    });
    await recordAlert({
      type: AlertType.CONNECTION_ERROR,
      severity: AlertSeverity.ERROR,
      title: "Katana inventory fetch failed",
      message: msg,
      relatedPlatform: IntegrationPlatform.KATANA,
    });
    result.finishedAt = new Date().toISOString();
    return result;
  }

  for (const item of syncable) {
    const variantId = Number(item.katanaVariantId);
    const inv = inventoryByVariant.get(variantId);
    const targetQty = inv ? netAvailable(inv) : 0;

    const itemResult: ReverbSyncItemResult = {
      canonicalSku: item.canonicalSku,
      reverbSku: item.reverbSku,
      reverbListingId: item.reverbListingId,
      previousQty: null,
      targetQty,
      action: "skipped",
      dryRun: !writesEnabled,
    };

    try {
      const listing = await loadReverbListing(item.reverbListingId, item.reverbSku);
      if (!listing) {
        itemResult.action = "skipped";
        itemResult.error = "Reverb listing not found";
        result.skipped++;
        await recordSyncLog({
          syncType: SyncType.LISTING_UPDATE,
          platform: IntegrationPlatform.REVERB,
          status: SyncStatus.SKIPPED,
          direction: SyncDirection.OUTBOUND,
          inventoryItemId: item.inventoryItemId,
          errorMessage: "Reverb listing not found",
          details: `No Reverb listing for canonical SKU ${item.canonicalSku}`,
        });
        result.items.push(itemResult);
        continue;
      }

      itemResult.previousQty = listing.inventory ?? null;
      const shouldUnpublish = targetQty <= 0;
      const isLive = listing.state?.slug === "live";
      const currentQty = listing.inventory ?? 0;

      // Decide the action.
      if (shouldUnpublish) {
        if (!isLive && currentQty === 0) {
          itemResult.action = "noop";
          result.noop++;
        } else if (!writesEnabled) {
          itemResult.action = "would-unpublish";
          result.unpublished++;
          console.log(
            `[ReverbSync] [dry-run] would UNPUBLISH ${item.canonicalSku} (reverb ${listing.id}) qty ${currentQty} -> 0`
          );
        } else {
          await reverb.unpublishListing(listing);
          itemResult.action = "unpublished";
          result.unpublished++;
          console.log(
            `[ReverbSync] UNPUBLISHED ${item.canonicalSku} (reverb ${listing.id})`
          );
        }
      } else if (currentQty === targetQty && isLive) {
        itemResult.action = "noop";
        result.noop++;
      } else if (!writesEnabled) {
        itemResult.action = "would-update";
        result.updated++;
        console.log(
          `[ReverbSync] [dry-run] would UPDATE ${item.canonicalSku} (reverb ${listing.id}) qty ${currentQty} -> ${targetQty}`
        );
      } else {
        await reverb.updateListingInventory(listing, {
          inventory: targetQty,
          has_inventory: true,
          publish: true,
        });
        itemResult.action = "updated";
        result.updated++;
        console.log(
          `[ReverbSync] UPDATED ${item.canonicalSku} (reverb ${listing.id}) qty ${currentQty} -> ${targetQty}`
        );
      }

      await recordSyncLog({
        syncType:
          itemResult.action.includes("unpublish")
            ? SyncType.LISTING_UPDATE
            : SyncType.INVENTORY_QUANTITY,
        platform: IntegrationPlatform.REVERB,
        status:
          itemResult.action === "noop"
            ? SyncStatus.SKIPPED
            : writesEnabled
              ? SyncStatus.SUCCESS
              : SyncStatus.SKIPPED,
        direction: SyncDirection.OUTBOUND,
        inventoryItemId: item.inventoryItemId,
        previousValue: { inventory: currentQty, state: listing.state?.slug },
        newValue: { inventory: targetQty, action: itemResult.action },
        dryRun: !writesEnabled,
        details: writesEnabled
          ? `Reverb listing ${listing.id} ${itemResult.action}`
          : `[dry-run] Reverb listing ${listing.id} ${itemResult.action}`,
      });

      // Keep local cache fresh for the dashboard.
      await prisma.inventoryItem.update({
        where: { id: item.inventoryItemId },
        data: {
          katanaQty: inv ? Math.floor(parseFloat(inv.quantity_in_stock || "0")) : 0,
          reverbQty: targetQty,
          isReadyToShip: targetQty > 0,
          lastReverbSyncAt: writesEnabled ? new Date() : undefined,
          lastKatanaSyncAt: new Date(),
        },
      }).catch((e) => console.error("[ReverbSync] local cache update failed:", e));

      // Recovery: this SKU synced cleanly against Reverb, so clear any prior
      // failure alert for it. Only when writes are live, since the failure
      // alert is only ever recorded on a real (non-dry-run) write attempt.
      if (writesEnabled) {
        await clearAlerts({
          type: AlertType.SYNC_FAILURE,
          relatedPlatform: IntegrationPlatform.REVERB,
          relatedSku: item.canonicalSku,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      itemResult.action = "failed";
      itemResult.error = msg;
      result.failed++;
      console.error(`[ReverbSync] FAILED ${item.canonicalSku}:`, msg);
      await recordSyncLog({
        syncType: SyncType.INVENTORY_QUANTITY,
        platform: IntegrationPlatform.REVERB,
        status: SyncStatus.FAILED,
        direction: SyncDirection.OUTBOUND,
        inventoryItemId: item.inventoryItemId,
        newValue: { targetQty },
        errorMessage: msg,
        details: `Failed syncing canonical SKU ${item.canonicalSku} to Reverb`,
      });
      await recordAlert({
        type: AlertType.SYNC_FAILURE,
        severity: AlertSeverity.ERROR,
        title: `Reverb sync failed for ${item.canonicalSku}`,
        message: msg,
        relatedSku: item.canonicalSku,
        relatedPlatform: IntegrationPlatform.REVERB,
      });
    }

    result.items.push(itemResult);
  }

  await touchIntegrationLastSync(IntegrationPlatform.REVERB, true);

  result.finishedAt = new Date().toISOString();
  console.log(
    `[ReverbSync] Done. updated=${result.updated} unpublished=${result.unpublished} noop=${result.noop} skipped=${result.skipped} failed=${result.failed}`
  );
  return result;
}

// ============================================
// READ-ONLY PREVIEW (dry run)
// ============================================

export interface ReverbSyncPlanItem {
  canonicalSku: string;
  reverbTitle: string | null;
  reverbListingId: string | null;
  katanaVariantId: string | null;
  katanaProductId: string | null;
  currentReverbQty: number | null;
  currentState: string | null;
  targetQty: number;
  action: "update" | "unpublish" | "noop" | "skip";
  reason: string;
}

export interface ReverbSyncPlan {
  generatedAt: string;
  /** SYNC_DRY_RUN master flag state. */
  dryRunFlag: boolean;
  /** Effective: would a real "Apply" actually write to Reverb right now? */
  writesEnabled: boolean;
  totalConsidered: number;
  willUpdate: number;
  willUnpublish: number;
  noop: number;
  skipped: number;
  items: ReverbSyncPlanItem[];
}

/**
 * Computes EXACTLY what runKatanaToReverbSync would do, without writing
 * anything (no Reverb calls, no sync logs, no local cache updates). Used to
 * power the dry-run preview UI so the team can review changes before enabling
 * real writes.
 */
export async function previewKatanaToReverbSync(options: {
  locationIds?: number[];
  onlyCanonicalSkus?: string[];
} = {}): Promise<ReverbSyncPlan> {
  const { flags } = getIntegrationConfig();
  const writesEnabled = flags.reverbWritesEnabled && !flags.dryRun;

  console.log("[ReverbSync] Building dry-run preview (read-only)...");

  const plan: ReverbSyncPlan = {
    generatedAt: new Date().toISOString(),
    dryRunFlag: flags.dryRun,
    writesEnabled,
    totalConsidered: 0,
    willUpdate: 0,
    willUnpublish: 0,
    noop: 0,
    skipped: 0,
    items: [],
  };

  let syncable = await listSyncableItems();
  if (options.onlyCanonicalSkus?.length) {
    const set = new Set(options.onlyCanonicalSkus);
    syncable = syncable.filter((s) => set.has(s.canonicalSku));
  }
  plan.totalConsidered = syncable.length;

  const variantIds = syncable
    .map((s) => Number(s.katanaVariantId))
    .filter((n) => Number.isFinite(n));

  let inventoryByVariant = new Map<number, KatanaInventory>();
  try {
    const inventory = await katana.getInventoryForVariants({
      variantIds,
      locationIds: options.locationIds,
      limit: 250,
    });
    inventoryByVariant = aggregateInventory(inventory);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[ReverbSync] Preview inventory fetch failed:", msg);
    throw new Error(`Could not fetch Katana inventory: ${msg}`);
  }

  // Resolve Katana productId per variant (for deep links) from the staging catalog.
  const katanaVariantIds = syncable
    .map((s) => s.katanaVariantId)
    .filter((id): id is string => Boolean(id));
  const productIdByVariantId = new Map<string, string | null>();
  if (katanaVariantIds.length) {
    const staged = await prisma.katanaCatalogVariant.findMany({
      where: { variantId: { in: katanaVariantIds } },
      select: { variantId: true, productId: true },
    });
    for (const s of staged) productIdByVariantId.set(s.variantId, s.productId);
  }

  for (const item of syncable) {
    const variantId = Number(item.katanaVariantId);
    const inv = inventoryByVariant.get(variantId);
    const targetQty = inv ? netAvailable(inv) : 0;

    const planItem: ReverbSyncPlanItem = {
      canonicalSku: item.canonicalSku,
      reverbTitle: null,
      reverbListingId: item.reverbListingId,
      katanaVariantId: item.katanaVariantId,
      katanaProductId: item.katanaVariantId
        ? productIdByVariantId.get(item.katanaVariantId) ?? null
        : null,
      currentReverbQty: null,
      currentState: null,
      targetQty,
      action: "skip",
      reason: "",
    };

    try {
      const listing = await loadReverbListing(item.reverbListingId, item.reverbSku);
      if (!listing) {
        planItem.action = "skip";
        planItem.reason = "Reverb listing not found";
        plan.skipped++;
        plan.items.push(planItem);
        continue;
      }

      planItem.reverbTitle = listing.title ?? null;
      planItem.currentReverbQty = listing.inventory ?? null;
      planItem.currentState = listing.state?.slug ?? null;

      const currentQty = listing.inventory ?? 0;
      const isLive = listing.state?.slug === "live";
      const shouldUnpublish = targetQty <= 0;

      if (shouldUnpublish) {
        if (!isLive && currentQty === 0) {
          planItem.action = "noop";
          planItem.reason = "Already at 0 and not live";
          plan.noop++;
        } else {
          planItem.action = "unpublish";
          planItem.reason = `Katana net-available is 0 - would unpublish (qty ${currentQty} -> 0)`;
          plan.willUnpublish++;
        }
      } else if (currentQty === targetQty && isLive) {
        planItem.action = "noop";
        planItem.reason = "Quantities already match";
        plan.noop++;
      } else {
        planItem.action = "update";
        planItem.reason = `Would set Reverb qty ${currentQty} -> ${targetQty}${isLive ? "" : " and publish"}`;
        plan.willUpdate++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      planItem.action = "skip";
      planItem.reason = `Could not read Reverb listing: ${msg}`;
      plan.skipped++;
    }

    plan.items.push(planItem);
  }

  console.log(
    `[ReverbSync] Preview ready: update=${plan.willUpdate} unpublish=${plan.willUnpublish} noop=${plan.noop} skip=${plan.skipped}`
  );
  return plan;
}

// ============================================
// READ-ONLY SNAPSHOT REFRESH (no writes to either platform)
// ============================================

export interface InventorySnapshotResult {
  refreshedAt: string;
  total: number;
  updated: number;
  failed: number;
}

/**
 * Pulls the CURRENT quantities from both platforms and refreshes the local
 * cache so the Inventory Sync table reflects reality: Katana net-available
 * (in stock - committed) and the live Reverb listing inventory. This never
 * writes to Katana or Reverb - it only updates our own InventoryItem rows.
 */
export async function refreshInventorySnapshot(options: {
  locationIds?: number[];
} = {}): Promise<InventorySnapshotResult> {
  console.log("[InventorySnapshot] Refreshing live Katana + Reverb quantities (read-only)...");

  const syncable = await listSyncableItems();
  const result: InventorySnapshotResult = {
    refreshedAt: new Date().toISOString(),
    total: syncable.length,
    updated: 0,
    failed: 0,
  };

  console.log(`[InventorySnapshot] Fetching Katana inventory for ${syncable.length} mapped items...`);
  const variantIds = syncable
    .map((s) => Number(s.katanaVariantId))
    .filter((n) => Number.isFinite(n));

  let inventoryByVariant = new Map<number, KatanaInventory>();
  try {
    const inventory = await katana.getInventoryForVariants({
      variantIds,
      locationIds: options.locationIds,
      limit: 250,
    });
    inventoryByVariant = aggregateInventory(inventory);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[InventorySnapshot] Katana inventory fetch failed:", msg);
    throw new Error(`Could not fetch Katana inventory: ${msg}`);
  }

  console.log("[InventorySnapshot] Reading current Reverb listing quantities...");
  for (const item of syncable) {
    try {
      const variantId = Number(item.katanaVariantId);
      const inv = inventoryByVariant.get(variantId);
      const katanaNet = inv ? netAvailable(inv) : 0;

      const listing = await loadReverbListing(item.reverbListingId, item.reverbSku);
      const reverbQty = listing?.inventory ?? 0;

      await prisma.inventoryItem.update({
        where: { id: item.inventoryItemId },
        data: {
          katanaQty: katanaNet,
          reverbQty,
          isReadyToShip: katanaNet > 0,
        },
      });
      result.updated++;
    } catch (err) {
      result.failed++;
      console.error(
        `[InventorySnapshot] Failed to refresh ${item.canonicalSku}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  console.log(
    `[InventorySnapshot] Done. updated=${result.updated} failed=${result.failed}`
  );
  return result;
}

async function loadReverbListing(
  listingId: string | null,
  reverbSku: string | null
): Promise<ReverbListing | null> {
  if (listingId) {
    try {
      return await reverb.getListingByHref(`/listings/${listingId}`);
    } catch (err) {
      console.warn(
        `[ReverbSync] direct listing fetch failed for ${listingId}, falling back to SKU lookup`
      );
    }
  }
  if (reverbSku) {
    return reverb.findListingBySku(reverbSku, "all");
  }
  return null;
}

/** Sum stock across locations per variant so multi-location items net correctly. */
function aggregateInventory(
  rows: KatanaInventory[]
): Map<number, KatanaInventory> {
  const byVariant = new Map<number, KatanaInventory>();
  for (const row of rows) {
    const existing = byVariant.get(row.variant_id);
    if (!existing) {
      byVariant.set(row.variant_id, { ...row });
      continue;
    }
    existing.quantity_in_stock = String(
      parseFloat(existing.quantity_in_stock || "0") +
        parseFloat(row.quantity_in_stock || "0")
    );
    existing.quantity_committed = String(
      parseFloat(existing.quantity_committed || "0") +
        parseFloat(row.quantity_committed || "0")
    );
  }
  return byVariant;
}
