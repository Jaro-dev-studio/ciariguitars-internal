import "server-only";

import prisma from "@/lib/prisma";

export interface AlertCleanupResult {
  dedupeBackfilled: number;
  duplicatesRemoved: number;
  dismissedDeleted: number;
  staleDeleted: number;
  remaining: number;
}

/**
 * Keeps the Alert table bounded. Complements the dedup in `recordAlert`:
 *   1. Backfills `dedupeKey` on any legacy rows that predate dedup.
 *   2. Collapses duplicate active alerts into a single row (summing counts).
 *   3. Deletes dismissed alerts outright.
 *   4. Deletes stale active alerts older than the retention window.
 * Safe to run repeatedly (idempotent) - it is used both by the daily cron and
 * the one-time purge script.
 */
export async function cleanupAlertsCore(
  opts: { retentionDays?: number } = {}
): Promise<AlertCleanupResult> {
  const retentionDays = opts.retentionDays ?? 30;
  console.log(`[AlertCleanup] Starting cleanup (retentionDays=${retentionDays})...`);

  // 1. Backfill dedupeKey for rows created before dedup existed.
  console.log("[AlertCleanup] Backfilling missing dedupe keys...");
  const dedupeBackfilled = await prisma.$executeRawUnsafe(`
    UPDATE "Alert"
    SET "dedupeKey" = "type"::text || '|' ||
      COALESCE("relatedPlatform"::text, '') || '|' ||
      COALESCE("relatedSku", '') || '|' || "title"
    WHERE "dedupeKey" IS NULL
  `);

  // 2. Roll the total occurrence count into the survivor (newest per key).
  console.log("[AlertCleanup] Rolling duplicate counts into survivors...");
  await prisma.$executeRawUnsafe(`
    WITH ranked AS (
      SELECT id, "dedupeKey",
        ROW_NUMBER() OVER (PARTITION BY "dedupeKey" ORDER BY "createdAt" DESC, id DESC) AS rn,
        SUM("count") OVER (PARTITION BY "dedupeKey") AS grp_total
      FROM "Alert"
      WHERE "isDismissed" = false
    )
    UPDATE "Alert" a
    SET "count" = r.grp_total
    FROM ranked r
    WHERE a.id = r.id AND r.rn = 1 AND a."count" <> r.grp_total
  `);

  // 3. Delete duplicate active rows, keeping the survivor.
  console.log("[AlertCleanup] Removing duplicate active alerts...");
  const duplicatesRemoved = await prisma.$executeRawUnsafe(`
    WITH ranked AS (
      SELECT id,
        ROW_NUMBER() OVER (PARTITION BY "dedupeKey" ORDER BY "createdAt" DESC, id DESC) AS rn
      FROM "Alert"
      WHERE "isDismissed" = false
    )
    DELETE FROM "Alert" a
    USING ranked r
    WHERE a.id = r.id AND r.rn > 1
  `);

  // 4. Delete dismissed alerts entirely.
  console.log("[AlertCleanup] Deleting dismissed alerts...");
  const { count: dismissedDeleted } = await prisma.alert.deleteMany({
    where: { isDismissed: true },
  });

  // 5. Delete stale active alerts older than the retention window.
  console.log("[AlertCleanup] Deleting stale alerts...");
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const { count: staleDeleted } = await prisma.alert.deleteMany({
    where: { isDismissed: false, createdAt: { lt: cutoff } },
  });

  const remaining = await prisma.alert.count();
  console.log(
    `[AlertCleanup] Done. backfilled=${dedupeBackfilled} duplicatesRemoved=${duplicatesRemoved} dismissedDeleted=${dismissedDeleted} staleDeleted=${staleDeleted} remaining=${remaining}`
  );

  return {
    dedupeBackfilled: Number(dedupeBackfilled),
    duplicatesRemoved: Number(duplicatesRemoved),
    dismissedDeleted,
    staleDeleted,
    remaining,
  };
}
