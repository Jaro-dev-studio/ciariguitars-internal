import { fetchInventoryItems, fetchIntegrations, fetchSyncConfigurations } from "@/lib/fetchers";
import { InventorySyncClient } from "./client";

export default async function InventorySyncPage() {
  const [itemsResult, integrationsResult, configsResult] = await Promise.all([
    fetchInventoryItems(),
    fetchIntegrations(),
    fetchSyncConfigurations(),
  ]);

  return (
    <InventorySyncClient
      inventoryItems={itemsResult.data}
      integrations={integrationsResult.data}
      syncConfigs={configsResult.data}
      error={itemsResult.error || integrationsResult.error || configsResult.error}
    />
  );
}
