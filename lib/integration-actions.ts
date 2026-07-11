"use server";

import { revalidatePath } from "next/cache";
import { IntegrationPlatform } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import { getIntegrationConfig } from "@/lib/integrations/config";
import { katana } from "@/lib/integrations/katana";
import { reverb } from "@/lib/integrations/reverb";
import {
  runKatanaToReverbSync,
  previewKatanaToReverbSync,
  refreshInventorySnapshot,
  type ReverbSyncPlan,
} from "@/lib/integrations/inventory-sync";
import { pollReverbOrders } from "@/lib/integrations/sale-handler";
import { touchIntegrationLastSync } from "@/lib/integrations/sync-logger";
import { cleanupAlertsCore, type AlertCleanupResult } from "@/lib/integrations/alert-maintenance";

async function requireAuth(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  return user?.id ?? null;
}

export interface ConnectionStatus {
  platform: IntegrationPlatform;
  configured: boolean;
  ok: boolean;
  detail: string;
  writesEnabled: boolean;
  lastSyncAt: string | null;
}

export async function testConnections(): Promise<{
  data: ConnectionStatus[] | null;
  error: string | null;
}> {
  try {
    const userId = await requireAuth();
    if (!userId) return { data: null, error: "Not authenticated" };

    console.log("[IntegrationActions] Testing platform connections...");
    const config = getIntegrationConfig();

    const connections = await prisma.integrationConnection.findMany();
    const lastSyncByPlatform = new Map(
      connections.map((c) => [c.platform, c.lastSyncAt])
    );

    const statuses: ConnectionStatus[] = [];

    // Katana
    if (config.katana.isConfigured) {
      console.log("[IntegrationActions] Pinging Katana...");
      const ping = await katana.ping();
      statuses.push({
        platform: IntegrationPlatform.KATANA,
        configured: true,
        ok: ping.ok,
        detail: ping.ok
          ? `Connected (sample products: ${ping.productCount ?? 0})`
          : ping.error ?? "Connection failed",
        writesEnabled: config.flags.katanaWritesEnabled,
        lastSyncAt: lastSyncByPlatform.get(IntegrationPlatform.KATANA)?.toISOString() ?? null,
      });
      if (ping.ok) await touchIntegrationLastSync(IntegrationPlatform.KATANA, true);
    } else {
      statuses.push({
        platform: IntegrationPlatform.KATANA,
        configured: false,
        ok: false,
        detail: "KATANA_API_KEY not set",
        writesEnabled: config.flags.katanaWritesEnabled,
        lastSyncAt: null,
      });
    }

    // Reverb
    if (config.reverb.isConfigured) {
      console.log("[IntegrationActions] Pinging Reverb...");
      const ping = await reverb.ping();
      statuses.push({
        platform: IntegrationPlatform.REVERB,
        configured: true,
        ok: ping.ok,
        detail: ping.ok
          ? `Connected${ping.shopName ? ` (${ping.shopName})` : ""}`
          : ping.error ?? "Connection failed",
        writesEnabled: config.flags.reverbWritesEnabled,
        lastSyncAt: lastSyncByPlatform.get(IntegrationPlatform.REVERB)?.toISOString() ?? null,
      });
      if (ping.ok) await touchIntegrationLastSync(IntegrationPlatform.REVERB, true);
    } else {
      statuses.push({
        platform: IntegrationPlatform.REVERB,
        configured: false,
        ok: false,
        detail: "REVERB_PERSONAL_ACCESS_TOKEN not set",
        writesEnabled: config.flags.reverbWritesEnabled,
        lastSyncAt: null,
      });
    }

    // Shop Flow (pending GitSuite endpoints)
    statuses.push({
      platform: IntegrationPlatform.SHOPFLOW,
      configured: config.shopflow.isConfigured,
      ok: false,
      detail: config.shopflow.isConfigured
        ? "Configured (client not yet implemented)"
        : "Pending GitSuite endpoints",
      writesEnabled: config.flags.shopflowWritesEnabled,
      lastSyncAt: lastSyncByPlatform.get(IntegrationPlatform.SHOPFLOW)?.toISOString() ?? null,
    });

    revalidatePath("/dashboard/integrations");
    return { data: statuses, error: null };
  } catch (error) {
    console.error("[IntegrationActions] testConnections failed:", error);
    return { data: null, error: "Failed to test connections" };
  }
}

export async function dismissAlert(alertId: string): Promise<{
  data: boolean | null;
  error: string | null;
}> {
  try {
    const userId = await requireAuth();
    if (!userId) return { data: null, error: "Not authenticated" };

    await prisma.alert.update({
      where: { id: alertId },
      data: { isDismissed: true, isRead: true },
    });

    revalidatePath("/dashboard/sync-logs");
    return { data: true, error: null };
  } catch (error) {
    console.error("[IntegrationActions] dismissAlert failed:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to dismiss alert",
    };
  }
}

