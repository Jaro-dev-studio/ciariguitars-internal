import {
  fetchSyncLogs,
  fetchAlerts,
  fetchSyncRuns,
  fetchSyncRunById,
} from "@/lib/fetchers";
import { parseSyncLogFilters, parseSyncRunFilters } from "@/config/sync-logs";
import { SyncLogsClient } from "./client";

interface SyncLogsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SyncLogsPage({ searchParams }: SyncLogsPageProps) {
  const params = await searchParams;
  const logFilters = parseSyncLogFilters(params);
  const runFilters = parseSyncRunFilters(params);

  const [logsResult, runsResult, alertsResult, scopedRunResult] = await Promise.all([
    fetchSyncLogs(logFilters),
    fetchSyncRuns(runFilters),
    fetchAlerts(),
    logFilters.runId
      ? fetchSyncRunById(logFilters.runId)
      : Promise.resolve({ data: null, error: null }),
  ]);

  return (
    <SyncLogsClient
      logPage={logsResult.data}
      runPage={runsResult.data}
      alerts={alertsResult.data}
      scopedRun={scopedRunResult.data}
      filters={logFilters}
      runFilters={runFilters}
      error={logsResult.error || runsResult.error || alertsResult.error}
    />
  );
}
