import "server-only";

import {
  IntegrationPlatform,
  Prisma,
  SyncDirection,
  SyncStatus,
  SyncType,
  AlertSeverity,
  AlertType,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { getIntegrationConfig } from "./config";
import { katana } from "./katana";
import { resolveDefaultLocationId } from "./katana-location";
import { reverb, type ReverbOrder } from "./reverb";
import { isVoidedReverbOrder, pendingSalesByListing, placedBefore } from "./reverb-orders";
import { resolveByReverbListingId, resolveByReverbSku } from "./sku-resolver";
import { recordSyncLog, recordAlert, touchIntegrationLastSync } from "./sync-logger";

export interface SaleProcessResult {
  orderNumber: string;
  alreadyProcessed: boolean;
  writesEnabled: boolean;
  lines: Array<{
    reverbSku: string | null;
    reverbListingId: string | null;
    canonicalSku: string | null;
    quantity: number;
    action: "decremented" | "would-decrement" | "unmatched" | "skipped" | "failed";
    error?: string;
  }>;
}

/**
 * Records a Reverb sale against Katana by decrementing stock for each matched
 * line item. Idempotent on order number (webhook + polling may both deliver
 * the same order). With the Katana write flag off, runs as a dry run and logs
 * what would be decremented. Cancelled/refunded orders and orders placed
 * before automatic decrements went live are recorded but never decremented.
 */
export async function processReverbSale(
  order: ReverbOrder,
  source: "webhook" | "poll" = "webhook"
): Promise<SaleProcessResult> {
  const { flags } = getIntegrationConfig();
  // Master dry-run switch overrides the per-platform write flag.
  const writesEnabled = flags.katanaWritesEnabled && !flags.dryRun;

  console.log(
    `[ReverbSale] Processing order ${order.order_number} from ${source} (Katana writes ${writesEnabled ? "ENABLED" : "DISABLED - dry run"}${flags.dryRun ? ", SYNC_DRY_RUN on" : ""})`
  );

  const result: SaleProcessResult = {
    orderNumber: order.order_number,
    alreadyProcessed: false,
    writesEnabled,
    lines: [],
  };

  // Idempotency guard.
  const existing = await prisma.processedReverbOrder.findUnique({
    where: { orderNumber: order.order_number },
  });
  if (existing?.decrementApplied) {
    console.log(
      `[ReverbSale] Order ${order.order_number} already applied - skipping`
    );
    // Katana still has the guitar taken out. Whether it goes back in stock
    // depends on whether it shipped, so that call is left to a person.
    if (isVoidedReverbOrder(order.status)) {
      await recordAlert({
        type: AlertType.QUANTITY_MISMATCH,
        severity: AlertSeverity.WARNING,
        title: `Reverb order ${order.order_number} was ${order.status} after Katana was decremented`,
        message: `Katana stock was reduced for this order (${existing.katanaReference ?? "no reference"}). If the guitar did not ship, or came back, add it back to stock in Katana.`,
        relatedSku: order.sku ?? undefined,
        relatedPlatform: IntegrationPlatform.KATANA,
      });
    }
    result.alreadyProcessed = true;
    return result;
  }

  const liveSince = await resolveReverbOrdersLiveSince(writesEnabled);

  // Reverb sell-side orders are single-line. Match on product_id (the Reverb
  // listing id) first; fall back to the generated sku (rev-<product_id>).
  const listingId = order.product_id ? String(order.product_id) : null;
  const qty = order.quantity ?? 1;
  console.log(
    `[ReverbSale] Order ${order.order_number}: product_id=${listingId} sku=${order.sku} qty=${qty}`
  );

  const lineResult: SaleProcessResult["lines"][number] = {
    reverbSku: order.sku ?? null,
    reverbListingId: listingId,
    canonicalSku: null,
    quantity: qty,
    action: "unmatched",
  };

  let anyDecrement = false;
  let katanaReference: string | null = null;

  const skipReason = isVoidedReverbOrder(order.status)
    ? `order is ${order.status}, so nothing left stock`
    : liveSince && placedBefore(order, liveSince)
      ? `placed before automatic decrements started (${liveSince.toISOString()}), so it is entered in Katana by hand`
      : null;

  try {
    const mapping = skipReason
      ? null
      : listingId
        ? await resolveByReverbListingId(listingId)
        : order.sku
          ? await resolveByReverbSku(order.sku)
          : null;

    if (skipReason) {
      lineResult.action = "skipped";
      console.log(`[ReverbSale] Skipping order ${order.order_number}: ${skipReason}`);
      await recordSyncLog({
        syncType: SyncType.ORDER_SYNC,
        platform: IntegrationPlatform.REVERB,
        status: SyncStatus.SKIPPED,
        direction: SyncDirection.INBOUND,
        newValue: { orderNumber: order.order_number, listingId, sku: order.sku, qty, status: order.status },
        details: `Reverb order ${order.order_number} not decremented: ${skipReason}`,
      });
    } else if (!mapping || !mapping.katanaVariantId) {
      lineResult.action = "unmatched";
      console.warn(
        `[ReverbSale] Unmatched order ${order.order_number} (listing=${listingId} sku=${order.sku})`
      );
      await recordSyncLog({
        syncType: SyncType.ORDER_SYNC,
        platform: IntegrationPlatform.REVERB,
        status: SyncStatus.SKIPPED,
        direction: SyncDirection.INBOUND,
        inventoryItemId: mapping?.inventoryItemId ?? null,
        newValue: { orderNumber: order.order_number, listingId, sku: order.sku, qty },
        details: `No Katana variant mapping for Reverb order ${order.order_number}`,
      });
      await recordAlert({
        type: AlertType.QUANTITY_MISMATCH,
        severity: AlertSeverity.WARNING,
        title: `Unmatched Reverb sale on order ${order.order_number}`,
        message: `Sold item (listing=${listingId ?? "n/a"}, sku=${order.sku ?? "n/a"}) has no Katana mapping, so stock was not decremented.`,
        relatedSku: order.sku ?? undefined,
        relatedPlatform: IntegrationPlatform.REVERB,
      });
    } else {
      lineResult.canonicalSku = mapping.canonicalSku;
      const variantId = Number(mapping.katanaVariantId);

      if (!writesEnabled) {
        lineResult.action = "would-decrement";
        anyDecrement = true;
        console.log(
          `[ReverbSale] [dry-run] would DECREMENT Katana variant ${variantId} (${mapping.canonicalSku}) by ${qty}`
        );
        await recordSyncLog({
          syncType: SyncType.ORDER_SYNC,
          platform: IntegrationPlatform.KATANA,
          status: SyncStatus.SKIPPED,
          direction: SyncDirection.INBOUND,
          inventoryItemId: mapping.inventoryItemId,
          newValue: { decrementBy: qty, variantId, orderNumber: order.order_number },
          dryRun: true,
          details: `[dry-run] would decrement Katana variant ${variantId} by ${qty}`,
        });
      } else {
        const adjustment = await katana.createStockAdjustment({
          location_id: await resolveDefaultLocationId(),
          reason: "Reverb sale",
          additional_info: `Reverb order ${order.order_number}`,
          stock_adjustment_rows: [{ variant_id: variantId, quantity: -Math.abs(qty) }],
        });
        katanaReference = `stock_adjustment:${adjustment.id}`;
        lineResult.action = "decremented";
        anyDecrement = true;
        console.log(
          `[ReverbSale] DECREMENTED Katana variant ${variantId} (${mapping.canonicalSku}) by ${qty} via adjustment ${adjustment.id}`
        );
        await recordSyncLog({
          syncType: SyncType.ORDER_SYNC,
          platform: IntegrationPlatform.KATANA,
          status: SyncStatus.SUCCESS,
          direction: SyncDirection.INBOUND,
          inventoryItemId: mapping.inventoryItemId,
          newValue: {
            decrementBy: qty,
            variantId,
            orderNumber: order.order_number,
            katanaReference,
          },
          details: `Decremented Katana variant ${variantId} by ${qty} for Reverb order ${order.order_number}`,
        });
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    lineResult.action = "failed";
    lineResult.error = msg;
    console.error(`[ReverbSale] FAILED decrement for order ${order.order_number}:`, msg);
    await recordSyncLog({
      syncType: SyncType.ORDER_SYNC,
      platform: IntegrationPlatform.KATANA,
      status: SyncStatus.FAILED,
      direction: SyncDirection.INBOUND,
      newValue: { orderNumber: order.order_number, listingId, sku: order.sku, qty },
      errorMessage: msg,
      details: `Failed to decrement Katana for Reverb order ${order.order_number}`,
    });
    await recordAlert({
      type: AlertType.SYNC_FAILURE,
      severity: AlertSeverity.ERROR,
      title: `Failed to decrement Katana for Reverb order ${order.order_number}`,
      message: msg,
      relatedSku: order.sku ?? undefined,
      relatedPlatform: IntegrationPlatform.KATANA,
    });
  }

  result.lines.push(lineResult);

  // Persist idempotency record. Only mark as applied when a real write happened
  // so dry-run orders get re-processed once writes are enabled.
  const decrementApplied = writesEnabled && anyDecrement;
  await prisma.processedReverbOrder.upsert({
    where: { orderNumber: order.order_number },
    create: {
      orderNumber: order.order_number,
      source,
      status: order.status,
      decrementApplied,
      katanaReference,
      payload: order as unknown as object,
    },
    update: {
      status: order.status,
      decrementApplied: decrementApplied || existing?.decrementApplied || false,
      katanaReference: katanaReference ?? existing?.katanaReference ?? null,
      payload: order as unknown as object,
    },
  });

  await touchIntegrationLastSync(IntegrationPlatform.REVERB, true);

  return result;
}

/**
 * Polls Reverb for recent orders and processes any not yet seen. Used as a
 * reliability fallback alongside webhooks.
 */
export async function pollReverbOrders(opts: { sinceHours?: number } = {}) {
  const sinceHours = opts.sinceHours ?? 24;
  console.log(`[ReverbSale] Polling Reverb orders updated in the last ${sinceHours}h...`);

  const processed: SaleProcessResult[] = [];
  for (const order of await listReverbOrdersUpdatedSince(sinceHours)) {
    const res = await processReverbSale(order, "poll");
    if (!res.alreadyProcessed) processed.push(res);
  }

  console.log(`[ReverbSale] Poll complete - ${processed.length} new order(s) processed`);
  return processed;
}

/**
 * Every Reverb order touched in the last `sinceHours`. Reverb filters on
 * updated time, so this includes older orders whose status just changed;
 * processReverbSale decides which of those still need a decrement.
 */
export async function listReverbOrdersUpdatedSince(
  sinceHours: number
): Promise<ReverbOrder[]> {
  const updatedSince = new Date(
    Date.now() - sinceHours * 60 * 60 * 1000
  ).toISOString();

  const orders: ReverbOrder[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const response = await reverb.listOrders({ page, perPage: 50, updatedSince });
    totalPages = response.total_pages ?? 1;
    orders.push(...(response.orders ?? []));
    page++;
  } while (page <= totalPages);
  return orders;
}

async function readOrdersLiveSince(): Promise<{
  liveSince: Date | null;
  config: Prisma.JsonObject;
}> {
  const connection = await prisma.integrationConnection.findUnique({
    where: { platform: IntegrationPlatform.REVERB },
    select: { config: true },
  });
  const config = (connection?.config ?? {}) as Prisma.JsonObject;
  const stored =
    typeof config.ordersLiveSince === "string"
      ? new Date(config.ordersLiveSince)
      : null;
  return {
    liveSince: stored && !Number.isNaN(stored.getTime()) ? stored : null,
    config,
  };
}

/**
 * When automatic Katana decrements for Reverb sales began. Sales placed before
 * this were entered in Katana by hand while the sync ran dry, so decrementing
 * them again would count them twice. Stamped on the Reverb connection the
 * first time an order is processed with Katana writes on; null until then.
 */
export async function resolveReverbOrdersLiveSince(
  writesEnabled: boolean
): Promise<Date | null> {
  const { liveSince, config } = await readOrdersLiveSince();
  if (liveSince || !writesEnabled) return liveSince;

  const now = new Date();
  const nextConfig = { ...config, ordersLiveSince: now.toISOString() };
  await prisma.integrationConnection.upsert({
    where: { platform: IntegrationPlatform.REVERB },
    create: { platform: IntegrationPlatform.REVERB, name: "Reverb", config: nextConfig },
    update: { config: nextConfig },
  });
  console.log(
    `[ReverbSale] Automatic Katana decrements start ${now.toISOString()}; earlier Reverb sales stay as entered by hand`
  );
  return now;
}

/**
 * Recent Reverb sales not yet booked in Katana, per Reverb listing id, for the
 * inventory push to hold back (see pendingSalesByListing). Read-only: before
 * the first live order is processed, "now" stands in for the go-live stamp.
 */
export async function pendingReverbSalesByListing(
  sinceHours = 24
): Promise<Map<string, number>> {
  const { flags } = getIntegrationConfig();
  const writesEnabled = flags.katanaWritesEnabled && !flags.dryRun;

  const [orders, { liveSince: stored }] = await Promise.all([
    listReverbOrdersUpdatedSince(sinceHours),
    readOrdersLiveSince(),
  ]);
  if (orders.length === 0) return new Map();

  const applied = await prisma.processedReverbOrder.findMany({
    where: {
      orderNumber: { in: orders.map((o) => o.order_number) },
      decrementApplied: true,
    },
    select: { orderNumber: true },
  });

  return pendingSalesByListing(orders, {
    appliedOrderNumbers: new Set(applied.map((a) => a.orderNumber)),
    liveSince: stored ?? (writesEnabled ? new Date() : null),
  });
}
