import { fetchShippingCarriers, fetchIntegrations } from "@/lib/fetchers";
import { ShippingClient } from "./client";

export default async function ShippingPage() {
  const [carriersResult, integrationsResult] = await Promise.all([
    fetchShippingCarriers(),
    fetchIntegrations(),
  ]);

  return (
    <ShippingClient
      carriers={carriersResult.data}
      integrations={integrationsResult.data}
      error={carriersResult.error || integrationsResult.error}
    />
  );
}
