import { fetchIntegrations, fetchSyncConfigurations } from "@/lib/fetchers";
import { getIntegrationConfig } from "@/lib/integrations/config";
import { IntegrationsClient } from "./client";
import { LiveConnections } from "@/components/integrations/live-connections";

export default async function IntegrationsPage() {
  const [integrationsResult, configsResult] = await Promise.all([
    fetchIntegrations(),
    fetchSyncConfigurations(),
  ]);
  const { flags } = getIntegrationConfig();

  return (
    <div className="space-y-6">
      <LiveConnections dryRun={flags.dryRun} />
      <IntegrationsClient
        integrations={integrationsResult.data}
        syncConfigs={configsResult.data}
        error={integrationsResult.error || configsResult.error}
      />
    </div>
  );
}
