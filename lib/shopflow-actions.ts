"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";
import { normalisePartCode } from "@/lib/shopflow/part-matching";
import { reprocessWorkOrder } from "@/lib/shopflow/process-work-order";

const EVENTS_PATH = "/dashboard/shopflow-events";

async function requireAuth(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  return user?.id ?? null;
}

/**
 * Points a Shop Flow part number at a Katana SKU, or marks it as never
 * consuming stock (packaging, tooling, option lines).
 *
 * The Katana variant is looked up here rather than taken on trust, so a mapping
 * can never reference a SKU that does not exist.
 */
export async function upsertShopFlowPartMapping(input: {
  shopflowPartId: string;
  partName?: string | null;
  katanaSku?: string | null;
  isIgnored?: boolean;
  notes?: string | null;
}): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const userId = await requireAuth();
    if (!userId) return { data: null, error: "Not authenticated" };

    const partId = input.shopflowPartId.trim();
    if (!partId) return { data: null, error: "Part id is required" };

    console.log(`[ShopFlowMapping] Upserting mapping for part ${partId}...`);

    let katanaSku: string | null = null;
    let katanaVariantId: string | null = null;

    if (!input.isIgnored && input.katanaSku?.trim()) {
      const wanted = input.katanaSku.trim();
      console.log(`[ShopFlowMapping] Verifying Katana SKU ${wanted}...`);
      const variant = await prisma.katanaCatalogVariant.findFirst({
        where: { normalisedSku: normalisePartCode(wanted) },
        select: { sku: true, variantId: true },
      });
      if (!variant?.sku) {
        return {
          data: null,
          error: `No Katana variant found for SKU "${wanted}". Import catalogs first if it is new.`,
        };
      }
      katanaSku = variant.sku;
      katanaVariantId = variant.variantId;
    }

    if (!input.isIgnored && !katanaSku) {
      return {
        data: null,
        error: "Provide a Katana SKU or mark the part as ignored",
      };
    }

    const row = await prisma.shopFlowPartMapping.upsert({
      where: { shopflowPartId: partId },
      create: {
        shopflowPartId: partId,
        partName: input.partName?.trim() || null,
        katanaSku,
        katanaVariantId,
        isIgnored: input.isIgnored ?? false,
        notes: input.notes?.trim() || null,
      },
      update: {
        partName: input.partName?.trim() || null,
        katanaSku,
        katanaVariantId,
        isIgnored: input.isIgnored ?? false,
        notes: input.notes?.trim() || null,
      },
      select: { id: true },
    });

    console.log(`[ShopFlowMapping] Mapping saved for part ${partId}`);
    revalidatePath(EVENTS_PATH);
    return { data: row, error: null };
  } catch (error) {
    console.error("[ShopFlowMapping] Failed to save mapping:", error);
    return { data: null, error: "Failed to save part mapping" };
  }
}

/**
 * Re-runs a stored work order, for use once its missing part mappings have been
 * filled in. Shop Flow only resends a work order when it is reopened, so
 * without this a blocked work order would never be retried.
 */
export async function reprocessShopFlowWorkOrder(
  invoiceId: string
): Promise<{ data: { status: string; unresolved: number } | null; error: string | null }> {
  try {
    const userId = await requireAuth();
    if (!userId) return { data: null, error: "Not authenticated" };

    console.log(`[ShopFlowMapping] Reprocessing work order ${invoiceId}...`);
    const { data, error } = await reprocessWorkOrder(invoiceId);
    if (error || !data) return { data: null, error: error ?? "Reprocess failed" };

    revalidatePath(EVENTS_PATH);
    return {
      data: { status: data.status, unresolved: data.parts.unresolved },
      error: null,
    };
  } catch (error) {
    console.error("[ShopFlowMapping] Reprocess failed:", error);
    return { data: null, error: "Failed to reprocess work order" };
  }
}
