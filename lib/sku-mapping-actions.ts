"use server";

import { revalidatePath } from "next/cache";
import { IntegrationPlatform } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import { katana } from "@/lib/integrations/katana";
import { reverb } from "@/lib/integrations/reverb";
import { autoMatchByExactSkuCore } from "@/lib/sku-mapping-core";
import type { ExactMatchResultItem } from "@/lib/sku-mapping-core";

export type { ExactMatchResultItem } from "@/lib/sku-mapping-core";

async function requireAuth(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  return user?.id ?? null;
}

// ============================================
// CATALOG IMPORT (Katana variants + Reverb listings into staging)
// ============================================

export async function importCatalogs(): Promise<{
  data: { katanaVariants: number; reverbListings: number } | null;
  error: string | null;
}> {
  try {
    const userId = await requireAuth();
    if (!userId) return { data: null, error: "Not authenticated" };

    console.log("[SKUImport] Starting catalog import from Katana and Reverb...");

    // --- Katana products -> variants ---
    console.log("[SKUImport] Fetching Katana products...");
    let katanaCount = 0;
    let page = 1;
    let keepGoing = true;
    while (keepGoing) {
      const products = await katana.listProducts({ limit: 250, page });
      if (products.length === 0) break;
      for (const product of products) {
        for (const variant of product.variants ?? []) {
          await prisma.katanaCatalogVariant.upsert({
            where: { variantId: String(variant.id) },
            create: {
              variantId: String(variant.id),
              productId: String(product.id),
              productName: product.name,
              variantName: (variant.config_attributes ?? [])
                .map((a) => a.config_value)
                .join(" / ") || null,
              sku: variant.sku,
              isSellable: product.is_sellable,
            },
            update: {
              productId: String(product.id),
              productName: product.name,
              variantName: (variant.config_attributes ?? [])
                .map((a) => a.config_value)
                .join(" / ") || null,
              sku: variant.sku,
              isSellable: product.is_sellable,
              lastImportedAt: new Date(),
            },
          });
          katanaCount++;
        }
      }
      if (products.length < 250) keepGoing = false;
      else page++;
    }
    console.log(`[SKUImport] Imported ${katanaCount} Katana variants`);

    // --- Reverb listings ---
    console.log("[SKUImport] Fetching Reverb listings...");
    let reverbCount = 0;
    let rPage = 1;
    let rTotalPages = 1;
    do {
      const resp = await reverb.listMyListings({ page: rPage, perPage: 50, state: "all" });
      rTotalPages = resp.total_pages ?? 1;
      for (const l of resp.listings ?? []) {
        await prisma.reverbCatalogListing.upsert({
          where: { listingId: String(l.id) },
          create: {
            listingId: String(l.id),
            title: l.title,
            make: l.make,
            model: l.model,
            finish: (l as { finish?: string }).finish ?? null,
            state: l.state?.slug ?? null,
            inventory: l.inventory ?? null,
            hasInventory: l.has_inventory ?? null,
            sku: l.sku,
          },
          update: {
            title: l.title,
            make: l.make,
            model: l.model,
            finish: (l as { finish?: string }).finish ?? null,
            state: l.state?.slug ?? null,
            inventory: l.inventory ?? null,
            hasInventory: l.has_inventory ?? null,
            sku: l.sku,
            lastImportedAt: new Date(),
          },
        });
        reverbCount++;
      }
      rPage++;
    } while (rPage <= rTotalPages);
    console.log(`[SKUImport] Imported ${reverbCount} Reverb listings`);

    revalidatePath("/dashboard/sku-mapping");
    return {
      data: { katanaVariants: katanaCount, reverbListings: reverbCount },
      error: null,
    };
  } catch (error) {
    console.error("[SKUImport] Import failed:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Import failed",
    };
  }
}

// ============================================
// AUTO-MATCH BY EXACT SKU
// ============================================

/**
 * Creates mappings where a Katana variant SKU exactly equals a Reverb listing
 * SKU. This is the authoritative matching strategy now that the client
 * maintains canonical SKUs on Reverb. Only unambiguous cases are mapped:
 *   - canonical SKU not already mapped
 *   - a single live (or, failing that, single draft) Reverb listing shares the SKU
 * Everything else is reported but left untouched. Reverb "unique" listings
 * (has_inventory = false) are excluded from the candidate pool.
 */
