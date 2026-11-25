/**
 * What one sync run does to one Reverb listing, given the quantity Katana has
 * available for it. The real sync and the preview both decide here, so the
 * preview always shows what the next run will do.
 *
 * Listings set to "I have more than one" carry a quantity that follows Katana:
 * set to Katana's number and published while there is stock, set to 0 and
 * unpublished when there is none.
 *
 * One-off listings (has_inventory = false) hold a single guitar, so there is
 * no quantity to set. A live one-off stays up while Katana has stock and is
 * ended when Katana reaches 0, and a draft is published once Katana has stock.
 * A one-off that has sold or been ended is never put back on sale: it was one
 * guitar, and relisting it could sell a guitar that has already gone. One-offs
 * are only touched when the listing carries the Katana SKU itself.
 */
export type ListingChange =
  /** Quantity listing: set it to the target and publish. */
  | { kind: "set-quantity" }
  /** Quantity listing: set it to 0 and unpublish. */
  | { kind: "unpublish" }
  /** One-off listing: end it. */
  | { kind: "end" }
  /** One-off draft: publish it. */
  | { kind: "publish" }
  /** Already right, nothing to do. */
  | { kind: "noop"; note: string }
  /** Deliberately left alone, and worth a look. */
  | { kind: "leave"; note: string };

export interface ListingNow {
  /** Reverb state slug: live, draft, sold, ended... */
  state: string | null;
  inventory: number | null;
  /** false for a one-off listing. */
  hasInventory: boolean | null | undefined;
  /** Whether the listing's own SKU is the Katana SKU it is linked to. */
  carriesKatanaSku: boolean;
}

export function isOneOffListing(listing: {
  hasInventory: boolean | null | undefined;
}): boolean {
  return listing.hasInventory === false;
}

export function planListingChange(
  listing: ListingNow,
  targetQty: number
): ListingChange {
  const isLive = listing.state === "live";

  if (isOneOffListing(listing)) {
    if (!listing.carriesKatanaSku) {
      return {
        kind: "leave",
        note: "One-off listing without the Katana SKU on it, so it is left alone",
      };
    }
    if (targetQty <= 0) {
      return isLive
        ? { kind: "end" }
        : { kind: "noop", note: "One-off listing is not live" };
    }
    if (isLive) return { kind: "noop", note: "One-off listing is live" };
    if (listing.state === "draft") return { kind: "publish" };
    return {
      kind: "leave",
      note: `One-off listing is ${listing.state ?? "not live"}, so it is not put back on sale`,
    };
  }

  const currentQty = listing.inventory ?? 0;
  if (targetQty <= 0) {
    return !isLive && currentQty === 0
      ? { kind: "noop", note: "Already at 0 and not live" }
      : { kind: "unpublish" };
  }
  if (currentQty === targetQty && isLive) {
    return { kind: "noop", note: "Quantities already match" };
  }
  return { kind: "set-quantity" };
}
