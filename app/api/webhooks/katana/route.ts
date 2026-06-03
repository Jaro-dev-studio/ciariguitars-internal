import { NextRequest, NextResponse } from "next/server";
import { getIntegrationConfig } from "@/lib/integrations/config";
import { runKatanaToReverbSync } from "@/lib/integrations/inventory-sync";
import { IntegrationPlatform } from "@prisma/client";
import prisma from "@/lib/prisma";

export const maxDuration = 60;

interface KatanaWebhookPayload {
  resource_type?: string;
  action?: string;
  webhook_id?: number | string;
  object?: { id?: number | string; status?: string; href?: string };
}

/**
 * Katana inventory webhook. Fires on current_inventory.product_updated /
 * product_out_of_stock. We resolve the affected variant's SKU, find the mapped
 * canonical item, and re-run the Reverb sync for just that SKU.
 */
export async function POST(request: NextRequest) {
  try {
    const config = getIntegrationConfig();
    const payload = (await request.json()) as KatanaWebhookPayload;

    // Optional shared-secret verification via token query param.
    if (config.katana.webhookToken) {
      const token = new URL(request.url).searchParams.get("token");
      if (token !== config.katana.webhookToken) {
        console.warn("[KatanaWebhook] Rejected: invalid token");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    console.log(
      `[KatanaWebhook] Received ${payload.action ?? "unknown"} for ${payload.resource_type ?? "?"} ${payload.object?.id ?? ""}`
    );

    const variantId = payload.object?.id ? Number(payload.object.id) : null;
    if (!variantId) {
      return NextResponse.json({ data: { handled: false }, error: null });
    }

    // The inventory webhook object id refers to the variant; map it to a canonical SKU.
    const mapping = await prisma.sKUMapping.findFirst({
      where: { platform: IntegrationPlatform.KATANA, externalId: String(variantId) },
      include: { inventoryItem: { select: { sku: true } } },
    });
    const canonicalSku = mapping?.inventoryItem.sku ?? null;

    if (!canonicalSku) {
      console.log(
        `[KatanaWebhook] No mapping for Katana variant ${variantId}; ignoring`
      );
      return NextResponse.json({ data: { handled: false }, error: null });
    }

    console.log(`[KatanaWebhook] Re-syncing canonical SKU ${canonicalSku} to Reverb...`);
    const result = await runKatanaToReverbSync({ onlyCanonicalSkus: [canonicalSku] });

    return NextResponse.json({
      data: { handled: true, sku: canonicalSku, updated: result.updated, unpublished: result.unpublished },
      error: null,
    });
  } catch (error) {
    console.error("[KatanaWebhook] Error handling webhook:", error);
    // Return 200 so Katana does not endlessly retry on our parse errors; details are logged.
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Webhook error" },
      { status: 200 }
    );
  }
}
