import "server-only";

import { IntegrationPlatform } from "@prisma/client";
import prisma from "@/lib/prisma";

export interface ExactMatchResultItem {
  canonicalSku: string;
  reverbListingId: string;
  reverbTitle: string;
  state: string | null;
  status: "created" | "skipped-mapped" | "ambiguous";
  note: string | null;
}

export interface ExactMatchResult {
  created: number;
  ambiguous: number;
  skipped: number;
  items: ExactMatchResultItem[];
}

/**
 * Normalize a SKU for matching by stripping stray leading/trailing dashes and
 * surrounding whitespace, so a data-entry typo like `-CIARI-STD-OW-R` or
 * `CIARI-DUO-OW-R-P90V-` still matches its clean Katana counterpart. Internal
 * separators and casing are preserved. Returns "" if nothing is left.
 */
export function normalizeSku(sku: string): string {
  return sku.trim().replace(/^[-\s]+|[-\s]+$/g, "");
}

/**
 * Core exact-SKU auto-match. Creates mappings where a Katana variant SKU
 * exactly equals a Reverb listing SKU. This is the auth-free implementation
 * shared by the `autoMatchByExactSku` server action and internal tooling.
 *
 * Reverb "unique" (one-of-a-kind) listings (has_inventory = false) are never
 * eligible candidates - they are excluded from the matching pool entirely.
 * Throws on precondition failure (e.g. catalogs not imported yet).
 */
export async function autoMatchByExactSkuCore(): Promise<ExactMatchResult> {
  console.log("[SKUMapping] Auto-matching by exact SKU...");

  const [katanaCatalog, reverbCatalog, existingMappings] = await Promise.all([
    prisma.katanaCatalogVariant.findMany(),
    prisma.reverbCatalogListing.findMany(),
    prisma.sKUMapping.findMany(),
  ]);

  if (katanaCatalog.length === 0 || reverbCatalog.length === 0) {
    throw new Error("Import catalogs first, then auto-match");
  }

  const mappedKatanaSkus = new Set(
    existingMappings
      .filter((m) => m.platform === IntegrationPlatform.KATANA)
      .map((m) => m.externalSku)
  );
  const mappedReverbListingIds = new Set(
    existingMappings
      .filter((m) => m.platform === IntegrationPlatform.REVERB)
      .map((m) => m.externalId)
  );

  // Group Reverb listings by normalized SKU (skip blank SKUs). Normalizing
  // strips stray leading/trailing dashes so typo'd listings still match.
  const reverbBySku = new Map<string, typeof reverbCatalog>();
  for (const l of reverbCatalog) {
    if (!l.sku) continue;
    const key = normalizeSku(l.sku);
    if (!key) continue;
    const arr = reverbBySku.get(key) ?? [];
    arr.push(l);
    reverbBySku.set(key, arr);
  }

  console.log(
    `[SKUMapping] Scanning ${katanaCatalog.length} Katana variants against ${reverbBySku.size} distinct Reverb SKUs...`
  );

  const items: ExactMatchResultItem[] = [];
  let created = 0;
  let ambiguous = 0;
  let skipped = 0;

  for (const variant of katanaCatalog) {
    const sku = variant.sku;
    if (!sku) continue;
    if (mappedKatanaSkus.has(sku)) continue; // already mapped on Katana side

    // Skip Reverb "unique" (one-of-a-kind) listings: has_inventory = false.
    // These are excluded from the mapping pool. Look up by normalized SKU so
    // listings with a stray dash still match this variant.
    const candidates = (reverbBySku.get(normalizeSku(sku)) ?? []).filter(
      (l) => !mappedReverbListingIds.has(l.listingId) && l.hasInventory !== false
    );
    if (candidates.length === 0) continue;

    // Prefer live listings; fall back to drafts only if no live exists.
    const live = candidates.filter((l) => l.state === "live");
    const drafts = candidates.filter((l) => l.state === "draft");
    const pool = live.length > 0 ? live : drafts;

    if (pool.length !== 1) {
      ambiguous++;
      items.push({
        canonicalSku: sku,
        reverbListingId: pool[0]?.listingId ?? candidates[0].listingId,
        reverbTitle: pool[0]?.title ?? candidates[0].title,
        state: pool[0]?.state ?? candidates[0].state,
        status: "ambiguous",
        note:
          pool.length > 1
            ? `${pool.length} ${live.length > 0 ? "live" : "draft"} listings share this SKU`
            : "Only sold/ended listings share this SKU",
      });
      continue;
    }

    const match = pool[0];
    const reverbExternalSku = match.sku || `rev-${match.listingId}`;

    // Guard: this Reverb SKU might already be mapped to a different item.
    const reverbSkuTaken = existingMappings.some(
      (m) =>
        m.platform === IntegrationPlatform.REVERB &&
        m.externalSku === reverbExternalSku
    );
    if (reverbSkuTaken) {
      skipped++;
      items.push({
        canonicalSku: sku,
        reverbListingId: match.listingId,
        reverbTitle: match.title,
        state: match.state,
        status: "skipped-mapped",
        note: "Reverb SKU already mapped to another item",
      });
      continue;
    }

    await prisma.inventoryItem.create({
      data: {
        sku,
        name: variant.productName,
        skuMappings: {
          create: [
            {
              platform: IntegrationPlatform.KATANA,
              externalSku: sku,
              externalId: variant.variantId,
              externalName: variant.productName,
              isActive: true,
            },
            {
              platform: IntegrationPlatform.REVERB,
              externalSku: reverbExternalSku,
              externalId: match.listingId,
              externalName: match.title,
              isActive: true,
            },
          ],
        },
      },
    });
    mappedKatanaSkus.add(sku);
    mappedReverbListingIds.add(match.listingId);
    created++;
    items.push({
      canonicalSku: sku,
      reverbListingId: match.listingId,
      reverbTitle: match.title,
      state: match.state,
      status: "created",
      note: null,
    });
  }

  console.log(
    `[SKUMapping] Auto-match complete: ${created} created, ${ambiguous} ambiguous, ${skipped} skipped`
  );

  return { created, ambiguous, skipped, items };
}
