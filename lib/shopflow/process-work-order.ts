import "server-only";

import {
  IntegrationPlatform,
  ShopFlowWorkOrderStatus,
  SyncDirection,
  SyncStatus,
  SyncType,
} from "@prisma/client";

import prisma from "@/lib/prisma";
import { getIntegrationConfig } from "@/lib/integrations/config";
import { katana } from "@/lib/integrations/katana";
import { resolveDefaultLocationId } from "@/lib/integrations/katana-location";
import { recordSyncLog } from "@/lib/integrations/sync-logger";

import { parseWorkOrder, type ParsedWorkOrder } from "./contract";
import { resolveFinishedGood, type InstrumentResolution } from "./instrument-resolver";
import { calculateConsumptionDelta, type BookedPart } from "./part-matching";
import { resolveParts, type PartResolution } from "./part-resolver";

export interface WorkOrderProcessResult {
  invoiceId: string;
  isBuild: boolean;
  isRedelivery: boolean;
  deliveryCount: number;
  status: ShopFlowWorkOrderStatus;
  writesEnabled: boolean;
  parts: {
    resolved: number;
    unresolved: number;
    ignored: number;
    needsConfirmation: number;
    unresolvedIds: string[];
  };
  finishedGood: InstrumentResolution;
  stock: {
    applied: boolean;
    adjustmentId: string | null;
    rows: BookedPart[];
    skippedReason: string | null;
  };
}

function toBookedParts(resolution: PartResolution): BookedPart[] {
  return resolution.resolved.map((part) => ({
    partId: part.partId,
    katanaSku: part.katanaSku,
    variantId: part.variantId,
    quantity: part.quantity,
  }));
}

function readBookedParts(value: unknown): BookedPart[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.variantId !== "string" || typeof row.quantity !== "number") {
      return [];
    }
    return [
      {
        partId: String(row.partId ?? ""),
        katanaSku: String(row.katanaSku ?? ""),
        variantId: row.variantId,
        quantity: row.quantity,
      },
    ];
  });
}

/**
 * Books a completed Shop Flow work order against Katana.
 *
 * Three rules drive the behaviour:
 *
 * 1. Idempotency is keyed on the Shop Flow invoice id, which Shop Flow confirms
 *    is stable. A work order can be reopened and completed again, so a repeat
 *    delivery is treated as a revision - only the difference against what was
 *    already booked is applied.
 * 2. Only `InstrumentType: "build"` produces new stock. A repair is work on a
 *    guitar the customer already owns; its parts are consumed, but incrementing
 *    finished goods would put someone else's instrument up for sale.
 * 3. Nothing is booked while any part is unmapped or matched only tolerantly.
 *    A partial decrement is harder to reconcile than none at all, and the work
 *    order can be reprocessed once the mappings are filled in.
 */
