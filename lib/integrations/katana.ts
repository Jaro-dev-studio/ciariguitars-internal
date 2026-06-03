import "server-only";

import { getIntegrationConfig, IntegrationError } from "./config";

export interface KatanaVariant {
  id: number;
  product_id: number;
  sku: string | null;
  sales_price: number | null;
  purchase_price: number | null;
  type: string;
  config_attributes?: Array<{ config_name: string; config_value: string }>;
  internal_barcode?: string | null;
  registered_barcode?: string | null;
  supplier_item_codes?: string[];
  default_cost?: number | null;
  average_cost?: number | null;
  created_at: string;
  updated_at: string;
}

export interface KatanaProduct {
  id: number;
  name: string;
  uom: string | null;
  category_name: string | null;
  is_sellable: boolean;
  is_producible: boolean;
  is_purchasable: boolean;
  is_auto_assembly: boolean;
  variants: KatanaVariant[];
  created_at: string;
  updated_at: string;
}

export interface KatanaInventory {
  variant_id: number;
  location_id: number;
  quantity_in_stock: string;
  quantity_committed: string;
  quantity_expected: string;
  quantity_missing_or_excess: string;
  value_in_stock: string;
  average_cost: string;
  stock_value: string;
}

export interface KatanaLocation {
  id: number;
  name: string;
  legal_name: string | null;
  address_id: number | null;
}

export interface KatanaSalesOrderRow {
  variant_id: number;
  quantity: number;
  price_per_unit?: number;
  tax_rate_id?: number | null;
}

export interface KatanaWebhookRegistration {
  id: number;
  url: string;
  token: string;
  enabled: boolean;
  subscribed_events: string[];
  description: string | null;
}

interface KatanaListResponse<T> {
  data: T[];
}

class KatanaClient {
  private get config() {
    return getIntegrationConfig().katana;
  }

  private get writesEnabled() {
    return getIntegrationConfig().flags.katanaWritesEnabled;
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    { allowWrite = false }: { allowWrite?: boolean } = {}
  ): Promise<T> {
    if (!this.config.isConfigured) {
      throw new IntegrationError(
        "Katana API key is not configured",
        "KATANA"
      );
    }

    const method = (init.method ?? "GET").toUpperCase();
    const isWrite = method !== "GET" && method !== "HEAD";

    if (isWrite && !this.writesEnabled && !allowWrite) {
      throw new IntegrationError(
        `Katana write blocked by feature flag (${method} ${path})`,
        "KATANA"
      );
    }

    const url = `${this.config.baseUrl}${path}`;
    const headers = new Headers(init.headers ?? {});
    headers.set("Authorization", `Bearer ${this.config.apiKey}`);
    headers.set("Accept", "application/json");
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(url, { ...init, headers, cache: "no-store" });

    if (!response.ok) {
      const body = await response.text();
      throw new IntegrationError(
        `Katana ${method} ${path} failed: ${response.status} ${response.statusText} - ${body}`,
        "KATANA",
        response.status,
        body
      );
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  async ping(): Promise<{ ok: boolean; productCount?: number; error?: string }> {
    try {
      const result = await this.request<KatanaListResponse<KatanaProduct>>(
        "/products?limit=1"
      );
      return { ok: true, productCount: result.data?.length ?? 0 };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async listLocations(): Promise<KatanaLocation[]> {
    const result = await this.request<KatanaListResponse<KatanaLocation>>(
      "/locations"
    );
    return result.data ?? [];
  }

  async listProducts(opts: {
    limit?: number;
    page?: number;
    isSellable?: boolean;
    updatedSince?: string;
  } = {}): Promise<KatanaProduct[]> {
    const params = new URLSearchParams();
    params.set("limit", String(opts.limit ?? 250));
    if (opts.page !== undefined) params.set("page", String(opts.page));
    if (opts.isSellable !== undefined)
      params.set("is_sellable", String(opts.isSellable));
    if (opts.updatedSince) params.set("updated_at_min", opts.updatedSince);
    const result = await this.request<KatanaListResponse<KatanaProduct>>(
      `/products?${params.toString()}`
    );
    return result.data ?? [];
  }

  async getInventoryForVariants(opts: {
    variantIds?: number[];
    locationIds?: number[];
    limit?: number;
    page?: number;
  } = {}): Promise<KatanaInventory[]> {
    const params = new URLSearchParams();
    params.set("limit", String(opts.limit ?? 250));
    if (opts.page !== undefined) params.set("page", String(opts.page));
    if (opts.variantIds?.length) {
      for (const id of opts.variantIds) params.append("variant_id", String(id));
    }
    if (opts.locationIds?.length) {
      for (const id of opts.locationIds) params.append("location_id", String(id));
    }
    const result = await this.request<KatanaListResponse<KatanaInventory>>(
      `/inventory?${params.toString()}`
    );
    return result.data ?? [];
  }

  async findVariantBySku(sku: string): Promise<KatanaVariant | null> {
    const params = new URLSearchParams();
    params.set("sku", sku);
    params.set("limit", "1");
    const result = await this.request<KatanaListResponse<KatanaVariant>>(
      `/variants?${params.toString()}`
    );
    return result.data?.[0] ?? null;
  }

  async createStockAdjustment(payload: {
    location_id: number;
    reason?: string;
    additional_info?: string;
    stock_adjustment_rows: Array<{
      variant_id: number;
      quantity: number;
      cost_per_unit?: number;
    }>;
  }): Promise<{ id: number }> {
    return this.request("/stock_adjustments", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async createSalesOrder(payload: {
    order_no: string;
    customer_id?: number;
    location_id: number;
    order_created_date?: string;
    delivery_date?: string;
    additional_info?: string;
    sales_order_rows: KatanaSalesOrderRow[];
    source?: string;
  }): Promise<{ id: number }> {
    return this.request("/sales_orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async listWebhooks(): Promise<KatanaWebhookRegistration[]> {
    const result = await this.request<
      KatanaListResponse<KatanaWebhookRegistration>
    >("/webhooks");
    return result.data ?? [];
  }

  async registerWebhook(payload: {
    url: string;
    subscribed_events: string[];
    description?: string;
  }): Promise<KatanaWebhookRegistration> {
    return this.request(
      "/webhooks",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      { allowWrite: true }
    );
  }
}

export const katana = new KatanaClient();

export function netAvailable(inv: KatanaInventory): number {
  const inStock = parseFloat(inv.quantity_in_stock || "0");
  const committed = parseFloat(inv.quantity_committed || "0");
  return Math.max(0, Math.floor(inStock - committed));
}
