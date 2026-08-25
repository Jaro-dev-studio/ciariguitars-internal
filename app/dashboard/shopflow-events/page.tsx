import { headers } from "next/headers";
import { fetchShopFlowEvents, fetchShopFlowWorkOrders } from "@/lib/fetchers";
import {
  parseShopFlowEventFilters,
  SHOPFLOW_WEBHOOK_PATH,
} from "@/config/shopflow-events";
import { ShopFlowWorkOrders } from "@/components/shopflow/shopflow-work-orders";
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

  const [eventsResult, workOrderResult, endpointUrl] = await Promise.all([
    fetchShopFlowEvents(filters),
    fetchShopFlowWorkOrders(),
    resolveEndpointUrl(),
  ]);

  const page = eventsResult.data;
  const workOrderData = workOrderResult.data;

  const workOrders = (workOrderData?.workOrders ?? []).map((order) => {
    const summary = order.resolutionSummary as {
      resolved?: unknown[];
      unresolved?: unknown[];
      finishedGood?: { detail?: string };
    } | null;

    return {
      invoiceId: order.invoiceId,
      instrumentType: order.instrumentType,
      instrumentName: order.instrumentName,
      serialNumber: order.serialNumber,
      model: order.model,
      finish: order.finish,
      orientation: order.orientation,
      resolvedSku: order.resolvedSku,
      status: order.status,
      blockedReason: order.blockedReason,
      deliveryCount: order.deliveryCount,
      stockAdjustmentId: order.stockAdjustmentId,
      lastSeenAt: order.lastSeenAt.toISOString(),
      partsResolved: summary?.resolved?.length ?? 0,
      partsUnresolved: summary?.unresolved?.length ?? 0,
      finishedGoodDetail: summary?.finishedGood?.detail ?? null,
    };
  });

  return (
    <div className="flex flex-col gap-8">
      <ShopFlowWorkOrders
        workOrders={workOrders}
        statusCounts={workOrderData?.statusCounts ?? {}}
        unmappedParts={workOrderData?.unmappedParts ?? []}
      />
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
    </div>
  );
}
