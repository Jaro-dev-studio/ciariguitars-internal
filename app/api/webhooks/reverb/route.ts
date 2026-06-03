import { NextRequest, NextResponse } from "next/server";
import { reverb, type ReverbOrder } from "@/lib/integrations/reverb";
import { processReverbSale } from "@/lib/integrations/sale-handler";
import { runKatanaToReverbSync } from "@/lib/integrations/inventory-sync";

export const maxDuration = 60;

/**
 * Reverb webhook receiver. Handles two topics:
 *  - orders/created  -> decrement Katana stock for the sold line items
 *  - listings/update -> (informational) re-sync that listing's SKU
 *
 * Reverb HAL payloads embed a self link; for orders we fetch the full order to
 * get reliable line items before processing.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("[ReverbWebhook] Received payload keys:", Object.keys(body ?? {}));

    // Order webhook: payload contains an order number / product_id and/or self link.
    const orderNumber: string | undefined =
      body?.order_number ?? body?.order?.order_number;
    const selfHref: string | undefined =
      body?._links?.self?.href ?? body?.order?._links?.self?.href;
    const looksLikeOrder =
      orderNumber !== undefined ||
      body?.product_id !== undefined ||
      selfHref !== undefined;

    if (looksLikeOrder) {
      let order: ReverbOrder | null = null;

      // Prefer fetching the authoritative order via its self link.
      if (selfHref) {
        try {
          order = await reverb.getOrderByHref(selfHref);
        } catch (err) {
          console.warn("[ReverbWebhook] Failed to fetch order via self link:", err);
        }
      }

      // Fall back to the payload if it already carries the order fields.
      if (!order && (body?.product_id || body?.sku)) {
        order = body as ReverbOrder;
      }

      if (order && (order.product_id || order.sku)) {
        console.log(`[ReverbWebhook] Processing order ${order.order_number}`);
        const result = await processReverbSale(order, "webhook");
        return NextResponse.json({ data: { handled: true, order: result }, error: null });
      }

      console.log("[ReverbWebhook] Order payload lacked product info; ignoring");
      return NextResponse.json({ data: { handled: false }, error: null });
    }

    // Listing update webhook: trigger a reconcile (we push Katana -> Reverb).
    const listingId: string | undefined = body?.id ?? body?.listing?.id;
    if (listingId) {
      console.log(`[ReverbWebhook] listings/update for listing ${listingId}; reconciling`);
      await runKatanaToReverbSync({});
      return NextResponse.json({ data: { handled: true, reconciled: true }, error: null });
    }

    return NextResponse.json({ data: { handled: false }, error: null });
  } catch (error) {
    console.error("[ReverbWebhook] Error handling webhook:", error);
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Webhook error" },
      { status: 200 }
    );
  }
}
