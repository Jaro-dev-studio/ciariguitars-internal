import { describe, expect, it } from "vitest";
import { pruneInBatches, quietPushLogWhere } from "./sync-log-maintenance";

describe("quietPushLogWhere", () => {
  it("targets only the push's skipped Reverb rows older than the window", () => {
    const where = quietPushLogWhere(new Date("2026-11-25T04:00:00Z"), 7);
    expect(where).toEqual({
      status: "SKIPPED",
      platform: "REVERB",
      direction: "OUTBOUND",
      syncType: { in: ["INVENTORY_QUANTITY", "LISTING_UPDATE"] },
      createdAt: { lt: new Date("2026-11-18T04:00:00Z") },
    });
  });
});

/** A fake table of ids, deleted oldest first. */
function fakeTable(count: number) {
  let rows = Array.from({ length: count }, (_, i) => `row-${i}`);
  return {
    remaining: () => rows.length,
    fetchIds: async (limit: number) => rows.slice(0, limit),
    deleteIds: async (ids: string[]) => {
      const drop = new Set(ids);
      const before = rows.length;
      rows = rows.filter((id) => !drop.has(id));
      return before - rows.length;
    },
  };
}

describe("pruneInBatches", () => {
  it("works through the whole backlog in batches", async () => {
    const table = fakeTable(12);
    const result = await pruneInBatches({ ...table, budgetMs: 60_000, batchSize: 5 });
    expect(result).toEqual({ deleted: 12, incomplete: false });
    expect(table.remaining()).toBe(0);
  });

  it("does nothing when there is nothing to delete", async () => {
    const table = fakeTable(0);
    expect(await pruneInBatches({ ...table, budgetMs: 60_000, batchSize: 5 })).toEqual({
      deleted: 0,
      incomplete: false,
    });
  });

  it("stops at the time budget and leaves the rest for the next run", async () => {
    const table = fakeTable(20);
    let now = 0;
    const result = await pruneInBatches({
      fetchIds: table.fetchIds,
      // Each batch takes 40 ms: batches start at 0, 40 and 80 ms, then the
      // 100 ms budget is spent.
      deleteIds: async (ids) => {
        now += 40;
        return table.deleteIds(ids);
      },
      budgetMs: 100,
      batchSize: 5,
      clock: () => now,
    });
    expect(result).toEqual({ deleted: 15, incomplete: true });
    expect(table.remaining()).toBe(5);
  });
});
