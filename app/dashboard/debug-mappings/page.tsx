import { runMappingDiagnostics } from "@/lib/sku-mapping-actions";
import { DebugMappingsClient } from "./client";

export default async function DebugMappingsPage() {
  const { data, error } = await runMappingDiagnostics();

  return <DebugMappingsClient initialData={data} initialError={error} />;
}
