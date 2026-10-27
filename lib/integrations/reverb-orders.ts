import "server-only";

import type { ReverbOrder } from "./reverb";

/** Reverb statuses where the sale fell through, so no guitar left stock. */
const VOIDED_ORDER_STATUSES = new Set(["cancelled", "refunded"]);

export function isVoidedReverbOrder(status: string | null | undefined): boolean {
  return VOIDED_ORDER_STATUSES.has((status ?? "").toLowerCase());
}

/**
 * True when the order was placed before `cutoff`. An order without a readable
 * date counts as old, so it is never decremented on a guess.
 */
export function placedBefore(
  order: Pick<ReverbOrder, "created_at">,
  cutoff: Date
): boolean {
  const placedAt = Date.parse(order.created_at);
  return !Number.isFinite(placedAt) || placedAt < cutoff.getTime();
}

/**
 * Units sold on Reverb that the order sync has not taken out of Katana yet,
 * keyed by Reverb listing id (an order's product_id).
 *
 * Reverb lowers its own listing quantity the moment something sells, but
 * Katana only catches up once the order sync books the sale. Pushing Katana's
 * number in between would put a sold guitar back on sale, so the inventory push
 * holds these units back until the decrement lands.
 *
 * With `liveSince` null (Katana writes off) every recent sale counts: nothing
 * will book it automatically, and holding back too much only hides a listing
 * for a while, where holding back too little sells a guitar twice.
 */
export function pendingSalesByListing(
  orders: ReverbOrder[],
  opts: { appliedOrderNumbers: Set<string>; liveSince: Date | null }
): Map<string, number> {
  const pending = new Map<string, number>();
  for (const order of orders) {
    if (!order.product_id) continue;
    if (opts.appliedOrderNumbers.has(order.order_number)) continue;
    if (isVoidedReverbOrder(order.status)) continue;
    // Sales from before go-live were entered in Katana by hand.
    if (opts.liveSince && placedBefore(order, opts.liveSince)) continue;

    const listingId = String(order.product_id);
    pending.set(listingId, (pending.get(listingId) ?? 0) + Math.abs(order.quantity ?? 1));
  }
  return pending;
}
