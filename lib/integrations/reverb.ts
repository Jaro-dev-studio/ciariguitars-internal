import "server-only";

import { getIntegrationConfig, IntegrationError } from "./config";

export interface ReverbHalLink {
  href: string;
  method?: string;
}

export interface ReverbListing {
  id: string;
  make: string | null;
  model: string | null;
  title: string;
  sku: string | null;
  state: { slug: string; description: string } | null;
  price: { amount: string; currency: string } | null;
  inventory: number | null;
  has_inventory: boolean;
  offers_enabled?: boolean;
  shipping_profile_name?: string | null;
  ready_to_ship?: boolean;
  created_at: string;
  published_at: string | null;
  _links: {
    self?: ReverbHalLink;
    update?: ReverbHalLink;
    end?: ReverbHalLink;
    web?: ReverbHalLink;
    photo?: ReverbHalLink;
  };
}

/**
 * Reverb sell-side orders are single-line: each order object represents one
 * product sale with top-level `sku`, `product_id` (== the Reverb listing id),
 * `quantity` and `title`. There is no nested order_items array.
 */
export interface ReverbOrder {
  order_number: string;
  created_at: string;
  status: string;
  buyer_name?: string;
  sku: string | null;
  product_id: number | null;
  quantity: number;
  title?: string;
  total?: string | { amount: string; currency: string };
  shipping_address?: {
    name?: string;
    street_address?: string;
    locality?: string;
    region?: string;
    postal_code?: string;
    country_code?: string;
  };
  _links?: {
    self?: ReverbHalLink;
    listing?: ReverbHalLink;
  };
}

interface ReverbListingsResponse {
  listings: ReverbListing[];
  total: number;
  current_page: number;
  total_pages: number;
  _links?: { next?: ReverbHalLink };
}

interface ReverbOrdersResponse {
  orders: ReverbOrder[];
  total?: number;
  current_page?: number;
  total_pages?: number;
  _links?: { next?: ReverbHalLink };
}

export interface ReverbWebhookRegistration {
  id: string;
  url: string;
  topic: string;
  enabled?: boolean;
  _links?: { self?: ReverbHalLink };
}

class ReverbClient {
  private get config() {
    return getIntegrationConfig().reverb;
  }

  private get writesEnabled() {
    return getIntegrationConfig().flags.reverbWritesEnabled;
  }

  private async request<T>(
    pathOrUrl: string,
    init: RequestInit = {},
    { allowWrite = false }: { allowWrite?: boolean } = {}
  ): Promise<T> {
    if (!this.config.isConfigured) {
      throw new IntegrationError(
        "Reverb access token is not configured",
        "REVERB"
      );
    }

    const method = (init.method ?? "GET").toUpperCase();
    const isWrite = method !== "GET" && method !== "HEAD";

    if (isWrite && !this.writesEnabled && !allowWrite) {
      throw new IntegrationError(
        `Reverb write blocked by feature flag (${method} ${pathOrUrl})`,
        "REVERB"
      );
    }

    const url = pathOrUrl.startsWith("http")
      ? pathOrUrl
      : `${this.config.baseUrl}${pathOrUrl}`;

    const headers = new Headers(init.headers ?? {});
    headers.set("Authorization", `Bearer ${this.config.accessToken}`);
    headers.set("Accept", "application/hal+json");
    headers.set("Accept-Version", "3.0");
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/hal+json");
    }

    const response = await fetch(url, { ...init, headers, cache: "no-store" });

    if (!response.ok) {
      const body = await response.text();
      throw new IntegrationError(
        `Reverb ${method} ${pathOrUrl} failed: ${response.status} ${response.statusText} - ${body}`,
        "REVERB",
        response.status,
        body
      );
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  async ping(): Promise<{ ok: boolean; shopName?: string; error?: string }> {
    // Validate the token against an endpoint our read-only scope can reach.
    // /my/account requires extra scopes the listings token does not carry, so
    // hitting /my/listings both verifies auth and matches what we actually use.
    try {
      await this.request<ReverbListingsResponse>(
        "/my/listings?per_page=1&state=all"
      );
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async findListingBySku(
    sku: string,
    state: "all" | "live" | "draft" | "ended" = "all"
  ): Promise<ReverbListing | null> {
    const params = new URLSearchParams();
    params.set("sku", sku);
    params.set("state", state);
    const result = await this.request<ReverbListingsResponse>(
      `/my/listings?${params.toString()}`
    );
    return result.listings?.[0] ?? null;
  }

  async listMyListings(opts: {
    page?: number;
    perPage?: number;
    state?: "all" | "live" | "draft" | "ended";
  } = {}): Promise<ReverbListingsResponse> {
    const params = new URLSearchParams();
    params.set("page", String(opts.page ?? 1));
    params.set("per_page", String(opts.perPage ?? 50));
    params.set("state", opts.state ?? "all");
    return this.request<ReverbListingsResponse>(
      `/my/listings?${params.toString()}`
    );
  }

  async getListingByHref(href: string): Promise<ReverbListing> {
    return this.request<ReverbListing>(href);
  }

  async getOrderByHref(href: string): Promise<ReverbOrder> {
    return this.request<ReverbOrder>(href);
  }

  async updateListingInventory(
    listing: ReverbListing,
    payload: {
      inventory?: number;
      has_inventory?: boolean;
      offers_enabled?: boolean;
      publish?: boolean;
    }
  ): Promise<ReverbListing> {
    const href = listing._links?.self?.href;
    if (!href) {
      throw new IntegrationError(
        `Reverb listing ${listing.id} has no self link`,
        "REVERB"
      );
    }
    return this.request<ReverbListing>(href, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async unpublishListing(listing: ReverbListing): Promise<ReverbListing> {
    return this.updateListingInventory(listing, {
      inventory: 0,
      has_inventory: true,
      publish: false,
    });
  }

  async listOrders(opts: {
    page?: number;
    perPage?: number;
    status?: "all" | "unpaid" | "unshipped" | "shipped";
    createdSince?: string;
  } = {}): Promise<ReverbOrdersResponse> {
    const params = new URLSearchParams();
    params.set("page", String(opts.page ?? 1));
    params.set("per_page", String(opts.perPage ?? 50));
    if (opts.status) params.set("status", opts.status);
    if (opts.createdSince) params.set("created_after", opts.createdSince);
    return this.request<ReverbOrdersResponse>(
      `/my/orders/selling/all?${params.toString()}`
    );
  }

  async listWebhooks(): Promise<ReverbWebhookRegistration[]> {
    const result = await this.request<{
      registrations?: ReverbWebhookRegistration[];
    }>("/webhooks/registrations");
    return result.registrations ?? [];
  }

  async registerWebhook(payload: {
    url: string;
    topic: string;
  }): Promise<ReverbWebhookRegistration> {
    return this.request<ReverbWebhookRegistration>(
      "/webhooks/registrations",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      { allowWrite: true }
    );
  }
}

export const reverb = new ReverbClient();
