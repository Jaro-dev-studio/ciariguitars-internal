import { NextRequest, NextResponse } from "next/server";
import { cleanupAlertsCore } from "@/lib/integrations/alert-maintenance";

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
 * Alert cleanup cron (daily): collapses duplicate alerts, deletes dismissed
 * alerts, and prunes stale ones so the Alert table stays bounded.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[CronAlertCleanup] ========== Cleaning up alerts ==========");
    const result = await cleanupAlertsCore();
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
