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
      },
    });
  } catch (err) {
    console.error("[SyncLogger] Failed to persist alert:", err);
    return null;
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
