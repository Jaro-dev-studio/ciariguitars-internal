import { fetchIntegrations, fetchSyncConfigurations } from "@/lib/fetchers";
import { IntegrationsClient } from "./client";

export default async function IntegrationsPage() {
  const [integrationsResult, configsResult] = await Promise.all([
    fetchIntegrations(),
    fetchSyncConfigurations(),
  ]);

  return (
    <IntegrationsClient
      integrations={integrationsResult.data}
      syncConfigs={configsResult.data}
      error={integrationsResult.error || configsResult.error}
    />
  );
}
