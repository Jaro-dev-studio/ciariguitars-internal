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
import { katana } from "./katana";
import { reverb, type ReverbOrder } from "./reverb";
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
    action: "decremented" | "would-decrement" | "unmatched" | "failed";
    error?: string;
  }>;
}

/**
 * Records a Reverb sale against Katana by decrementing stock for each matched
 * line item. Idempotent on order number (webhook + polling may both deliver
 * the same order). With the Katana write flag off, runs as a dry run and logs
 * what would be decremented.
 */
export async function processReverbSale(
  order: ReverbOrder,
  source: "webhook" | "poll" = "webhook"
): Promise<SaleProcessResult> {
  const { flags } = getIntegrationConfig();
  const writesEnabled = flags.katanaWritesEnabled;

  console.log(
    `[ReverbSale] Processing order ${order.order_number} from ${source} (Katana writes ${writesEnabled ? "ENABLED" : "DISABLED - dry run"})`
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
    result.alreadyProcessed = true;
    return result;
  }

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

  try {
    const mapping = listingId
      ? await resolveByReverbListingId(listingId)
      : order.sku
        ? await resolveByReverbSku(order.sku)
        : null;

    if (!mapping || !mapping.katanaVariantId) {
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
  const createdSince = new Date(
    Date.now() - sinceHours * 60 * 60 * 1000
  ).toISOString();

  console.log(`[ReverbSale] Polling Reverb orders since ${createdSince}...`);

  const processed: SaleProcessResult[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await reverb.listOrders({
      page,
      perPage: 50,
      createdSince,
    });
    totalPages = response.total_pages ?? 1;

    for (const order of response.orders ?? []) {
      const res = await processReverbSale(order, "poll");
      if (!res.alreadyProcessed) processed.push(res);
    }
    page++;
  } while (page <= totalPages);

  console.log(`[ReverbSale] Poll complete - ${processed.length} new order(s) processed`);
  return processed;
}

async function resolveDefaultLocationId(): Promise<number> {
  const fromEnv = process.env.KATANA_DEFAULT_LOCATION_ID;
  if (fromEnv && Number.isFinite(Number(fromEnv))) return Number(fromEnv);

  try {
    const locations = await katana.listLocations();
    if (locations[0]) return locations[0].id;
  } catch (err) {
    console.error("[ReverbSale] Could not resolve Katana location:", err);
  }
  throw new Error(
    "No Katana location available; set KATANA_DEFAULT_LOCATION_ID"
  );
}
