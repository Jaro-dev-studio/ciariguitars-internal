import "server-only";

import { IntegrationPlatform, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

/**
 * Dashboard on/off switches for the syncs that write stock, kept on each
 * platform's IntegrationConnection config so they can be flipped without a
 * redeploy. Every switch is off until someone turns it on.
 *
 * Switching on stamps a cutover time. Whatever came in while the switch was
 * off was handled by hand, so it is never booked automatically.
 */

export interface LiveSwitch {
  platform: IntegrationPlatform;
  /** Connection name, used if the connection row does not exist yet. */
  name: string;
  /** Config key the cutover time is stored under. */
  cutoverKey: string;
}

export interface LiveSwitchState {
  live: boolean;
  /** When the switch was last turned on; anything earlier is never booked. */
  liveSince: string | null;
  changedAt: string | null;
  changedBy: string | null;
}

function toState(config: Prisma.JsonObject, cutoverKey: string): LiveSwitchState {
  const liveSince = config[cutoverKey];
  return {
    live: config.liveSync === true,
    liveSince: typeof liveSince === "string" ? liveSince : null,
    changedAt: typeof config.liveSyncChangedAt === "string" ? config.liveSyncChangedAt : null,
    changedBy: typeof config.liveSyncChangedBy === "string" ? config.liveSyncChangedBy : null,
  };
}

/**
 * The connection config after flipping a switch. Only an off-to-on flip moves
 * the cutover, so flipping on twice does not drop what came in between.
 */
export function withSwitchFlipped(
  config: Prisma.JsonObject,
  live: boolean,
  changedBy: string,
  now: Date,
  cutoverKey: string
): Prisma.JsonObject {
  const at = now.toISOString();
  const turningOn = live && config.liveSync !== true;
  return {
    ...config,
    liveSync: live,
    liveSyncChangedAt: at,
    liveSyncChangedBy: changedBy,
    ...(turningOn ? { [cutoverKey]: at } : {}),
  };
}

async function readConfig(platform: IntegrationPlatform): Promise<Prisma.JsonObject> {
  const connection = await prisma.integrationConnection.findUnique({
    where: { platform },
    select: { config: true },
  });
  return (connection?.config ?? {}) as Prisma.JsonObject;
}

export async function getLiveSwitch(sw: LiveSwitch): Promise<LiveSwitchState> {
  return toState(await readConfig(sw.platform), sw.cutoverKey);
}

export async function setLiveSwitch(
  sw: LiveSwitch,
  live: boolean,
  changedBy: string
): Promise<LiveSwitchState> {
  const config = withSwitchFlipped(
    await readConfig(sw.platform),
    live,
    changedBy,
    new Date(),
    sw.cutoverKey
  );
  await prisma.integrationConnection.upsert({
    where: { platform: sw.platform },
    create: { platform: sw.platform, name: sw.name, config },
    update: { config },
  });
  const state = toState(config, sw.cutoverKey);
  console.log(
    `[LiveSwitch] ${sw.name} switched ${live ? "ON" : "OFF"} by ${changedBy}${live ? `; live since ${state.liveSince}` : ""}`
  );
  return state;
}
