/**
 * Shared configuration for the sync events dashboard. Lives outside the
 * fetchers module because that file is "use server" and may only export async
 * functions, and the client needs these values to build filter controls.
 */

/** Time windows offered in the UI. Anchored on the indexed `createdAt`. */
export const SYNC_LOG_RANGES = ["1h", "24h", "7d", "30d", "all"] as const;
export type SyncLogRange = (typeof SYNC_LOG_RANGES)[number];

export const RANGE_LABELS: Record<SyncLogRange, string> = {
  "1h": "Last hour",
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All time",
};

/**
 * The log table holds over a million rows, so an unbounded default would make
 * every visit scan the whole table. Seven days covers normal debugging.
 */
export const DEFAULT_RANGE: SyncLogRange = "7d";

export const SYNC_LOG_PAGE_SIZES = [25, 50, 100, 250] as const;
export const DEFAULT_PAGE_SIZE = 50;

export const SYNC_TYPE_LABELS: Record<string, string> = {
  INVENTORY_QUANTITY: "Inventory Qty",
  INVENTORY_COST: "Cost Sync",
  PRODUCTION_CONSUMPTION: "Production",
  ORDER_SYNC: "Order Sync",
  SKU_MAPPING: "SKU Mapping",
  LISTING_UPDATE: "Listing Update",
};

export const SOURCE_LABELS: Record<string, string> = {
  CRON: "Cron",
  WEBHOOK: "Webhook",
  MANUAL: "Manual",
  SYSTEM: "System",
};

export const STATUS_LABELS: Record<string, string> = {
  SUCCESS: "Success",
  FAILED: "Failed",
  SKIPPED: "Skipped",
  PARTIAL: "Partial",
  PENDING: "Pending",
};

export interface SyncLogFilters {
  search?: string;
  syncType?: string;
  platform?: string;
  status?: string;
  source?: string;
  runId?: string;
  /** "true" or "false"; anything else means no dry-run constraint. */
  dryRun?: string;
  range?: string;
  page?: number;
  pageSize?: number;
}

export interface SyncRunFilters {
  source?: string;
  trigger?: string;
  status?: string;
  range?: string;
  page?: number;
  pageSize?: number;
}

export function normalisePageSize(value: unknown): number {
  const parsed = Number(value);
  return SYNC_LOG_PAGE_SIZES.includes(parsed as (typeof SYNC_LOG_PAGE_SIZES)[number])
    ? parsed
    : DEFAULT_PAGE_SIZE;
}

/** Reads the dashboard's URL query string into typed filters. */
export function parseSyncLogFilters(
  searchParams: Record<string, string | string[] | undefined>
): SyncLogFilters {
  const single = (key: string): string | undefined => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  return {
    search: single("q"),
    syncType: single("type") ?? "all",
    platform: single("platform") ?? "all",
    status: single("status") ?? "all",
    source: single("source") ?? "all",
    runId: single("runId"),
    dryRun: single("dryRun") ?? "all",
    range: single("range") ?? DEFAULT_RANGE,
    page: Number(single("page") ?? 1),
    pageSize: normalisePageSize(single("pageSize")),
  };
}

export function parseSyncRunFilters(
  searchParams: Record<string, string | string[] | undefined>
): SyncRunFilters {
  const single = (key: string): string | undefined => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  return {
    source: single("runSource") ?? "all",
    trigger: single("trigger") ?? "all",
    status: single("runStatus") ?? "all",
    range: single("range") ?? DEFAULT_RANGE,
    page: Number(single("runPage") ?? 1),
    pageSize: normalisePageSize(single("pageSize")),
  };
}
