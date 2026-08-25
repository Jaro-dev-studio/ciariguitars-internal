import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  IntegrationPlatform,
  SyncDirection,
  SyncStatus,
  SyncSource,
  SyncType,
} from "@prisma/client";
import { getIntegrationConfig } from "@/lib/integrations/config";
import { recordSyncLog } from "@/lib/integrations/sync-logger";
import { setSyncRunSummary, withSyncRun } from "@/lib/integrations/sync-run";
import { parseWorkOrder } from "@/lib/shopflow/contract";
import { processWorkOrder } from "@/lib/shopflow/process-work-order";

export const maxDuration = 60;

/** Rejects oversized bodies before parsing so the endpoint cannot be used to dump data. */
const MAX_BODY_BYTES = 512 * 1024;

/**
 * Headers Shop Flow might carry the shared secret in. Their format is not yet
 * agreed, so several conventions are accepted.
 */
const SECRET_HEADERS = [
  "x-shopflow-secret",
  "x-shopflow-signature",
  "x-webhook-secret",
];

function equals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Verifies the shared secret when one is configured.
 *
 * Enforcement is conditional on purpose: Shop Flow is already posting live
 * production data and has not yet been issued a secret, so hard-requiring one
 * today would silently drop real work orders. Setting SHOPFLOW_WEBHOOK_SECRET
 * turns enforcement on without a code change.
 */
function checkAuth(request: NextRequest): { ok: boolean; enforced: boolean } {
  const expected = getIntegrationConfig().shopflow.webhookSecret;
  if (!expected) return { ok: true, enforced: false };

  for (const header of SECRET_HEADERS) {
    const value = request.headers.get(header);
    if (value && equals(value, expected)) return { ok: true, enforced: true };
  }

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ") && equals(auth.slice(7), expected)) {
    return { ok: true, enforced: true };
  }

  return { ok: false, enforced: true };
}

/**
 * Receiver for Shop Flow completed work orders.
 *
 * The raw payload is always captured first, whatever its shape, so nothing is
 * lost if the contract drifts. Recognised work orders are then processed:
 * parts are resolved against Katana and, when everything maps and writes are
 * enabled, booked as a single stock adjustment.
 *
 * Answers 200 for anything it managed to capture, so a sender that retries on
 * error does not queue duplicates of a payload already stored.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = checkAuth(request);
    if (!auth.ok) {
      console.warn("[ShopFlowWebhook] Rejected request with invalid secret");
      return NextResponse.json(
        { data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }
    if (!auth.enforced) {
      console.warn(
        "[ShopFlowWebhook] SHOPFLOW_WEBHOOK_SECRET is not set - endpoint is accepting unauthenticated posts"
      );
    }

    const raw = await request.text();

    if (raw.length > MAX_BODY_BYTES) {
      console.warn(
        `[ShopFlowWebhook] Rejected oversized payload (${raw.length} bytes)`
      );
      return NextResponse.json(
        { data: null, error: "Payload too large" },
        { status: 413 }
      );
    }

    let payload: unknown;
    let isJson = true;
    try {
      payload = raw.length ? JSON.parse(raw) : {};
    } catch {
      isJson = false;
      payload = { raw };
    }

    const parsed = parseWorkOrder(payload);
    const label = parsed.data
      ? `invoice ${parsed.data.invoiceId} (${parsed.data.instrumentType}${parsed.data.serialNumber ? `, serial ${parsed.data.serialNumber}` : ""})`
      : "unrecognised payload";
    console.log(`[ShopFlowWebhook] Received ${label}`);

    const result = await withSyncRun(
      {
        source: SyncSource.WEBHOOK,
        trigger: "webhook:shopflow",
        triggeredBy: parsed.data ? "work-order.completed" : "unknown",
      },
      async () => {
        console.log("[ShopFlowWebhook] Recording raw event...");
        const log = await recordSyncLog({
          syncType: SyncType.INSTRUMENT_COMPLETED,
          platform: IntegrationPlatform.SHOPFLOW,
          status: SyncStatus.SUCCESS,
          direction: SyncDirection.INBOUND,
          newValue: payload as object,
          details: `Shop Flow work order received - ${label}`,
        });

        // Capturing the payload is the baseline job; a failed write must not be
        // reported as a successful run.
        if (!log) throw new Error("Shop Flow event could not be persisted");

        if (!parsed.data) {
          console.warn(
            `[ShopFlowWebhook] Payload not recognised as a work order: ${parsed.error}`
          );
          setSyncRunSummary({
            recorded: true,
            isJson,
            bytes: raw.length,
            processed: false,
            parseError: parsed.error,
          });
          return { eventId: log.id, processed: false as const };
        }

        // Processing must never lose the captured event, so failures here are
        // reported against the run rather than thrown away.
        try {
          console.log("[ShopFlowWebhook] Processing work order...");
          const processed = await processWorkOrder(parsed.data, payload);

          setSyncRunSummary({
            recorded: true,
            isJson,
            bytes: raw.length,
            processed: true,
            invoiceId: processed.invoiceId,
            isBuild: processed.isBuild,
            isRedelivery: processed.isRedelivery,
            deliveryCount: processed.deliveryCount,
            status: processed.status,
            partsResolved: processed.parts.resolved,
            partsUnresolved: processed.parts.unresolved,
            stockApplied: processed.stock.applied,
            ...(processed.stock.adjustmentId
              ? { stockAdjustmentId: processed.stock.adjustmentId }
              : {}),
          });

          return { eventId: log.id, processed: true as const, result: processed };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          console.error("[ShopFlowWebhook] Processing failed:", message);
          await recordSyncLog({
            syncType: SyncType.PRODUCTION_CONSUMPTION,
            platform: IntegrationPlatform.SHOPFLOW,
            status: SyncStatus.FAILED,
            direction: SyncDirection.INBOUND,
            newValue: { invoiceId: parsed.data.invoiceId },
            errorMessage: message,
            details: `Failed to process Shop Flow ${label}`,
          });
          setSyncRunSummary({
            recorded: true,
            isJson,
            bytes: raw.length,
            processed: false,
            processingError: message,
          });
          return { eventId: log.id, processed: false as const };
        }
      }
    );

    return NextResponse.json({
      data: {
        received: true,
        eventId: result.eventId,
        processed: result.processed,
        ...(result.processed
          ? {
            invoiceId: result.result.invoiceId,
            status: result.result.status,
            partsResolved: result.result.parts.resolved,
            partsUnresolved: result.result.parts.unresolved,
            stockApplied: result.result.stock.applied,
          }
          : {}),
      },
      error: null,
    });
  } catch (error) {
    console.error("[ShopFlowWebhook] Error handling webhook:", error);
    // Answer 200 so Shop Flow does not retry on a problem at our end; the
    // failure is captured on the run and in the logs.
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : "Webhook error",
      },
      { status: 200 }
    );
  }
}
