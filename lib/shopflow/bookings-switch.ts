import "server-only";

import { IntegrationPlatform } from "@prisma/client";
import {
  getLiveSwitch,
  setLiveSwitch,
  type LiveSwitch,
  type LiveSwitchState,
} from "@/lib/integrations/live-switch";

/**
 * The on/off switch for booking Shop Flow work orders into Katana (parts used,
 * plus the finished guitar on a build). While it is off, work orders are still
 * captured and resolved, but nothing is written to Katana.
 *
 * Switching on restamps bookingsLiveSince: work orders first received before
 * then were handled in Katana by hand, so they are never booked automatically.
 */
const SHOPFLOW_BOOKINGS: LiveSwitch = {
  platform: IntegrationPlatform.SHOPFLOW,
  name: "Shop Flow",
  cutoverKey: "bookingsLiveSince",
};

export type ShopFlowBookingsState = LiveSwitchState;

export function getShopFlowBookingsState(): Promise<ShopFlowBookingsState> {
  return getLiveSwitch(SHOPFLOW_BOOKINGS);
}

export function setShopFlowBookingsLive(
  live: boolean,
  changedBy: string
): Promise<ShopFlowBookingsState> {
  return setLiveSwitch(SHOPFLOW_BOOKINGS, live, changedBy);
}
