import { describe, expect, it } from "vitest";
import type { ReverbOrder } from "./reverb";
import { isVoidedReverbOrder, pendingSalesByListing, placedBefore } from "./reverb-orders";

function order(overrides: Partial<ReverbOrder>): ReverbOrder {
  return {
    order_number: "1001",
    created_at: "2026-10-27T12:00:00Z",
    status: "paid",
    sku: "CIARI-STD-VB-L",
    product_id: 555,
    quantity: 1,
    ...overrides,
  };
}

describe("isVoidedReverbOrder", () => {
  it("treats cancelled and refunded orders as voided", () => {
    expect(isVoidedReverbOrder("cancelled")).toBe(true);
    expect(isVoidedReverbOrder("Refunded")).toBe(true);
  });

  it("keeps live sales", () => {
    expect(isVoidedReverbOrder("unpaid")).toBe(false);
    expect(isVoidedReverbOrder("paid")).toBe(false);
    expect(isVoidedReverbOrder("shipped")).toBe(false);
    expect(isVoidedReverbOrder(null)).toBe(false);
  });
});

describe("placedBefore", () => {
  const cutoff = new Date("2026-10-27T12:00:00Z");

  it("compares the order's created_at to the cutoff", () => {
    expect(placedBefore(order({ created_at: "2026-10-27T11:59:59Z" }), cutoff)).toBe(true);
    expect(placedBefore(order({ created_at: "2026-10-27T12:00:00Z" }), cutoff)).toBe(false);
    expect(placedBefore(order({ created_at: "2026-10-27T05:30:00-07:00" }), cutoff)).toBe(false);
  });

  it("counts an unreadable date as old", () => {
    expect(placedBefore(order({ created_at: "" }), cutoff)).toBe(true);
  });
});

describe("pendingSalesByListing", () => {
  const liveSince = new Date("2026-10-27T10:00:00Z");

  it("sums unbooked sales per listing", () => {
    const pending = pendingSalesByListing(
      [
        order({ order_number: "1", product_id: 555, quantity: 1 }),
        order({ order_number: "2", product_id: 555, quantity: 2 }),
        order({ order_number: "3", product_id: 777, quantity: 1 }),
      ],
      { appliedOrderNumbers: new Set(), liveSince }
    );
    expect(pending.get("555")).toBe(3);
    expect(pending.get("777")).toBe(1);
  });

  it("skips orders already booked in Katana, voided, or from before go-live", () => {
    const pending = pendingSalesByListing(
      [
        order({ order_number: "booked" }),
        order({ order_number: "cancelled", status: "cancelled" }),
        order({ order_number: "old", created_at: "2026-10-27T09:59:00Z" }),
        order({ order_number: "no-listing", product_id: null }),
      ],
      { appliedOrderNumbers: new Set(["booked"]), liveSince }
    );
    expect(pending.size).toBe(0);
  });

  it("counts every recent sale while Katana writes are off", () => {
    const pending = pendingSalesByListing(
      [order({ order_number: "old", created_at: "2026-10-01T00:00:00Z" })],
      { appliedOrderNumbers: new Set(), liveSince: null }
    );
    expect(pending.get("555")).toBe(1);
  });
});
