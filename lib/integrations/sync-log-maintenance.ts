import "server-only";

import {
  IntegrationPlatform,
  SyncDirection,
  SyncStatus,
  SyncType,
  type Prisma,
} from "@prisma/client";
import prisma from "@/lib/prisma";

/**
 * How long the inventory push's "nothing written" rows are kept. Seven days
 * matches the Sync Logs page's default range, which covers normal debugging.
 */
export const QUIET_PUSH_LOG_RETENTION_DAYS = 7;

const BATCH_SIZE = 5000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The rows the trim deletes: the inventory push's rows that wrote nothing to
 * Reverb (no change needed, dry runs, and the same skip repeated every run),
 * once they are older than the retention window. Every write to Reverb, every
 * failure, and every inbound row (Reverb sales, mappings, Shop Flow) is kept.
 */
export function quietPushLogWhere(
  now: Date,
  retentionDays = QUIET_PUSH_LOG_RETENTION_DAYS
): Prisma.SyncLogWhereInput {
  return {
    status: SyncStatus.SKIPPED,
    platform: IntegrationPlatform.REVERB,
    direction: SyncDirection.OUTBOUND,
    // The only two kinds of row the inventory push writes.
    syncType: { in: [SyncType.INVENTORY_QUANTITY, SyncType.LISTING_UPDATE] },
    createdAt: { lt: new Date(now.getTime() - retentionDays * DAY_MS) },
  };
}

export interface PruneResult {
  deleted: number;
  /** The time budget ran out first; the rest is deleted on the next run. */
  incomplete: boolean;
}

/**
 * Deletes in batches, oldest first, until nothing is left or the time budget
 * runs out, so a large backlog never holds the cron past its limit.
 */
export async function pruneInBatches(opts: {
  fetchIds: (limit: number) => Promise<string[]>;
  deleteIds: (ids: string[]) => Promise<number>;
  budgetMs: number;
  batchSize?: number;
  clock?: () => number;
}): Promise<PruneResult> {
  const batchSize = opts.batchSize ?? BATCH_SIZE;
  const clock = opts.clock ?? Date.now;
  const startedAt = clock();
  let deleted = 0;

  while (clock() - startedAt < opts.budgetMs) {
    const ids = await opts.fetchIds(batchSize);
    if (ids.length === 0) return { deleted, incomplete: false };
    deleted += await opts.deleteIds(ids);
    if (ids.length < batchSize) return { deleted, incomplete: false };
  }
  return { deleted, incomplete: true };
}

/**
 * Trims the sync log. The inventory push writes a row for every linked
 * listing on every run, nearly all of them "no change", so without this the
 * table grows by well over 100,000 rows a week. Each run's own counts stay on
 * the Runs tab after its rows are gone.
 */
export async function pruneQuietPushLogs(
  opts: { budgetMs?: number; now?: Date } = {}
): Promise<PruneResult> {
  const where = quietPushLogWhere(opts.now ?? new Date());
  console.log(
    `[SyncLogPrune] Deleting push rows that wrote nothing, older than ${QUIET_PUSH_LOG_RETENTION_DAYS} days...`
  );

  const result = await pruneInBatches({
    budgetMs: opts.budgetMs ?? 150_000,
    fetchIds: async (limit) =>
      (
        await prisma.syncLog.findMany({
          where,
          select: { id: true },
          orderBy: { createdAt: "asc" },
          take: limit,
        })
      ).map((row) => row.id),
    deleteIds: async (ids) =>
      (await prisma.syncLog.deleteMany({ where: { id: { in: ids } } })).count,
  });

  console.log(
    `[SyncLogPrune] Deleted ${result.deleted} rows${result.incomplete ? " (time budget reached, the rest goes next run)" : ""}`
  );
  return result;
}
