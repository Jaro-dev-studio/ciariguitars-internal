import { fetchProductionOrders } from "@/lib/fetchers";
import { ProductionClient } from "./client";

export default async function ProductionPage() {
  const { data: orders, error } = await fetchProductionOrders();

  return <ProductionClient orders={orders} error={error} />;
}
