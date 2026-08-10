import { headers } from "next/headers";
import { fetchShopFlowEvents } from "@/lib/fetchers";
import {
  parseShopFlowEventFilters,
  SHOPFLOW_WEBHOOK_PATH,
} from "@/config/shopflow-events";
import { ShopFlowEventsClient } from "./client";

interface ShopFlowEventsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Builds the absolute URL to hand to Shop Flow, whatever host we are on. */
async function resolveEndpointUrl(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) return SHOPFLOW_WEBHOOK_PATH;

  const protocol =
    headerList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");

  return `${protocol}://${host}${SHOPFLOW_WEBHOOK_PATH}`;
}

export default async function ShopFlowEventsPage({
  searchParams,
}: ShopFlowEventsPageProps) {
  const params = await searchParams;
  const filters = parseShopFlowEventFilters(params);

  const [eventsResult, endpointUrl] = await Promise.all([
    fetchShopFlowEvents(filters),
    resolveEndpointUrl(),
  ]);

  const page = eventsResult.data;

  return (
    <ShopFlowEventsClient
      events={(page?.events ?? []).map((event) => ({
        id: event.id,
        status: event.status,
        details: event.details,
        errorMessage: event.errorMessage,
        payload: event.newValue,
        createdAt: event.createdAt.toISOString(),
        runId: event.runId,
        runTrigger: event.run?.trigger ?? null,
      }))}
      total={page?.total ?? 0}
      currentPage={page?.page ?? 1}
      pageSize={page?.pageSize ?? 50}
      totalPages={page?.totalPages ?? 1}
      statusCounts={page?.statusCounts ?? {}}
      allTimeTotal={page?.allTimeTotal ?? 0}
      last24hTotal={page?.last24hTotal ?? 0}
      lastReceivedAt={page?.lastReceivedAt?.toISOString() ?? null}
      endpointUrl={endpointUrl}
      filters={filters}
      error={eventsResult.error}
    />
  );
}