export async function processWorkOrder(
  workOrder: ParsedWorkOrder,
  rawPayload: unknown
): Promise<WorkOrderProcessResult> {
  const { flags } = getIntegrationConfig();
  const writesEnabled = flags.katanaWritesEnabled && !flags.dryRun;

  console.log(
    `[ShopFlowWorkOrder] Processing invoice ${workOrder.invoiceId} (${workOrder.instrumentType}, Katana writes ${writesEnabled ? "ENABLED" : "DISABLED"})`
  );

  const existing = await prisma.shopFlowWorkOrder.findUnique({
    where: { invoiceId: workOrder.invoiceId },
  });
  const isRedelivery = Boolean(existing);
  const deliveryCount = (existing?.deliveryCount ?? 0) + 1;

  if (isRedelivery) {
    console.log(
      `[ShopFlowWorkOrder] Invoice ${workOrder.invoiceId} seen before - delivery #${deliveryCount}, applying as revision`
    );
  }

  console.log("[ShopFlowWorkOrder] Resolving consumed parts against Katana...");
  const resolution = await resolveParts(workOrder.consumableParts);
  const needsConfirmation = resolution.resolved.filter(
    (part) => part.needsConfirmation
  );

  console.log("[ShopFlowWorkOrder] Resolving the finished good...");
  const finishedGood: InstrumentResolution = workOrder.isBuild
    ? await resolveFinishedGood({
      model: workOrder.model,
      finish: workOrder.finish,
      orientation: workOrder.orientation,
    })
    : {
      sku: null,
      variantId: null,
      reason: "resolved",
      detail: "Repair - no finished good is produced",
    };

  const blockers: string[] = [];
  if (resolution.unresolved.length > 0) {
    blockers.push(
      `${resolution.unresolved.length} part(s) not mapped to Katana`
    );
  }
  if (needsConfirmation.length > 0) {
    blockers.push(
      `${needsConfirmation.length} part(s) matched only by revision-tolerant fallback and need confirming`
    );
  }

  let status: ShopFlowWorkOrderStatus;
  if (blockers.length > 0) status = ShopFlowWorkOrderStatus.NEEDS_MAPPING;
  else if (!workOrder.isBuild) status = ShopFlowWorkOrderStatus.REPAIR;
  else status = ShopFlowWorkOrderStatus.RESOLVED;

  // What this delivery says was consumed, less whatever is already booked.
  const currentParts = toBookedParts(resolution);
  const alreadyBooked = readBookedParts(existing?.bookedParts);
  const delta = calculateConsumptionDelta(alreadyBooked, currentParts);

  const stock: WorkOrderProcessResult["stock"] = {
    applied: false,
    adjustmentId: existing?.stockAdjustmentId ?? null,
    rows: delta,
    skippedReason: null,
  };

  if (blockers.length > 0) {
    stock.skippedReason = blockers.join("; ");
  } else if (delta.length === 0) {
    stock.skippedReason = isRedelivery
      ? "Redelivery with no change to the parts list"
      : "No resolvable parts to book";
  } else if (!writesEnabled) {
    stock.skippedReason = flags.dryRun
      ? "SYNC_DRY_RUN is on"
      : "Katana writes are disabled";
    console.log(
      `[ShopFlowWorkOrder] [dry-run] would adjust ${delta.length} Katana variant(s) for invoice ${workOrder.invoiceId}`
    );
  }

  const shouldWrite =
    writesEnabled && blockers.length === 0 && delta.length > 0;

  if (shouldWrite) {
    console.log(
      `[ShopFlowWorkOrder] Booking ${delta.length} stock adjustment row(s) for invoice ${workOrder.invoiceId}...`
    );
    // A single adjustment keeps the whole work order atomic in Katana and
    // leaves one reference to trace back to.
    const adjustment = await katana.createStockAdjustment({
      location_id: await resolveDefaultLocationId(),
      reason: workOrder.isBuild ? "Shop Flow build" : "Shop Flow repair",
      additional_info: `Shop Flow invoice ${workOrder.invoiceId}${workOrder.serialNumber ? ` (serial ${workOrder.serialNumber})` : ""}`,
      stock_adjustment_rows: delta.map((row) => ({
        variant_id: Number(row.variantId),
        // Consumption reduces stock; a revision that removed a part returns it.
        quantity: -row.quantity,
      })),
    });
    stock.applied = true;
    stock.adjustmentId = String(adjustment.id);
    status = ShopFlowWorkOrderStatus.BOOKED;
    console.log(
      `[ShopFlowWorkOrder] Booked adjustment ${adjustment.id} for invoice ${workOrder.invoiceId}`
    );
  }

  const resolutionSummary = {
    resolved: resolution.resolved.map((part) => ({
      partId: part.partId,
      katanaSku: part.katanaSku,
      quantity: part.quantity,
      strategy: part.strategy,
      matchedOn: part.matchedOn,
      needsConfirmation: part.needsConfirmation,
    })),
    unresolved: resolution.unresolved,
    ignored: resolution.ignored,
    finishedGood,
    delta,
    stock: {
      applied: stock.applied,
      adjustmentId: stock.adjustmentId,
      skippedReason: stock.skippedReason,
    },
  };

  // Only advance the booked baseline when a write actually landed, so a dry run
  // does not make the next delivery think the parts were already consumed.
  const bookedParts = stock.applied ? currentParts : alreadyBooked;

  await prisma.shopFlowWorkOrder.upsert({
    where: { invoiceId: workOrder.invoiceId },
    create: {
      invoiceId: workOrder.invoiceId,
      instrumentType: workOrder.instrumentType,
      serialNumber: workOrder.serialNumber,
      instrumentName: workOrder.instrumentName,
      model: workOrder.model,
      submodel: workOrder.submodel,
      finish: workOrder.finish,
      orientation: workOrder.orientation,
      resolvedSku: finishedGood.sku,
      status,
      blockedReason: blockers.length ? blockers.join("; ") : null,
      deliveryCount,
      bookedParts: bookedParts as unknown as object,
      bookedAt: stock.applied ? new Date() : null,
      stockAdjustmentId: stock.adjustmentId,
      resolutionSummary: resolutionSummary as unknown as object,
      lastPayload: rawPayload as object,
    },
    update: {
      instrumentType: workOrder.instrumentType,
      serialNumber: workOrder.serialNumber,
      instrumentName: workOrder.instrumentName,
      model: workOrder.model,
      submodel: workOrder.submodel,
      finish: workOrder.finish,
      orientation: workOrder.orientation,
      resolvedSku: finishedGood.sku,
      status,
      blockedReason: blockers.length ? blockers.join("; ") : null,
      deliveryCount,
      bookedParts: bookedParts as unknown as object,
      ...(stock.applied ? { bookedAt: new Date() } : {}),
      stockAdjustmentId: stock.adjustmentId,
      resolutionSummary: resolutionSummary as unknown as object,
      lastPayload: rawPayload as object,
      lastSeenAt: new Date(),
    },
  });

  await recordSyncLog({
    syncType: SyncType.PRODUCTION_CONSUMPTION,
    platform: IntegrationPlatform.SHOPFLOW,
    status:
      blockers.length > 0
        ? SyncStatus.PARTIAL
        : stock.applied
          ? SyncStatus.SUCCESS
          : SyncStatus.SKIPPED,
    direction: SyncDirection.INBOUND,
    dryRun: !writesEnabled,
    newValue: resolutionSummary,
    details: buildDetails(workOrder, resolution, stock, isRedelivery),
  });

  return {
    invoiceId: workOrder.invoiceId,
    isBuild: workOrder.isBuild,
    isRedelivery,
    deliveryCount,
    status,
    writesEnabled,
    parts: {
      resolved: resolution.resolved.length,
      unresolved: resolution.unresolved.length,
      ignored: resolution.ignored.length,
      needsConfirmation: needsConfirmation.length,
      unresolvedIds: resolution.unresolved.map((part) => part.partId),
    },
    finishedGood,
    stock,
  };
}

