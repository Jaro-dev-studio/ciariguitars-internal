import "server-only";

import { katana } from "./katana";

/**
 * The Katana location every stock movement is booked against. Prefers the
 * explicit env override so a multi-location account cannot silently write to
 * whichever location happens to be listed first.
 */
export async function resolveDefaultLocationId(): Promise<number> {
  const fromEnv = process.env.KATANA_DEFAULT_LOCATION_ID;
  if (fromEnv && Number.isFinite(Number(fromEnv))) return Number(fromEnv);

  try {
    const locations = await katana.listLocations();
    if (locations[0]) return locations[0].id;
  } catch (err) {
    console.error("[Katana] Could not resolve location:", err);
  }
  throw new Error("No Katana location available; set KATANA_DEFAULT_LOCATION_ID");
}