export async function autoMatchByExactSku(): Promise<{
  data: { created: number; ambiguous: number; skipped: number; items: ExactMatchResultItem[] } | null;
  error: string | null;
}> {
  try {
    const userId = await requireAuth();
    if (!userId) return { data: null, error: "Not authenticated" };

    const result = await autoMatchByExactSkuCore();

    revalidatePath("/dashboard/sku-mapping");
    return { data: result, error: null };
  } catch (error) {
    console.error("[SKUMapping] autoMatchByExactSku failed:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Auto-match failed",
    };
  }
}

// ============================================
// MAPPING CRUD
// ============================================

export async function createMapping(input: {
  katanaVariantId: string;
  reverbListingId: string;
}): Promise<{ data: { inventoryItemId: string } | null; error: string | null }> {
  try {
    const userId = await requireAuth();
    if (!userId) return { data: null, error: "Not authenticated" };

    console.log(
      `[SKUMapping] Creating mapping katana=${input.katanaVariantId} reverb=${input.reverbListingId}`
    );

    const [katanaVariant, reverbListing] = await Promise.all([
      prisma.katanaCatalogVariant.findUnique({
        where: { variantId: input.katanaVariantId },
      }),
      prisma.reverbCatalogListing.findUnique({
        where: { listingId: input.reverbListingId },
      }),
    ]);

    if (!katanaVariant) return { data: null, error: "Katana variant not found in staging" };
    if (!reverbListing) return { data: null, error: "Reverb listing not found in staging" };

    const canonicalSku =
      katanaVariant.sku || `KAT-${katanaVariant.variantId}`;

    // Guard against duplicate platform mappings.
    const existingKatana = await prisma.sKUMapping.findUnique({
      where: {
        platform_externalSku: {
          platform: IntegrationPlatform.KATANA,
          externalSku: canonicalSku,
        },
      },
    });
    if (existingKatana) {
      return { data: null, error: `Katana SKU ${canonicalSku} is already mapped` };
    }

    const reverbExternalSku = reverbListing.sku || `rev-${reverbListing.listingId}`;
    const existingReverb = await prisma.sKUMapping.findUnique({
      where: {
        platform_externalSku: {
          platform: IntegrationPlatform.REVERB,
          externalSku: reverbExternalSku,
        },
      },
    });
    if (existingReverb) {
      return { data: null, error: `Reverb listing ${reverbListing.listingId} is already mapped` };
    }

    const item = await prisma.inventoryItem.create({
      data: {
        sku: canonicalSku,
        name: katanaVariant.productName,
        skuMappings: {
          create: [
            {
              platform: IntegrationPlatform.KATANA,
               externalSku: canonicalSku,
              externalId: katanaVariant.variantId,
              externalName: katanaVariant.productName,
              isActive: true,
            },
            {
              platform: IntegrationPlatform.REVERB,
              externalSku: reverbExternalSku,
              externalId: reverbListing.listingId,
              externalName: reverbListing.title,
              isActive: true,
            },
          ],
        },
      },
    });

    revalidatePath("/dashboard/sku-mapping");
    return { data: { inventoryItemId: item.id }, error: null };
  } catch (error) {
    console.error("[SKUMapping] createMapping failed:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to create mapping",
    };
  }
}

export async function updateMapping(input: {
  inventoryItemId: string;
  reverbListingId: string;
}): Promise<{ data: boolean | null; error: string | null }> {
  try {
    const userId = await requireAuth();
    if (!userId) return { data: null, error: "Not authenticated" };

    console.log(
      `[SKUMapping] Updating mapping item=${input.inventoryItemId} -> reverb=${input.reverbListingId}`
    );

    const reverbListing = await prisma.reverbCatalogListing.findUnique({
      where: { listingId: input.reverbListingId },
    });
    if (!reverbListing) return { data: null, error: "Reverb listing not found in staging" };

    const reverbExternalSku = reverbListing.sku || `rev-${reverbListing.listingId}`;

    const existing = await prisma.sKUMapping.findFirst({
      where: {
        inventoryItemId: input.inventoryItemId,
        platform: IntegrationPlatform.REVERB,
      },
    });

    if (existing) {
      await prisma.sKUMapping.update({
        where: { id: existing.id },
        data: {
          externalSku: reverbExternalSku,
          externalId: reverbListing.listingId,
          externalName: reverbListing.title,
          isActive: true,
        },
      });
    } else {
      await prisma.sKUMapping.create({
        data: {
          inventoryItemId: input.inventoryItemId,
          platform: IntegrationPlatform.REVERB,
          externalSku: reverbExternalSku,
          externalId: reverbListing.listingId,
          externalName: reverbListing.title,
          isActive: true,
        },
      });
    }

    revalidatePath("/dashboard/sku-mapping");
    return { data: true, error: null };
  } catch (error) {
    console.error("[SKUMapping] updateMapping failed:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to update mapping",
    };
  }
}

