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
import { IntegrationError } from "./config";
import { katana, netAvailable, type KatanaInventory } from "./katana";
import { isOneOffListing, planListingChange, type ListingChange } from "./listing-change";
import { carriesSku, mappingDriftReason } from "./mapping-guard";
import { reverb, type ReverbListing } from "./reverb";
import { isReverbLinkLive } from "./reverb-link";
import { pendingReverbSalesByListing } from "./sale-handler";
import { katanaCatalogSkus, listSyncableItems } from "./sku-resolver";
import { recordSyncLog, recordAlert, clearAlerts, touchIntegrationLastSync } from "./sync-logger";

export interface ReverbSyncItemResult {
  canonicalSku: string;
  reverbSku: string | null;
  reverbListingId: string | null;
  previousQty: number | null;
  targetQty: number;
  action: "updated" | "unpublished" | "noop" | "skipped" | "failed" | "would-update" | "would-unpublish";
  dryRun: boolean;
  /** A one-off listing: "unpublished" means ended, "updated" means published. */
  oneOff?: boolean;
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
 * matching Reverb listings, minus any Reverb sales not booked in Katana yet.
 * When availability hits 0 the Reverb listing is unpublished (per client
 * decision), or ended if it is a one-off. What happens to each listing is
 * decided by planListingChange. Writes only happen while the Reverb link is
 * switched on - with it off, we run a full dry-run and log exactly what WOULD
 * happen without touching Reverb.
 */
export async function runKatanaToReverbSync(options: {
  locationIds?: number[];
  /** Override only specific canonical SKUs (used by webhooks). */
  onlyCanonicalSkus?: string[];
} = {}): Promise<ReverbSyncRunResult> {
  const startedAt = new Date();
  const writesEnabled = await isReverbLinkLive();

  console.log(
    `[ReverbSync] Starting Katana -> Reverb sync (writes ${writesEnabled ? "ENABLED" : "DISABLED - dry run, Reverb link switched off"})`
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

  // Read unbooked Reverb sales BEFORE Katana: a decrement landing in between
  // is then held back for one extra run instead of missed, which would put
  // the sold guitar back on sale.
  let pendingByListing = new Map<string, number>();
  try {
    pendingByListing = await pendingReverbSalesByListing();
    await clearAlerts({
      type: AlertType.CONNECTION_ERROR,
      relatedPlatform: IntegrationPlatform.REVERB,
      relatedSku: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[ReverbSync] Failed to read recent Reverb orders:", msg);
    await recordSyncLog({
      syncType: SyncType.ORDER_SYNC,
      platform: IntegrationPlatform.REVERB,
      status: SyncStatus.FAILED,
      direction: SyncDirection.INBOUND,
      errorMessage: msg,
      details: "Could not read recent Reverb orders; push skipped so a sold guitar is not relisted",
    });
    await recordAlert({
      type: AlertType.CONNECTION_ERROR,
      severity: AlertSeverity.ERROR,
      title: "Reverb order fetch failed",
      message: msg,
      relatedPlatform: IntegrationPlatform.REVERB,
    });
    result.finishedAt = new Date().toISOString();
    return result;
  }

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

  const katanaSkuByVariant = await katanaCatalogSkus(
    syncable.map((s) => s.katanaVariantId).filter((id): id is string => Boolean(id))
  );

  for (const item of syncable) {
    const variantId = Number(item.katanaVariantId);
    const inv = inventoryByVariant.get(variantId);
    const katanaQty = inv ? netAvailable(inv) : 0;
    const heldBack = heldBackFor(item.reverbListingId, pendingByListing);
    const targetQty = Math.max(0, katanaQty - heldBack);

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
      const currentQty = listing.inventory ?? 0;

      const drift = mappingDriftReason({
        canonicalSku: item.canonicalSku,
        katanaSku: item.katanaVariantId ? katanaSkuByVariant.get(item.katanaVariantId) : null,
        reverbSku: listing.sku,
      });
      if (drift) {
        itemResult.action = "skipped";
        itemResult.error = drift;
        result.skipped++;
        console.warn(`[ReverbSync] SKIPPED ${item.canonicalSku} (reverb ${listing.id}): ${drift}`);
        await recordSyncLog({
          syncType: SyncType.LISTING_UPDATE,
          platform: IntegrationPlatform.REVERB,
          status: SyncStatus.SKIPPED,
          direction: SyncDirection.OUTBOUND,
          inventoryItemId: item.inventoryItemId,
          previousValue: { inventory: currentQty, state: listing.state?.slug, sku: listing.sku },
          errorMessage: drift,
          dryRun: !writesEnabled,
          details: `Reverb listing ${listing.id} left alone: ${drift}`,
        });
        await recordAlert({
          type: AlertType.QUANTITY_MISMATCH,
          severity: AlertSeverity.WARNING,
          title: `Reverb listing for ${item.canonicalSku} is not being synced`,
          message: `${drift}. Re-link Reverb listing ${listing.id} on the SKU Mapping page; until then its quantity is not kept in line with Katana.`,
          relatedSku: item.canonicalSku,
          relatedPlatform: IntegrationPlatform.REVERB,
        });
        result.items.push(itemResult);
        continue;
      }

      const oneOff = isOneOffListing({ hasInventory: listing.has_inventory });
      itemResult.oneOff = oneOff || undefined;
      const change = planListingChange(
        {
          state: listing.state?.slug ?? null,
          inventory: listing.inventory,
          hasInventory: listing.has_inventory,
          carriesKatanaSku: carriesSku(listing.sku, item.canonicalSku),
        },
        targetQty
      );

      // Act on it. With the Reverb link off, nothing is written.
      switch (change.kind) {
        case "noop":
          itemResult.action = "noop";
          result.noop++;
          break;
        case "leave":
          itemResult.action = "skipped";
          itemResult.error = change.note;
          result.skipped++;
          console.log(
            `[ReverbSync] LEFT ALONE ${item.canonicalSku} (reverb ${listing.id}): ${change.note}`
          );
          break;
        case "unpublish":
        case "end":
          if (writesEnabled) {
            if (change.kind === "end") await reverb.endListing(listing);
            else await reverb.unpublishListing(listing);
          }
          itemResult.action = writesEnabled ? "unpublished" : "would-unpublish";
          result.unpublished++;
          console.log(
            `[ReverbSync] ${writesEnabled ? "" : "[dry-run] would "}${change.kind === "end" ? "END one-off" : "UNPUBLISH"} ${item.canonicalSku} (reverb ${listing.id}) qty ${currentQty} -> 0`
          );
          break;
        case "set-quantity":
        case "publish":
          if (writesEnabled) {
            if (change.kind === "publish") {
              await reverb.publishListing(listing);
            } else {
              await reverb.updateListingInventory(listing, {
                inventory: targetQty,
                has_inventory: true,
                publish: true,
              });
            }
          }
          itemResult.action = writesEnabled ? "updated" : "would-update";
          result.updated++;
          console.log(
            change.kind === "publish"
              ? `[ReverbSync] ${writesEnabled ? "" : "[dry-run] would "}PUBLISH one-off ${item.canonicalSku} (reverb ${listing.id})`
              : `[ReverbSync] ${writesEnabled ? "" : "[dry-run] would "}UPDATE ${item.canonicalSku} (reverb ${listing.id}) qty ${currentQty} -> ${targetQty}`
          );
          break;
      }

      // What the listing shows once this run is done. A one-off holds one
      // guitar while it is up, whatever Katana counts.
      const reverbQtyAfter = reverbQtyAfterChange(change, currentQty, targetQty);
      const wrote = writesEnabled && change.kind !== "noop" && change.kind !== "leave";

      await recordSyncLog({
        syncType:
          change.kind === "set-quantity" || change.kind === "noop"
            ? SyncType.INVENTORY_QUANTITY
            : SyncType.LISTING_UPDATE,
        platform: IntegrationPlatform.REVERB,
        status: wrote ? SyncStatus.SUCCESS : SyncStatus.SKIPPED,
        direction: SyncDirection.OUTBOUND,
        inventoryItemId: item.inventoryItemId,
        previousValue: { inventory: currentQty, state: listing.state?.slug },
        newValue: {
          inventory: reverbQtyAfter,
          action: itemResult.action,
          ...(oneOff ? { oneOff: true, availableInKatana: targetQty } : {}),
          ...(heldBack > 0 ? { katanaQty, heldBackForReverbSales: heldBack } : {}),
        },
        errorMessage: change.kind === "leave" ? change.note : undefined,
        dryRun: !writesEnabled,
        details: `${writesEnabled ? "" : "[dry-run] "}Reverb listing ${listing.id} ${describeChange(change, itemResult.action, writesEnabled)}`,
      });

      // Keep local cache fresh for the dashboard. Same numbers as the manual
      // refresh: Katana net available, and what Reverb shows after this run
      // (unchanged in a dry run).
      await prisma.inventoryItem.update({
        where: { id: item.inventoryItemId },
        data: {
          katanaQty,
          reverbQty: writesEnabled ? reverbQtyAfter : currentQty,
          isReadyToShip: targetQty > 0,
          lastReverbSyncAt: writesEnabled ? new Date() : undefined,
          lastKatanaSyncAt: new Date(),
        },
      }).catch((e) => console.error("[ReverbSync] local cache update failed:", e));

      // Recovery: this SKU resolved and synced cleanly against Reverb, so clear
      // any prior failure alert for it. This runs in dry runs too, because the
      // failure alert is also raised when merely *reading* the listing fails -
      // otherwise a one-off Reverb error would leave an alert up until the
      // retention cron eventually pruned it.
      await clearAlerts({
        type: AlertType.SYNC_FAILURE,
        relatedPlatform: IntegrationPlatform.REVERB,
        relatedSku: item.canonicalSku,
      });
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
  /** A one-off listing: "unpublish" ends it, "update" publishes it. */
  oneOff: boolean;
  reason: string;
}

export interface ReverbSyncPlan {
  generatedAt: string;
  /** Would a real "Apply" write to Reverb right now (Reverb link switched on)? */
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
  const writesEnabled = await isReverbLinkLive();

  console.log("[ReverbSync] Building dry-run preview (read-only)...");

  const plan: ReverbSyncPlan = {
    generatedAt: new Date().toISOString(),
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

  // Same order as the real run: Reverb sales first, then Katana.
  let pendingByListing = new Map<string, number>();
  try {
    pendingByListing = await pendingReverbSalesByListing();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[ReverbSync] Preview order fetch failed:", msg);
    throw new Error(`Could not read recent Reverb orders: ${msg}`);
  }

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

  // Resolve Katana productId (for deep links) and current SKU per variant from
  // the staging catalog.
  const katanaVariantIds = syncable
    .map((s) => s.katanaVariantId)
    .filter((id): id is string => Boolean(id));
  const productIdByVariantId = new Map<string, string | null>();
  const katanaSkuByVariant = new Map<string, string | null>();
  if (katanaVariantIds.length) {
    const staged = await prisma.katanaCatalogVariant.findMany({
      where: { variantId: { in: katanaVariantIds } },
      select: { variantId: true, productId: true, sku: true },
    });
    for (const s of staged) {
      productIdByVariantId.set(s.variantId, s.productId);
      katanaSkuByVariant.set(s.variantId, s.sku);
    }
  }

  for (const item of syncable) {
    const variantId = Number(item.katanaVariantId);
    const inv = inventoryByVariant.get(variantId);
    const heldBack = heldBackFor(item.reverbListingId, pendingByListing);
    const targetQty = Math.max(0, (inv ? netAvailable(inv) : 0) - heldBack);
    const heldBackNote =
      heldBack > 0 ? ` (holding back ${heldBack} sold on Reverb, not yet in Katana)` : "";
    // So a surprising number can be checked against Katana's own screens.
    const stockNote = ` - Katana: ${describeKatanaStock(inv)}${heldBackNote}`;

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
      oneOff: false,
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
      planItem.oneOff = isOneOffListing({ hasInventory: listing.has_inventory });

      const currentQty = listing.inventory ?? 0;
      const isLive = listing.state?.slug === "live";
      const drift = mappingDriftReason({
        canonicalSku: item.canonicalSku,
        katanaSku: item.katanaVariantId ? katanaSkuByVariant.get(item.katanaVariantId) : null,
        reverbSku: listing.sku,
      });

      if (drift) {
        planItem.action = "skip";
        planItem.reason = `${drift} - left alone until it is re-linked`;
        plan.skipped++;
      } else {
        const change = planListingChange(
          {
            state: listing.state?.slug ?? null,
            inventory: listing.inventory,
            hasInventory: listing.has_inventory,
            carriesKatanaSku: carriesSku(listing.sku, item.canonicalSku),
          },
          targetQty
        );
        switch (change.kind) {
          case "noop":
            planItem.action = "noop";
            planItem.reason =
              planItem.oneOff || targetQty > 0 ? `${change.note}${stockNote}` : change.note;
            plan.noop++;
            break;
          case "leave":
            planItem.action = "skip";
            planItem.reason = `${change.note}${stockNote}`;
            plan.skipped++;
            break;
          case "unpublish":
            planItem.action = "unpublish";
            planItem.reason = isLive
              ? `Nothing available - would unpublish (qty ${currentQty} -> 0)${stockNote}`
              : `Nothing available - would set qty ${currentQty} -> 0 (listing is not live)${stockNote}`;
            plan.willUnpublish++;
            break;
          case "end":
            planItem.action = "unpublish";
            planItem.reason = `Nothing available - would end this one-off listing${stockNote}`;
            plan.willUnpublish++;
            break;
          case "set-quantity":
            planItem.action = "update";
            planItem.reason = `Would set Reverb qty ${currentQty} -> ${targetQty}${isLive ? "" : " and publish"}${stockNote}`;
            plan.willUpdate++;
            break;
          case "publish":
            planItem.action = "update";
            planItem.reason = `One-off draft - would publish it${stockNote}`;
            plan.willUpdate++;
            break;
        }
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
      const msg = err instanceof Error ? err.message : String(err);
      // Only a missing listing (stale mapping) justifies the SKU search. Any
      // other failure - auth, rate limit, Reverb outage - would fail the same
      // way on the fallback and just obscures the real error message.
      const isMissing = err instanceof IntegrationError && err.status === 404;
      if (!isMissing) {
        console.error(`[ReverbSync] listing fetch failed for ${listingId}: ${msg}`);
        throw err;
      }
      console.warn(
        `[ReverbSync] listing ${listingId} not found on Reverb (${msg}), falling back to SKU lookup`
      );
    }
  }
  if (reverbSku) {
    return reverb.findListingBySku(reverbSku, "all");
  }
  return null;
}

/** The quantity a listing shows once a change is made. */
function reverbQtyAfterChange(
  change: ListingChange,
  currentQty: number,
  targetQty: number
): number {
  switch (change.kind) {
    case "set-quantity":
      return targetQty;
    case "unpublish":
    case "end":
      return 0;
    case "publish":
      return 1;
    default:
      return currentQty;
  }
}

/** The sync log's wording for a change: one-offs are ended and published. */
function describeChange(
  change: ListingChange,
  action: ReverbSyncItemResult["action"],
  writesEnabled: boolean
): string {
  switch (change.kind) {
    case "end":
      return writesEnabled ? "ended (one-off)" : "would end (one-off)";
    case "publish":
      return writesEnabled ? "published (one-off)" : "would publish (one-off)";
    case "leave":
      return `left alone: ${change.note}`;
    default:
      return action;
  }
}

/** "2 in stock, 1 committed" across all locations, or why there is nothing. */
function describeKatanaStock(inv: KatanaInventory | undefined): string {
  if (!inv) return "no stock record for this item";
  const inStock = parseFloat(inv.quantity_in_stock || "0");
  const committed = parseFloat(inv.quantity_committed || "0");
  return `${inStock} in stock, ${committed} committed`;
}

function heldBackFor(
  reverbListingId: string | null,
  pendingByListing: Map<string, number>
): number {
  return reverbListingId ? pendingByListing.get(reverbListingId) ?? 0 : 0;
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
