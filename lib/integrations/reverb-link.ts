import "server-only";

import { IntegrationPlatform } from "@prisma/client";
import {
  getLiveSwitch,
  setLiveSwitch,
  type LiveSwitch,
  type LiveSwitchState,
} from "./live-switch";

/**
 * The on/off switch for the Reverb <-> Katana stock link. While it is off, the
 * inventory push and the Reverb order sync run dry and only report what they
 * would do.
 *
 * One switch covers both directions: the push holds back Reverb sales until
 * the order sync takes them out of Katana, so running either one alone would
 * keep sold listings held back or put sold guitars back on sale.
 *
 * Switching on restamps ordersLiveSince: Reverb sales placed while the link was
 * off were entered in Katana by hand, so only later ones are taken out
 * automatically.
 */
const REVERB_LINK: LiveSwitch = {
  platform: IntegrationPlatform.REVERB,
  name: "Reverb",
  cutoverKey: "ordersLiveSince",
};

export type ReverbLinkState = LiveSwitchState;

export function getReverbLinkState(): Promise<ReverbLinkState> {
  return getLiveSwitch(REVERB_LINK);
}

export async function isReverbLinkLive(): Promise<boolean> {
  return (await getReverbLinkState()).live;
}

export function setReverbLinkLive(live: boolean, changedBy: string): Promise<ReverbLinkState> {
  return setLiveSwitch(REVERB_LINK, live, changedBy);
}