export async function deleteMapping(inventoryItemId: string): Promise<{
  data: boolean | null;
  error: string | null;
}> {
  try {
    const userId = await requireAuth();
    if (!userId) return { data: null, error: "Not authenticated" };

    console.log(`[SKUMapping] Deleting mapping for item ${inventoryItemId}`);
    await prisma.inventoryItem.delete({ where: { id: inventoryItemId } });

    revalidatePath("/dashboard/sku-mapping");
    return { data: true, error: null };
  } catch (error) {
    console.error("[SKUMapping] deleteMapping failed:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to delete mapping",
    };
  }
}

// ============================================
// FETCH MAPPING DATA (existing + unmapped staging)
// ============================================

export interface MappingRow {
  inventoryItemId: string;
  canonicalSku: string;
  name: string;
  katanaVariantId: string | null;
  katanaProductId: string | null;
  katanaSku: string | null;
  reverbListingId: string | null;
  reverbSku: string | null;
  reverbTitle: string | null;
  reverbState: string | null;
  needsReview: boolean;
  reviewReason: string | null;
}

export interface UnmappedKatana {
  variantId: string;
  productId: string | null;
  productName: string;
  variantName: string | null;
  sku: string | null;
}

export interface UnmappedReverb {
  listingId: string;
  title: string;
  state: string | null;
  inventory: number | null;
}

export interface SuggestedMatch {
  katanaVariantId: string;
  katanaProductId: string | null;
  katanaLabel: string;
  reverbListingId: string;
  reverbTitle: string;
  score: number;
}