function buildDetails(
  workOrder: ParsedWorkOrder,
  resolution: PartResolution,
  stock: WorkOrderProcessResult["stock"],
  isRedelivery: boolean
): string {
  const parts = [
    `Shop Flow ${workOrder.isBuild ? "build" : "repair"} invoice ${workOrder.invoiceId}`,
  ];
  if (workOrder.serialNumber) parts.push(`serial ${workOrder.serialNumber}`);
  if (isRedelivery) parts.push("revision");
  parts.push(
    `${resolution.resolved.length} part(s) resolved, ${resolution.unresolved.length} unmapped`
  );
  if (stock.applied) parts.push(`booked as adjustment ${stock.adjustmentId}`);
  else if (stock.skippedReason) parts.push(`not booked: ${stock.skippedReason}`);
  return parts.join(" - ");
}

/**
 * Re-runs a stored work order after its part mappings have been filled in.
 * Without this a work order blocked on a missing mapping would stay blocked
 * until Shop Flow happened to resend it.
 */
export async function reprocessWorkOrder(
  invoiceId: string
): Promise<{ data: WorkOrderProcessResult | null; error: string | null }> {
  console.log(`[ShopFlowWorkOrder] Reprocessing invoice ${invoiceId}...`);

  const stored = await prisma.shopFlowWorkOrder.findUnique({
    where: { invoiceId },
    select: { lastPayload: true },
  });

  if (!stored?.lastPayload) {
    return { data: null, error: "No stored payload for this work order" };
  }

  const parsed = parseWorkOrder(stored.lastPayload);
  if (!parsed.data) return { data: null, error: parsed.error };

  const result = await processWorkOrder(parsed.data, stored.lastPayload);
  return { data: result, error: null };
}
