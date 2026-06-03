import { fetchInventoryItems } from "@/lib/fetchers";
import { InventorySyncClient } from "./client";

export default async function InventorySyncPage() {
  const itemsResult = await fetchInventoryItems();

  return (
    <InventorySyncClient
      inventoryItems={itemsResult.data}
      error={itemsResult.error}
    />
  );
}
