import "server-only";

export interface IntegrationConfig {
  katana: {
    apiKey: string;
    baseUrl: string;
    webhookToken: string;
    isConfigured: boolean;
  };
  reverb: {
    accessToken: string;
    baseUrl: string;
    useSandbox: boolean;
    isConfigured: boolean;
  };
  shopflow: {
    apiKey: string;
    baseUrl: string;
    webhookSecret: string;
    isConfigured: boolean;
  };
  flags: {
    reverbWritesEnabled: boolean;
    katanaWritesEnabled: boolean;
    shopflowWritesEnabled: boolean;
  };
}

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "true" || value === "1";
}

export function getIntegrationConfig(): IntegrationConfig {
  const katanaApiKey = process.env.KATANA_API_KEY ?? "";
  const reverbToken = process.env.REVERB_PERSONAL_ACCESS_TOKEN ?? "";
  const reverbUseSandbox = bool(process.env.REVERB_USE_SANDBOX);
  const shopflowApiKey = process.env.SHOPFLOW_API_KEY ?? "";
  const shopflowBaseUrl = process.env.SHOPFLOW_API_BASE_URL ?? "";

  return {
    katana: {
      apiKey: katanaApiKey,
      baseUrl: process.env.KATANA_API_BASE_URL ?? "https://api.katanamrp.com/v1",
      webhookToken: process.env.KATANA_WEBHOOK_TOKEN ?? "",
      isConfigured: katanaApiKey.length > 0,
    },
    reverb: {
      accessToken: reverbToken,
      baseUrl:
        process.env.REVERB_API_BASE_URL ??
        (reverbUseSandbox
          ? "https://sandbox.reverb.com/api"
          : "https://api.reverb.com/api"),
      useSandbox: reverbUseSandbox,
      isConfigured: reverbToken.length > 0,
    },
    shopflow: {
      apiKey: shopflowApiKey,
      baseUrl: shopflowBaseUrl,
      webhookSecret: process.env.SHOPFLOW_WEBHOOK_SECRET ?? "",
      isConfigured: shopflowApiKey.length > 0 && shopflowBaseUrl.length > 0,
    },
    flags: {
      reverbWritesEnabled: bool(process.env.SYNC_REVERB_WRITES_ENABLED),
      katanaWritesEnabled: bool(process.env.SYNC_KATANA_WRITES_ENABLED),
      shopflowWritesEnabled: bool(process.env.SYNC_SHOPFLOW_WRITES_ENABLED),
    },
  };
}

export class IntegrationError extends Error {
  constructor(
    message: string,
    public readonly platform: "KATANA" | "REVERB" | "SHOPFLOW",
    public readonly status?: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "IntegrationError";
  }
}
