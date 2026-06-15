import { NextRequest, NextResponse } from "next/server";
import { pollReverbOrders } from "@/lib/integrations/sale-handler";
import { getIntegrationConfig } from "@/lib/integrations/config";

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
 * Order Sync cron (every 10 min): polls Reverb for recent sales and decrements
 * Katana stock for each matched order. While SYNC_DRY_RUN is on this runs as a
 * dry run - it still writes sync logs (flagged dryRun) but never touches Katana.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { flags } = getIntegrationConfig();
    const dryRun = flags.dryRun || !flags.katanaWritesEnabled;
    console.log(
      `[CronOrderSync] ========== Polling Reverb orders (${dryRun ? "DRY RUN - no Katana writes" : "LIVE"}) ==========`
    );

    // Look back a couple hours so a missed run is still picked up; processing is
    // idempotent on order number so overlap is safe.
    const processed = await pollReverbOrders({ sinceHours: 2 });

    console.log(`[CronOrderSync] ========== Done. ${processed.length} order(s) processed ==========`);
    return NextResponse.json({
      data: { ordersProcessed: processed.length, dryRun },
      error: null,
    });
  } catch (error) {
    console.error("[CronOrderSync] FATAL ERROR:", error);
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Order sync failed" },
      { status: 500 }
    );
  }
}
