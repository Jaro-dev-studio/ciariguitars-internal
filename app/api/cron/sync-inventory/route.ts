import { NextRequest, NextResponse } from "next/server";
import { runKatanaToReverbSync } from "@/lib/integrations/inventory-sync";

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

    const locationId = process.env.KATANA_DEFAULT_LOCATION_ID;
    console.log("[CronInventorySync] Pushing Katana availability to Reverb...");
    const syncResult = await runKatanaToReverbSync({
      locationIds: locationId ? [Number(locationId)] : undefined,
    });

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
