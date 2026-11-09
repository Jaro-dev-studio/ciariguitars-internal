import { fetchIntegrations, fetchSyncConfigurations } from "@/lib/fetchers";
import { getReverbLinkState } from "@/lib/integrations/reverb-link";
import { IntegrationsClient } from "./client";
import { LiveConnections } from "@/components/integrations/live-connections";

export default async function IntegrationsPage() {
  const [integrationsResult, configsResult, link] = await Promise.all([
    fetchIntegrations(),
    fetchSyncConfigurations(),
    getReverbLinkState(),
  ]);

  return (
    <div className="space-y-6">
      <LiveConnections dryRun={!link.live} />
      <IntegrationsClient
        integrations={integrationsResult.data}
        syncConfigs={configsResult.data}
        error={integrationsResult.error || configsResult.error}
      />
    </div>
  );
}
