import { fetchInventoryItems } from "@/lib/fetchers";
import { getReverbLinkState } from "@/lib/integrations/reverb-link";
import { InventorySyncClient } from "./client";

export default async function InventorySyncPage() {
  const [itemsResult, link] = await Promise.all([fetchInventoryItems(), getReverbLinkState()]);

  return (
    <InventorySyncClient
      inventoryItems={itemsResult.data}
      error={itemsResult.error}
      link={link}
    />
  );
}
