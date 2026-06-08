import { fetchInventoryItems } from "@/lib/fetchers";
import { getIntegrationConfig } from "@/lib/integrations/config";
import { InventorySyncClient } from "./client";

export default async function InventorySyncPage() {
  const itemsResult = await fetchInventoryItems();
  const { flags } = getIntegrationConfig();

  return (
    <InventorySyncClient
      inventoryItems={itemsResult.data}
      error={itemsResult.error}
      dryRun={flags.dryRun}
      reverbWritesEnabled={flags.reverbWritesEnabled}
    />
  );
}
