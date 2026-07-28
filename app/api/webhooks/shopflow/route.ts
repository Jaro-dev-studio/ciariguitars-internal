import { NextRequest, NextResponse } from "next/server";
import {
  IntegrationPlatform,
  SyncDirection,
  SyncStatus,
  SyncSource,
  SyncType,
} from "@prisma/client";
import { recordSyncLog } from "@/lib/integrations/sync-logger";
import { setSyncRunSummary, withSyncRun } from "@/lib/integrations/sync-run";

export const maxDuration = 30;

/** Rejects oversized bodies before parsing so the endpoint cannot be used to dump data. */
const MAX_BODY_BYTES = 256 * 1024;

/**
 * Keys Shop Flow might use to identify the finished instrument. Checked in
 * order and case-insensitively so the endpoint stays useful whatever shape the
 * payload arrives in.
 */
const IDENTIFIER_KEYS = [
  "serialNumber",
  "serial",
  "instrumentId",
  "instrument",
  "sku",
  "model",
  "orderNumber",
  "orderId",
  "workOrder",
  "id",
];

/**
 * Pulls the first recognisable identifier out of an arbitrary payload. Used to
 * build a human-readable summary line, which is also what the sync events
 * search box matches against.
 */
function findIdentifiers(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];

  const flat = new Map<string, string>();
  const visit = (value: unknown, depth: number) => {
    if (depth > 3 || !value || typeof value !== "object") return;
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry === null || entry === undefined) continue;
      if (typeof entry === "object") {
        visit(entry, depth + 1);
        continue;
      }
      const normalised = key.toLowerCase().replace(/[_-]/g, "");
      if (!flat.has(normalised)) flat.set(normalised, String(entry));
    }
  };
  visit(payload, 0);

  return IDENTIFIER_KEYS.reduce<string[]>((found, key) => {
    const value = flat.get(key.toLowerCase());
    if (value && found.length < 3) found.push(`${key}=${value}`);
    return found;
  }, []);
}

/**
 * Public receiver for Shop Flow "instrument completed" notifications.
 *
 * Deliberately unauthenticated and schema-agnostic: Shop Flow can POST any JSON
 * shape and it is stored verbatim as an informational sync event. Nothing here
 * writes to Katana or Reverb - it exists so the team can see what Shop Flow is
 * sending while the integration is specced out.
 *
 * Always answers 200, including for malformed bodies, so a sender that retries
 * on error does not queue up duplicates over a payload we already captured.
 */
export async function POST(request: NextRequest) {
  try {
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

    // Any shape is acceptable. Non-JSON bodies are kept verbatim rather than
    // dropped, so nothing Shop Flow sends is ever lost.
    let payload: unknown;
    let isJson = true;
    try {
      payload = raw.length ? JSON.parse(raw) : {};
    } catch {
      isJson = false;
      payload = { raw };
    }

    const identifiers = findIdentifiers(payload);
    console.log(
      `[ShopFlowWebhook] Received completion event${identifiers.length ? ` (${identifiers.join(", ")})` : ""}`
    );

    const result = await withSyncRun(
      {
        source: SyncSource.WEBHOOK,
        trigger: "webhook:shopflow",
        triggeredBy: "instrument.completed",
      },
      async () => {
        console.log("[ShopFlowWebhook] Recording completion event...");
        const log = await recordSyncLog({
          syncType: SyncType.INSTRUMENT_COMPLETED,
          platform: IntegrationPlatform.SHOPFLOW,
          // Informational: the event was captured, nothing was synced.
          status: SyncStatus.SUCCESS,
          direction: SyncDirection.INBOUND,
          newValue: payload as object,
          details: identifiers.length
            ? `Shop Flow instrument completed (${identifiers.join(", ")})`
            : "Shop Flow instrument completed",
        });

        setSyncRunSummary({
          recorded: Boolean(log),
          isJson,
          bytes: raw.length,
          ...(identifiers.length ? { identifiers: identifiers.join(", ") } : {}),
        });

        // Capturing the payload is the entire job, so a failed write must not
        // be reported as a successful run - surface it against the run instead.
        if (!log) {
          throw new Error("Shop Flow event could not be persisted");
        }

        return { eventId: log.id };
      }
    );

    return NextResponse.json({
      data: { received: true, eventId: result.eventId },
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
