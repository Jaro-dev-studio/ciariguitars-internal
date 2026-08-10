/**
 * Configuration for the Shop Flow events dashboard, which reads back the
 * payloads captured by the `/api/webhooks/shopflow` receiver.
 *
 * Kept separate from the fetchers module because that file is "use server" and
 * may only export async functions, while the client needs these values to
 * build its filter controls.
 */

import { normalisePageSize } from "@/config/sync-logs";

export const SHOPFLOW_WEBHOOK_PATH = "/api/webhooks/shopflow";

/**
 * Deliveries are low volume compared with the sync log as a whole, so the
 * default window is wider than the one used on the sync events page.
 */
export const DEFAULT_SHOPFLOW_RANGE = "30d";

export interface ShopFlowEventFilters {
  search?: string;
  status?: string;
  range?: string;
  page?: number;
  pageSize?: number;
}

export function parseShopFlowEventFilters(
  searchParams: Record<string, string | string[] | undefined>
): ShopFlowEventFilters {
  const single = (key: string): string | undefined => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  return {
    search: single("q"),
    status: single("status") ?? "all",
    range: single("range") ?? DEFAULT_SHOPFLOW_RANGE,
    page: Number(single("page") ?? 1),
    pageSize: normalisePageSize(single("pageSize")),
  };
}
