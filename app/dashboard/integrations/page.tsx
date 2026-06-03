import { fetchIntegrations, fetchSyncConfigurations } from "@/lib/fetchers";
import { IntegrationsClient } from "./client";
import { LiveConnections } from "@/components/integrations/live-connections";

export default async function IntegrationsPage() {
  const [integrationsResult, configsResult] = await Promise.all([
    fetchIntegrations(),
    fetchSyncConfigurations(),
  ]);

  return (
    <div className="space-y-6">
      <LiveConnections />
      <IntegrationsClient
        integrations={integrationsResult.data}
        syncConfigs={configsResult.data}
        error={integrationsResult.error || configsResult.error}
      />
    </div>
  );
}
