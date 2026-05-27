import { fetchInventoryItems, fetchSKUMappings } from "@/lib/fetchers";
import { ReverbSyncClient } from "./client";

export default async function ReverbSyncPage() {
  const [itemsResult, mappingsResult] = await Promise.all([
    fetchInventoryItems(),
    fetchSKUMappings(),
  ]);

  return (
    <ReverbSyncClient
      inventoryItems={itemsResult.data}
      skuMappings={mappingsResult.data}
      error={itemsResult.error || mappingsResult.error}
    />
  );
}
