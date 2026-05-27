import { fetchSKUMappings, fetchInventoryItems } from "@/lib/fetchers";
import { SKUMappingClient } from "./client";

export default async function SKUMappingPage() {
  const [mappingsResult, itemsResult] = await Promise.all([
    fetchSKUMappings(),
    fetchInventoryItems(),
  ]);

  return (
    <SKUMappingClient
      skuMappings={mappingsResult.data}
      inventoryItems={itemsResult.data}
      error={mappingsResult.error || itemsResult.error}
    />
  );
}
