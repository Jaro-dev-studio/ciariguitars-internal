import { NextRequest, NextResponse } from "next/server";
import { SyncSource } from "@prisma/client";
import { cleanupAlertsCore } from "@/lib/integrations/alert-maintenance";
import { pruneQuietPushLogs } from "@/lib/integrations/sync-log-maintenance";
import {
  failStaleSyncRuns,
  setSyncRunSummary,
  withSyncRun,
} from "@/lib/integrations/sync-run";

export const maxDuration = 300;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured (local/dev)
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

/**
 * Cleanup cron (daily): collapses duplicate alerts, deletes dismissed alerts,
 * and prunes stale ones so the Alert table stays bounded. It also trims the
 * sync log of the inventory push's old "nothing written" rows.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[CronAlertCleanup] ========== Cleaning up alerts ==========");

    const result = await withSyncRun(
      { source: SyncSource.CRON, trigger: "cleanup-alerts" },
      async () => {
        const cleanup = await cleanupAlertsCore();

        console.log("[CronAlertCleanup] Sweeping runs that never reported completion...");
        const staleRunsFailed = await failStaleSyncRuns();

        // Last, and on its own: a failed trim must not lose the work above.
        let syncLogsPruned: number | null = null;
        let syncLogPruneIncomplete = false;
        let syncLogPruneError: string | null = null;
        try {
          const pruned = await pruneQuietPushLogs();
          syncLogsPruned = pruned.deleted;
          syncLogPruneIncomplete = pruned.incomplete;
        } catch (err) {
          syncLogPruneError = err instanceof Error ? err.message : "Unknown error";
          console.error("[CronAlertCleanup] Sync log trim failed:", syncLogPruneError);
        }

        const summary = {
          ...cleanup,
          staleRunsFailed,
          syncLogsPruned,
          syncLogPruneIncomplete,
          ...(syncLogPruneError ? { syncLogPruneError } : {}),
        };
        setSyncRunSummary(summary);
        return summary;
      }
    );

    console.log("[CronAlertCleanup] ========== Done ==========");
    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    console.error("[CronAlertCleanup] FATAL ERROR:", error);
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Alert cleanup failed" },
      { status: 500 }
    );
  }
}
