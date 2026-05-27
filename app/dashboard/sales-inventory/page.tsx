import { fetchInventoryItems } from "@/lib/fetchers";
import { SalesInventoryClient } from "./client";

export default async function SalesInventoryPage() {
  const { data: items, error } = await fetchInventoryItems();

  return <SalesInventoryClient inventoryItems={items} error={error} />;
}
