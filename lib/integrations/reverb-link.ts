import "server-only";

import { IntegrationPlatform, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

/**
 * The on/off switch for the Reverb <-> Katana stock link, kept on the Reverb
 * connection so it can be flipped from the dashboard without a redeploy.
 * While it is off, the inventory push and the Reverb order sync run dry and
 * only report what they would do.
 *
 * One switch covers both directions: the push holds back Reverb sales until
 * the order sync takes them out of Katana, so running either one alone would
 * keep sold listings held back or put sold guitars back on sale.
 *
 * Shop Flow's writes to Katana are not part of the link and stay on the
 * SYNC_* environment flags.
 */

export interface ReverbLinkState {
  live: boolean;
  changedAt: string | null;
  changedBy: string | null;
}

function toState(config: Prisma.JsonObject): ReverbLinkState {
  return {
    live: config.liveSync === true,
    changedAt: typeof config.liveSyncChangedAt === "string" ? config.liveSyncChangedAt : null,
    changedBy: typeof config.liveSyncChangedBy === "string" ? config.liveSyncChangedBy : null,
  };
}

/**
 * The Reverb connection config after flipping the switch. Switching on
 * restarts the order cutover (ordersLiveSince): Reverb sales placed while the
 * link was off were entered in Katana by hand, so only sales placed from now
 * on are taken out automatically.
 */
export function withLinkSwitched(
  config: Prisma.JsonObject,
  live: boolean,
  changedBy: string,
  now: Date
): Prisma.JsonObject {
  const at = now.toISOString();
  const turningOn = live && config.liveSync !== true;
  return {
    ...config,
    liveSync: live,
    liveSyncChangedAt: at,
    liveSyncChangedBy: changedBy,
    ...(turningOn ? { ordersLiveSince: at } : {}),
  };
}

async function readReverbConfig(): Promise<Prisma.JsonObject> {
  const connection = await prisma.integrationConnection.findUnique({
    where: { platform: IntegrationPlatform.REVERB },
    select: { config: true },
  });
  return (connection?.config ?? {}) as Prisma.JsonObject;
}

export async function getReverbLinkState(): Promise<ReverbLinkState> {
  return toState(await readReverbConfig());
}

export async function isReverbLinkLive(): Promise<boolean> {
  return (await getReverbLinkState()).live;
}

export async function setReverbLinkLive(
  live: boolean,
  changedBy: string
): Promise<ReverbLinkState> {
  const config = withLinkSwitched(await readReverbConfig(), live, changedBy, new Date());
  await prisma.integrationConnection.upsert({
    where: { platform: IntegrationPlatform.REVERB },
    create: { platform: IntegrationPlatform.REVERB, name: "Reverb", config },
    update: { config },
  });
  console.log(
    `[ReverbLink] Switched ${live ? "ON" : "OFF"} by ${changedBy}${live ? `; Reverb sales placed from ${config.liveSyncChangedAt} on are taken out of Katana automatically` : ""}`
  );
  return toState(config);
}
