import { fetchSyncLogs, fetchAlerts } from "@/lib/fetchers";
import { SyncLogsClient } from "./client";

export default async function SyncLogsPage() {
  const [logsResult, alertsResult] = await Promise.all([
    fetchSyncLogs({ limit: 100 }),
    fetchAlerts(),
  ]);

  return (
    <SyncLogsClient
      syncLogs={logsResult.data}
      alerts={alertsResult.data}
      error={logsResult.error || alertsResult.error}
    />
  );
}
