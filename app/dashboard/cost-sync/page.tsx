import { fetchInventoryItems, fetchSyncConfigurations } from "@/lib/fetchers";
import { CostSyncClient } from "./client";

export default async function CostSyncPage() {
  const [itemsResult, configsResult] = await Promise.all([
    fetchInventoryItems(),
    fetchSyncConfigurations(),
  ]);

  return (
    <CostSyncClient
      inventoryItems={itemsResult.data}
      syncConfigs={configsResult.data}
      error={itemsResult.error || configsResult.error}
    />
  );
}
