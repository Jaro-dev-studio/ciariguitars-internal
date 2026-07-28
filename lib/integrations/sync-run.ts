import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { SyncRunStatus, SyncSource } from "@prisma/client";
import prisma from "@/lib/prisma";

export interface SyncRunContext {
  /** Null when the run row could not be created; work still proceeds. */
  runId: string | null;
  source: SyncSource;
  trigger: string;
  summary: Record<string, unknown>;
}

const runStorage = new AsyncLocalStorage<SyncRunContext>();

export function getCurrentSyncRun(): SyncRunContext | undefined {
  return runStorage.getStore();
}

/**
 * Merges counters into the summary that gets persisted when the run finishes.
 * No-op outside a run, so callers never need to check whether they are tracked.
 */
export function setSyncRunSummary(summary: Record<string, unknown>): void {
  const context = runStorage.getStore();
  if (context) Object.assign(context.summary, summary);
}

/**
 * Wraps one execution of a cron job, webhook delivery or manual action so every
 * sync log written inside it is attributable to that trigger. Opens a SyncRun
 * row up front, exposes it through async local storage for `recordSyncLog`, and
 * closes it with a status, duration and summary on the way out.
 *
 * Bookkeeping never changes the outcome of the wrapped work: if the run row
 * cannot be written the work still runs untracked, and failures are recorded
 * and then rethrown so callers keep their existing error handling.
 */
export async function withSyncRun<T>(
  init: { source: SyncSource; trigger: string; triggeredBy?: string | null },
  fn: () => Promise<T>
): Promise<T> {
  const startedAt = Date.now();

  let runId: string | null = null;
  try {
    const run = await prisma.syncRun.create({
      data: {
        source: init.source,
        trigger: init.trigger,
        triggeredBy: init.triggeredBy ?? null,
        status: SyncRunStatus.RUNNING,
      },
      select: { id: true },
    });
    runId = run.id;
  } catch (err) {
    console.error(`[SyncRun] Could not open run for ${init.trigger}:`, err);
  }

  const context: SyncRunContext = {
    runId,
    source: init.source,
    trigger: init.trigger,
    summary: {},
  };

  console.log(
    `[SyncRun] ${init.trigger} started (source=${init.source}, run=${runId ?? "untracked"})`
  );

  try {
    const result = await runStorage.run(context, fn);
    await closeRun(context, SyncRunStatus.SUCCESS, null, startedAt);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await closeRun(context, SyncRunStatus.FAILED, message, startedAt);
    throw error;
  }
}

async function closeRun(
  context: SyncRunContext,
  status: SyncRunStatus,
  errorMessage: string | null,
  startedAt: number
): Promise<void> {
  const durationMs = Date.now() - startedAt;
  console.log(
    `[SyncRun] ${context.trigger} finished ${status} in ${durationMs}ms`
  );

  if (!context.runId) return;

  try {
    await prisma.syncRun.update({
      where: { id: context.runId },
      data: {
        status,
        errorMessage,
        durationMs,
        finishedAt: new Date(),
        summary: Object.keys(context.summary).length
          ? (context.summary as object)
          : undefined,
      },
    });
  } catch (err) {
    console.error(`[SyncRun] Could not close run ${context.runId}:`, err);
  }
}

/**
 * Marks runs that never reported back as failed. A serverless function that is
 * killed mid-run (timeout, deploy, OOM) leaves its row stuck on RUNNING, which
 * would otherwise read as "still going" forever in the dashboard.
 */
export async function failStaleSyncRuns(staleMinutes = 30): Promise<number> {
  const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000);
  try {
    const { count } = await prisma.syncRun.updateMany({
      where: { status: SyncRunStatus.RUNNING, startedAt: { lt: cutoff } },
      data: {
        status: SyncRunStatus.FAILED,
        errorMessage: `Run never reported completion within ${staleMinutes} minutes (function timed out or was interrupted)`,
        finishedAt: new Date(),
      },
    });
    if (count > 0) {
      console.log(`[SyncRun] Marked ${count} stale run(s) as failed`);
    }
    return count;
  } catch (err) {
    console.error("[SyncRun] Could not sweep stale runs:", err);
    return 0;
  }
}
