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

export interface RecordSyncLogInput {
  syncType: SyncType;
  platform: IntegrationPlatform;
  status: SyncStatus;
  direction: SyncDirection;
  inventoryItemId?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  errorMessage?: string;
  details?: string;
  /** True when produced by a dry run (no real write happened). */
  dryRun?: boolean;
}

export async function recordSyncLog(input: RecordSyncLogInput) {
  try {
    return await prisma.syncLog.create({
      data: {
        syncType: input.syncType,
        platform: input.platform,
        status: input.status,
        direction: input.direction,
        inventoryItemId: input.inventoryItemId ?? null,
        previousValue:
          input.previousValue === undefined
            ? undefined
            : (input.previousValue as object),
        newValue:
          input.newValue === undefined
            ? undefined
            : (input.newValue as object),
        errorMessage: input.errorMessage,
        details: input.details,
        dryRun: input.dryRun ?? false,
      },
    });
  } catch (err) {
    console.error("[SyncLogger] Failed to persist sync log:", err);
    return null;
  }
}

/** Stable fingerprint that identifies "the same" recurring alert. */
function alertDedupeKey(input: {
  type: AlertType;
  relatedPlatform?: IntegrationPlatform;
  relatedSku?: string;
  title: string;
}): string {
  return [
    input.type,
    input.relatedPlatform ?? "",
    input.relatedSku ?? "",
    input.title,
  ].join("|");
}

/**
 * Records an alert, collapsing repeats. When an identical, still-active
 * (non-dismissed) alert already exists, we bump its `count` and refresh it
 * instead of inserting a new row. This is what stops crons from generating a
 * fresh alert on every run for the same recurring error.
 */
export async function recordAlert(input: {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  relatedSku?: string;
  relatedPlatform?: IntegrationPlatform;
  actionUrl?: string;
  actionLabel?: string;
}) {
  try {
    const dedupeKey = alertDedupeKey(input);

    const existing = await prisma.alert.findFirst({
      where: { dedupeKey, isDismissed: false },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (existing) {
      return await prisma.alert.update({
        where: { id: existing.id },
        data: {
          count: { increment: 1 },
          severity: input.severity,
          message: input.message,
          isRead: false,
          actionUrl: input.actionUrl,
          actionLabel: input.actionLabel,
        },
      });
    }

    return await prisma.alert.create({
      data: {
        type: input.type,
        severity: input.severity,
        title: input.title,
        message: input.message,
        relatedSku: input.relatedSku,
        relatedPlatform: input.relatedPlatform,
        actionUrl: input.actionUrl,
        actionLabel: input.actionLabel,
        dedupeKey,
      },
    });
  } catch (err) {
    console.error("[SyncLogger] Failed to persist alert:", err);
    return null;
  }
}

/**
 * Auto-resolves ("recovers") active alerts once the condition that produced
 * them clears. Matches on the same identity fields as the dedupe key (type +
 * platform + optional SKU) and marks the survivors dismissed so they drop off
 * the active view and get pruned by the cleanup cron. This is the counterpart
 * to `recordAlert`: crons call it after a successful run so stale failure
 * alerts don't linger once things are healthy again. Returns the count cleared.
 *
 * Omit a field to leave it unconstrained; pass `relatedSku: null` to target the
 * batch-level alerts that were recorded without a SKU.
 */
export async function clearAlerts(filter: {
  type: AlertType;
  relatedPlatform?: IntegrationPlatform;
  relatedSku?: string | null;
}): Promise<number> {
  try {
    const { count } = await prisma.alert.updateMany({
      where: {
        type: filter.type,
        isDismissed: false,
        ...(filter.relatedPlatform !== undefined
          ? { relatedPlatform: filter.relatedPlatform }
          : {}),
        ...(filter.relatedSku !== undefined
          ? { relatedSku: filter.relatedSku }
          : {}),
      },
      data: { isDismissed: true, isRead: true },
    });

    if (count > 0) {
      console.log(
        `[SyncLogger] Auto-cleared ${count} recovered alert(s) (type=${filter.type}, platform=${filter.relatedPlatform ?? "any"}, sku=${filter.relatedSku ?? "any"})`
      );
    }
    return count;
  } catch (err) {
    console.error("[SyncLogger] Failed to clear recovered alerts:", err);
    return 0;
  }
}

export async function touchIntegrationLastSync(
  platform: IntegrationPlatform,
  isActive = true
) {
  try {
    await prisma.integrationConnection.upsert({
      where: { platform },
      create: {
        platform,
        name: platformDisplayName(platform),
        isActive,
        lastSyncAt: new Date(),
      },
      update: {
        lastSyncAt: new Date(),
        isActive,
      },
    });
  } catch (err) {
    console.error(
      `[SyncLogger] Failed to update IntegrationConnection for ${platform}:`,
      err
    );
  }
}

function platformDisplayName(platform: IntegrationPlatform): string {
  switch (platform) {
    case "KATANA":
      return "Katana MRP";
    case "REVERB":
      return "Reverb";
    case "SHOPIFY":
      return "Shopify";
    case "SHIPSTATION":
      return "ShipStation";
    case "MANAGEMARKETS":
      return "ManageMarkets";
    case "SHOPFLOW":
      return "Shop Flow";
    default:
      return platform;
  }
}
