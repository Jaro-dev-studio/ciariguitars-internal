import { fetchMappingData } from "@/lib/sku-mapping-actions";
import { SKUMappingClient } from "./client";

export default async function SKUMappingPage() {
  const { data, error } = await fetchMappingData();

  return (
    <SKUMappingClient
      mappings={data?.mappings ?? []}
      unmappedKatana={data?.unmappedKatana ?? []}
      unmappedReverb={data?.unmappedReverb ?? []}
      katanaVariants={data?.katanaVariants ?? []}
      katanaImported={data?.katanaImported ?? 0}
      reverbImported={data?.reverbImported ?? 0}
      error={error}
    />
  );
}
