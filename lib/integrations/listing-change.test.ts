import { describe, expect, it } from "vitest";
import { isLinkableListing } from "@/lib/sku-mapping-core";
import { planListingChange, type ListingNow } from "./listing-change";

const quantity = (state: string, inventory: number): ListingNow => ({
  state,
  inventory,
  hasInventory: true,
  carriesKatanaSku: true,
});

const oneOff = (state: string, carriesKatanaSku = true): ListingNow => ({
  state,
  inventory: state === "live" ? 1 : 0,
  hasInventory: false,
  carriesKatanaSku,
});

describe("planListingChange: quantity listings (unchanged behaviour)", () => {
  it("sets the quantity and publishes while Katana has stock", () => {
    expect(planListingChange(quantity("live", 1), 2)).toEqual({ kind: "set-quantity" });
    expect(planListingChange(quantity("draft", 0), 1)).toEqual({ kind: "set-quantity" });
    expect(planListingChange(quantity("ended", 0), 1)).toEqual({ kind: "set-quantity" });
    expect(planListingChange(quantity("sold", 0), 1)).toEqual({ kind: "set-quantity" });
  });

  it("leaves a live listing alone when the quantities match", () => {
    expect(planListingChange(quantity("live", 2), 2).kind).toBe("noop");
  });

  it("unpublishes when Katana has nothing", () => {
    expect(planListingChange(quantity("live", 1), 0)).toEqual({ kind: "unpublish" });
    expect(planListingChange(quantity("draft", 2), 0)).toEqual({ kind: "unpublish" });
  });

  it("does nothing when it is already at 0 and not live", () => {
    expect(planListingChange(quantity("draft", 0), 0).kind).toBe("noop");
    expect(planListingChange(quantity("sold", 0), 0).kind).toBe("noop");
  });

  it("treats an unknown has_inventory as a quantity listing", () => {
    expect(
      planListingChange({ state: "live", inventory: 1, hasInventory: null, carriesKatanaSku: false }, 0)
    ).toEqual({ kind: "unpublish" });
  });
});

describe("planListingChange: one-off listings", () => {
  it("ends a live one-off when Katana reaches 0", () => {
    expect(planListingChange(oneOff("live"), 0)).toEqual({ kind: "end" });
  });

  it("keeps a live one-off up while Katana has stock, whatever the count", () => {
    expect(planListingChange(oneOff("live"), 1).kind).toBe("noop");
    expect(planListingChange(oneOff("live"), 3).kind).toBe("noop");
  });

  it("publishes a one-off draft once Katana has stock", () => {
    expect(planListingChange(oneOff("draft"), 1)).toEqual({ kind: "publish" });
  });

  it("leaves a one-off draft as a draft while Katana has nothing", () => {
    expect(planListingChange(oneOff("draft"), 0).kind).toBe("noop");
  });

  it("never puts a sold or ended one-off back on sale", () => {
    expect(planListingChange(oneOff("sold"), 1).kind).toBe("leave");
    expect(planListingChange(oneOff("ended"), 2).kind).toBe("leave");
    expect(planListingChange(oneOff("sold"), 0).kind).toBe("noop");
  });

  it("never touches a one-off that does not carry the Katana SKU", () => {
    expect(planListingChange(oneOff("live", false), 0).kind).toBe("leave");
    expect(planListingChange(oneOff("draft", false), 1).kind).toBe("leave");
  });
});

describe("isLinkableListing", () => {
  it("always links quantity listings", () => {
    expect(isLinkableListing({ hasInventory: true, state: "sold" })).toBe(true);
    expect(isLinkableListing({ hasInventory: null, state: "ended" })).toBe(true);
  });

  it("links one-offs only while live or a draft", () => {
    expect(isLinkableListing({ hasInventory: false, state: "live" })).toBe(true);
    expect(isLinkableListing({ hasInventory: false, state: "draft" })).toBe(true);
    expect(isLinkableListing({ hasInventory: false, state: "sold" })).toBe(false);
    expect(isLinkableListing({ hasInventory: false, state: "ended" })).toBe(false);
  });
});