export async function fetchMappingData(): Promise<{
  data: {
    mappings: MappingRow[];
    unmappedKatana: UnmappedKatana[];
    unmappedReverb: UnmappedReverb[];
    katanaImported: number;
    reverbImported: number;
  } | null;
  error: string | null;
}> {
  try {
    console.log("[SKUMapping] Fetching mapping data...");

    const [items, katanaCatalog, reverbCatalog] = await Promise.all([
      prisma.inventoryItem.findMany({
        include: { skuMappings: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.katanaCatalogVariant.findMany({ orderBy: { productName: "asc" } }),
      prisma.reverbCatalogListing.findMany({ orderBy: { title: "asc" } }),
    ]);

    const productIdByVariantId = new Map(
      katanaCatalog.map((v) => [v.variantId, v.productId])
    );
    const reverbByListingId = new Map(
      reverbCatalog.map((l) => [l.listingId, l])
    );

    const mappings: MappingRow[] = items.map((item) => {
      const k = item.skuMappings.find((m) => m.platform === IntegrationPlatform.KATANA);
      const r = item.skuMappings.find((m) => m.platform === IntegrationPlatform.REVERB);

      // Validate the Reverb side against the latest imported catalog so we can
      // flag mappings that drifted (listing sold/ended, or SKU reassigned).
      const staged = r?.externalId ? reverbByListingId.get(r.externalId) : null;
      const reverbState = staged?.state ?? null;
      let needsReview = false;
      let reviewReason: string | null = null;
      if (r?.externalId) {
        if (!staged) {
          needsReview = true;
          reviewReason = "Reverb listing not found in latest import";
        } else if (staged.state === "sold" || staged.state === "ended") {
          needsReview = true;
          reviewReason = `Reverb listing is ${staged.state}`;
        } else if (staged.sku && staged.sku !== item.sku) {
          needsReview = true;
          reviewReason = `Reverb SKU is now ${staged.sku} (reassigned)`;
        }
      }

      return {
        inventoryItemId: item.id,
        canonicalSku: item.sku,
        name: item.name,
        katanaVariantId: k?.externalId ?? null,
        katanaProductId: k?.externalId ? productIdByVariantId.get(k.externalId) ?? null : null,
        katanaSku: k?.externalSku ?? null,
        reverbListingId: r?.externalId ?? null,
        reverbSku: r?.externalSku ?? null,
        reverbTitle: r?.externalName ?? null,
        reverbState,
        needsReview,
        reviewReason,
      };
    });

    const mappedKatanaIds = new Set(
      mappings.map((m) => m.katanaVariantId).filter(Boolean) as string[]
    );
    const mappedReverbIds = new Set(
      mappings.map((m) => m.reverbListingId).filter(Boolean) as string[]
    );

    const unmappedKatana: UnmappedKatana[] = katanaCatalog
      .filter((v) => !mappedKatanaIds.has(v.variantId))
      .map((v) => ({
        variantId: v.variantId,
        productId: v.productId,
        productName: v.productName,
        variantName: v.variantName,
        sku: v.sku,
      }));

    // Exclude Reverb "unique" (one-of-a-kind) listings (has_inventory = false)
    // from the mapping pool. Null = unknown, so it stays available.
    const unmappedReverb: UnmappedReverb[] = reverbCatalog
      .filter((l) => !mappedReverbIds.has(l.listingId) && l.hasInventory !== false)
      .map((l) => ({
        listingId: l.listingId,
        title: l.title,
        state: l.state,
        inventory: l.inventory,
      }));

    return {
      data: {
        mappings,
        unmappedKatana,
        unmappedReverb,
        katanaImported: katanaCatalog.length,
        reverbImported: reverbCatalog.length,
      },
      error: null,
    };
  } catch (error) {
    console.error("[SKUMapping] fetchMappingData failed:", error);
    return { data: null, error: "Failed to fetch mapping data" };
  }
}

// ============================================
// AUTO-SUGGEST (fuzzy match unmapped Katana <-> Reverb)
// ============================================

const STOP_WORDS = new Set([
  "ciari",
  "travel",
  "guitars",
  "guitar",
  "with",
  "free",
  "backpack",
  "the",
  "and",
  "for",
  "signature",
]);

function tokenize(input: string): Set<string> {
  return new Set(
    input
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOP_WORDS.has(t) && !/^\d{4}$/.test(t))
  );
}

function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  // Overlap coefficient relative to the smaller set (better for short Katana names).
  return intersection / Math.min(a.size, b.size);
}

export async function autoSuggestMatches(): Promise<{
  data: SuggestedMatch[] | null;
  error: string | null;
}> {
  try {
    const userId = await requireAuth();
    if (!userId) return { data: null, error: "Not authenticated" };

    console.log("[SKUMapping] Computing auto-suggested matches...");
    const { data, error } = await fetchMappingData();
    if (error || !data) return { data: null, error: error ?? "No data" };

    const reverbTokenized = data.unmappedReverb.map((r) => ({
      ...r,
      tokens: tokenize(r.title),
    }));

    const usedReverb = new Set<string>();
    const suggestions: SuggestedMatch[] = [];

    for (const k of data.unmappedKatana) {
      const kLabel = [k.productName, k.variantName].filter(Boolean).join(" ");
      const kTokens = tokenize(kLabel);

      let best: { listing: (typeof reverbTokenized)[number]; score: number } | null = null;
      for (const r of reverbTokenized) {
        if (usedReverb.has(r.listingId)) continue;
        const score = similarity(kTokens, r.tokens);
        if (!best || score > best.score) best = { listing: r, score };
      }

      if (best && best.score >= 0.5) {
        usedReverb.add(best.listing.listingId);
        suggestions.push({
          katanaVariantId: k.variantId,
          katanaProductId: k.productId,
          katanaLabel: kLabel || k.sku || k.variantId,
          reverbListingId: best.listing.listingId,
          reverbTitle: best.listing.title,
          score: Math.round(best.score * 100) / 100,
        });
      }
    }

    suggestions.sort((a, b) => b.score - a.score);
    console.log(`[SKUMapping] Produced ${suggestions.length} suggestions`);
    return { data: suggestions, error: null };
  } catch (error) {
    console.error("[SKUMapping] autoSuggestMatches failed:", error);
    return { data: null, error: "Failed to compute suggestions" };
  }
}
