import { NextRequest, NextResponse } from "next/server";
import {
  IntegrationPlatform,
  SyncDirection,
  SyncSource,
  SyncStatus,
  SyncType,
} from "@prisma/client";
import { runKatanaToReverbSync } from "@/lib/integrations/inventory-sync";
import { recordSyncLog } from "@/lib/integrations/sync-logger";
import { setSyncRunSummary, withSyncRun } from "@/lib/integrations/sync-run";
import { syncMappingsCore } from "@/lib/sku-mapping-core";

export const maxDuration = 300;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured (local/dev)
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { data: null, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    console.log("[CronInventorySync] ========== Starting Katana -> Reverb inventory push ==========");

    const syncResult = await withSyncRun(
      { source: SyncSource.CRON, trigger: "sync-inventory" },
      async () => {
        // Same as the Sync mappings button: a listing whose SKU now matches
        // Katana is linked before the push, rather than waiting for someone to
        // click it. If this fails the existing links still get pushed.
        console.log("[CronInventorySync] Refreshing SKU mappings...");
        try {
          const mappings = await syncMappingsCore();
          setSyncRunSummary({ mappingsCreated: mappings.created });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          console.error("[CronInventorySync] Mapping refresh failed:", msg);
          setSyncRunSummary({ mappingRefreshError: msg });
          await recordSyncLog({
            syncType: SyncType.SKU_MAPPING,
            platform: IntegrationPlatform.REVERB,
            status: SyncStatus.FAILED,
            direction: SyncDirection.INBOUND,
            errorMessage: msg,
            details: "Automatic Sync mappings failed; pushed existing links only",
          });
        }

        const locationId = process.env.KATANA_DEFAULT_LOCATION_ID;
        console.log("[CronInventorySync] Pushing Katana availability to Reverb...");
        const result = await runKatanaToReverbSync({
          locationIds: locationId ? [Number(locationId)] : undefined,
        });

        setSyncRunSummary({
          totalConsidered: result.totalConsidered,
          updated: result.updated,
          unpublished: result.unpublished,
          noop: result.noop,
          skipped: result.skipped,
          failed: result.failed,
          writesEnabled: result.writesEnabled,
        });

        return result;
      }
    );

    console.log("[CronInventorySync] ========== Inventory push complete ==========");
    return NextResponse.json({
      data: {
        sync: {
          updated: syncResult.updated,
          unpublished: syncResult.unpublished,
          noop: syncResult.noop,
          skipped: syncResult.skipped,
          failed: syncResult.failed,
          writesEnabled: syncResult.writesEnabled,
        },
      },
      error: null,
    });
  } catch (error) {
    console.error("[CronInventorySync] FATAL ERROR:", error);
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : "Sync failed",
      },
      { status: 500 }
    );
  }
}