export async function cleanupAlerts(): Promise<{
  data: AlertCleanupResult | null;
  error: string | null;
}> {
  try {
    const userId = await requireAuth();
    if (!userId) return { data: null, error: "Not authenticated" };

    console.log("[IntegrationActions] Cleaning up alerts...");
    const result = await cleanupAlertsCore();

    revalidatePath("/dashboard/sync-logs");
    revalidatePath("/dashboard");
    return { data: result, error: null };
  } catch (error) {
    console.error("[IntegrationActions] cleanupAlerts failed:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to clean up alerts",
    };
  }
}

export async function previewReverbSync(): Promise<{
  data: ReverbSyncPlan | null;
  error: string | null;
}> {
  try {
    const userId = await requireAuth();
    if (!userId) return { data: null, error: "Not authenticated" };

    console.log("[IntegrationActions] Dry-run preview requested");
    const locationId = process.env.KATANA_DEFAULT_LOCATION_ID;
    const plan = await previewKatanaToReverbSync({
      locationIds: locationId ? [Number(locationId)] : undefined,
    });

    return { data: plan, error: null };
  } catch (error) {
    console.error("[IntegrationActions] previewReverbSync failed:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Preview failed",
    };
  }
}

export async function refreshInventorySnapshotNow(): Promise<{
  data: Awaited<ReturnType<typeof refreshInventorySnapshot>> | null;
  error: string | null;
}> {
  try {
    const userId = await requireAuth();
    if (!userId) return { data: null, error: "Not authenticated" };

    console.log("[IntegrationActions] Inventory snapshot refresh requested (read-only)");
    const locationId = process.env.KATANA_DEFAULT_LOCATION_ID;
    const result = await refreshInventorySnapshot({
      locationIds: locationId ? [Number(locationId)] : undefined,
    });

    revalidatePath("/dashboard/inventory-sync");
    return { data: result, error: null };
  } catch (error) {
    console.error("[IntegrationActions] refreshInventorySnapshotNow failed:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Refresh failed",
    };
  }
}

export async function runReverbSyncNow(): Promise<{
  data: Awaited<ReturnType<typeof runKatanaToReverbSync>> | null;
  error: string | null;
}> {
  try {
    const userId = await requireAuth();
    if (!userId) return { data: null, error: "Not authenticated" };

    const { flags } = getIntegrationConfig();
    if (flags.dryRun) {
      console.log("[IntegrationActions] Apply blocked - SYNC_DRY_RUN is on");
      return {
        data: null,
        error: "Dry run is enabled (SYNC_DRY_RUN). Use Preview, or disable dry run to apply changes.",
      };
    }

    console.log("[IntegrationActions] Manual Katana -> Reverb sync triggered");
    const locationId = process.env.KATANA_DEFAULT_LOCATION_ID;
    const result = await runKatanaToReverbSync({
      locationIds: locationId ? [Number(locationId)] : undefined,
    });

    revalidatePath("/dashboard/inventory-sync");
    revalidatePath("/dashboard/sync-logs");
    return { data: result, error: null };
  } catch (error) {
    console.error("[IntegrationActions] runReverbSyncNow failed:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Sync failed",
    };
  }
}

export async function pollReverbSalesNow(): Promise<{
  data: { processed: number } | null;
  error: string | null;
}> {
  try {
    const userId = await requireAuth();
    if (!userId) return { data: null, error: "Not authenticated" };

    console.log("[IntegrationActions] Manual Reverb order poll triggered");
    const results = await pollReverbOrders({ sinceHours: 72 });

    revalidatePath("/dashboard/sync-logs");
    return { data: { processed: results.length }, error: null };
  } catch (error) {
    console.error("[IntegrationActions] pollReverbSalesNow failed:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Order poll failed",
    };
  }
}

export async function registerWebhooks(baseUrl: string): Promise<{
  data: { katana: string[]; reverb: string[] } | null;
  error: string | null;
}> {
  try {
    const userId = await requireAuth();
    if (!userId) return { data: null, error: "Not authenticated" };

    if (!baseUrl || !baseUrl.startsWith("http")) {
      return { data: null, error: "A valid public base URL is required" };
    }

    console.log("[IntegrationActions] Registering webhooks against", baseUrl);
    const config = getIntegrationConfig();
    const registered = { katana: [] as string[], reverb: [] as string[] };

    if (config.katana.isConfigured) {
      const events = [
        "current_inventory.product_updated",
        "current_inventory.product_out_of_stock",
      ];
      const url = `${baseUrl.replace(/\/$/, "")}/api/webhooks/katana`;
      await katana.registerWebhook({
        url,
        subscribed_events: events,
        description: "Ciari inventory sync",
      });
      registered.katana = events;
    }

    if (config.reverb.isConfigured) {
      const url = `${baseUrl.replace(/\/$/, "")}/api/webhooks/reverb`;
      for (const topic of ["orders/created", "listings/update"]) {
        try {
          await reverb.registerWebhook({ url, topic });
          registered.reverb.push(topic);
        } catch (err) {
          console.warn(
            `[IntegrationActions] Reverb webhook topic ${topic} failed:`,
            err instanceof Error ? err.message : err
          );
        }
      }
    }

    return { data: registered, error: null };
  } catch (error) {
    console.error("[IntegrationActions] registerWebhooks failed:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Webhook registration failed",
    };
  }
}
