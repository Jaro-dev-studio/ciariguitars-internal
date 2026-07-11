import "server-only";

import { IntegrationPlatform } from "@prisma/client";
import prisma from "@/lib/prisma";
import { normalizeSku } from "@/lib/sku-mapping-core";

export interface DiagnosticDuplicate {
  sku: string;
  variantCount: number;
}

/**
 * An unmapped Katana SKU whose matching, in-stock Reverb listing is already
 * linked to a *different* inventory item. These are the concrete, fixable
 * mis-mappings: the listing's SKU actually belongs to `katanaSku`, but it was
 * mapped to `ownerKatanaSku`. Surfacing the owner lets an admin re-point it.
 */
export interface MappingConflict {
  katanaVariantId: string;
  katanaSku: string;
  katanaProductId: string | null;
  katanaProductName: string;
  reverbListingId: string;
  reverbTitle: string;
  reverbSku: string | null;
  reverbState: string | null;
  ownerInventoryItemId: string;
  ownerName: string | null;
  ownerCanonicalSku: string | null;
  ownerKatanaSku: string | null;
  ownerKatanaProductId: string | null;
}

export interface MappingDiagnostics {
  generatedAt: string;
  katana: {
    totalVariants: number;
    withSku: number;
    blankSku: number;
    distinctSkus: number;
    duplicateSkuCount: number;
    duplicateSkus: DiagnosticDuplicate[];
  };
  reverb: {
    totalListings: number;
    uniqueExcluded: number;
    hasInventoryNull: number;
    syncable: number;
    syncableWithSku: number;
    syncableWithoutSku: number;
    distinctSyncableSkus: number;
  };
  mappings: {
    total: number;
    currentCatalogMapped: number;
    staleRows: number;
  };
  classification: {
    mappedLive: number;
    readyToMap: number;
    noReverbListing: number;
    onlySoldEnded: number;
    uniqueExcludedMatch: number;
    blockedByMapping: number;
    ambiguous: number;
  };
  noReverbSkus: string[];
  soldEndedSkus: string[];
  reverbSkusWithoutKatana: string[];
  conflicts: MappingConflict[];
}

function group<T>(items: T[], key: (i: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const i of items) {
    const k = key(i);
    if (!k) continue;
    const arr = map.get(k) ?? [];
    arr.push(i);
    map.set(k, arr);
  }
  return map;
}

/**
 * Reads the staging catalogs + existing mappings and explains exactly why the
 * mapped count sits where it does: how many Katana variants can match, which
 * had a stray-dash SKU that is now auto-corrected, which have no eligible
 * Reverb listing, etc. Pure read-only analysis over the same normalized-SKU
 * logic the auto-matcher uses.
 */
export async function computeMappingDiagnostics(): Promise<MappingDiagnostics> {
  console.log("[MappingDiagnostics] Loading staging catalogs and mappings...");
  const [katana, reverb, mappings] = await Promise.all([
    prisma.katanaCatalogVariant.findMany(),
    prisma.reverbCatalogListing.findMany(),
    prisma.sKUMapping.findMany(),
  ]);

  console.log(
    `[MappingDiagnostics] Loaded ${katana.length} Katana variants, ${reverb.length} Reverb listings, ${mappings.length} mapping rows`
  );

  const katanaWithSku = katana.filter((v) => v.sku);
  const katanaBySku = group(katanaWithSku, (v) => v.sku);
  const dupKatanaSkus = [...katanaBySku.entries()].filter(([, v]) => v.length > 1);

  const reverbUnique = reverb.filter((l) => l.hasInventory === false);
  const reverbNull = reverb.filter((l) => l.hasInventory === null);
  const syncable = reverb.filter((l) => l.hasInventory !== false);
  const syncableWithSku = syncable.filter((l) => l.sku);
  // Group by normalized SKU so a stray dash matches the same as the matcher.
  const reverbBySku = group(syncable, (l) => (l.sku ? normalizeSku(l.sku) : null));

  const mappedKatanaSkus = new Set(
    mappings
      .filter((m) => m.platform === IntegrationPlatform.KATANA)
      .map((m) => m.externalSku)
  );
  // Reverb listings already linked to some item. The matcher excludes these
  // from the candidate pool, so the diagnostics must too or readyToMap will
  // over-count matches that Sync silently skips.
  const reverbMappingByListingId = new Map(
    mappings
      .filter((m) => m.platform === IntegrationPlatform.REVERB && m.externalId)
      .map((m) => [m.externalId as string, m])
  );
  const mappedReverbListingIds = new Set(reverbMappingByListingId.keys());
  const katanaMappingByItemId = new Map(
    mappings
      .filter((m) => m.platform === IntegrationPlatform.KATANA)
      .map((m) => [m.inventoryItemId, m])
  );
  const productIdByVariantId = new Map(katana.map((v) => [v.variantId, v.productId]));

  // Group ALL Reverb listings by normalized SKU (matching the core matcher),
  // then apply the same eligibility filter (in stock + not already mapped).
  const reverbByNormSkuAll = group(reverb, (l) => (l.sku ? normalizeSku(l.sku) : null));

  console.log("[MappingDiagnostics] Classifying every distinct Katana SKU...");
  const classification = {
    mappedLive: 0,
    readyToMap: 0,
    noReverbListing: 0,
    onlySoldEnded: 0,
    uniqueExcludedMatch: 0,
    blockedByMapping: 0,
    ambiguous: 0,
  };
  const noReverbSkus: string[] = [];
  const soldEndedSkus: string[] = [];
  const conflicts: MappingConflict[] = [];

  for (const [sku, variants] of katanaBySku) {
    if (mappedKatanaSkus.has(sku)) {
      classification.mappedLive++;
      continue;
    }
    const all = reverbByNormSkuAll.get(normalizeSku(sku)) ?? [];
    // Mirror the matcher: only in-stock listings not already mapped elsewhere.
    const candidates = all.filter(
      (l) => l.hasInventory !== false && !mappedReverbListingIds.has(l.listingId)
    );

    // Detect concrete mis-mappings: an in-stock, live/draft listing whose SKU
    // matches this unmapped Katana SKU but is already claimed by another item.
    const blockedListings = all.filter(
      (l) =>
        l.hasInventory !== false &&
        (l.state === "live" || l.state === "draft") &&
        mappedReverbListingIds.has(l.listingId)
    );
    if (blockedListings.length > 0 && candidates.length === 0) {
      const wanted = variants[0];
      for (const listing of blockedListings) {
        const reverbMapping = reverbMappingByListingId.get(listing.listingId);
        const ownerItemId = reverbMapping?.inventoryItemId ?? null;
        const ownerKatana = ownerItemId ? katanaMappingByItemId.get(ownerItemId) : undefined;
        if (!ownerItemId) continue;
        conflicts.push({
          katanaVariantId: wanted.variantId,
          katanaSku: sku,
          katanaProductId: wanted.productId,
          katanaProductName: wanted.productName,
          reverbListingId: listing.listingId,
          reverbTitle: listing.title,
          reverbSku: listing.sku,
          reverbState: listing.state,
          ownerInventoryItemId: ownerItemId,
          ownerName: ownerKatana?.externalName ?? null,
          ownerCanonicalSku: ownerKatana?.externalSku ?? null,
          ownerKatanaSku: ownerKatana?.externalSku ?? null,
          ownerKatanaProductId: ownerKatana?.externalId
            ? productIdByVariantId.get(ownerKatana.externalId) ?? null
            : null,
        });
      }
    }

    if (candidates.length === 0) {
      if (all.length === 0) {
        classification.noReverbListing++;
        noReverbSkus.push(sku);
      } else if (all.every((l) => l.hasInventory === false)) {
        classification.uniqueExcludedMatch++;
      } else if (blockedListings.length > 0) {
        // A matching live/draft listing exists but is mapped to another item.
        classification.blockedByMapping++;
      } else {
        // Listing(s) exist but are sold/ended.
        classification.onlySoldEnded++;
        soldEndedSkus.push(sku);
      }
      continue;
    }
    const live = candidates.filter((l) => l.state === "live");
    const drafts = candidates.filter((l) => l.state === "draft");
    const pool = live.length > 0 ? live : drafts;
    if (pool.length === 1) classification.readyToMap++;
    else if (pool.length > 1) classification.ambiguous++;
    else {
      classification.onlySoldEnded++;
      soldEndedSkus.push(sku);
    }
  }

  console.log("[MappingDiagnostics] Collecting genuinely unmatched Reverb SKUs...");
  const katanaNorm = new Map<string, string>();
  for (const s of katanaBySku.keys()) katanaNorm.set(normalizeSku(s), s);

  const distinctRawSyncableSkus = [
    ...new Set(syncableWithSku.map((l) => l.sku).filter((s): s is string => Boolean(s))),
  ];

  // Genuinely unmatched syncable SKUs (no Katana match even after normalizing).
  const reverbSkusWithoutKatana = distinctRawSyncableSkus.filter(
    (raw) => !katanaNorm.has(normalizeSku(raw))
  );

  const currentCatalogMapped = classification.mappedLive;

  console.log(
    `[MappingDiagnostics] Done. mapped=${mappedKatanaSkus.size}, readyToMap=${classification.readyToMap}, noReverb=${noReverbSkus.length}, conflicts=${conflicts.length}`
  );

  return {
    generatedAt: new Date().toISOString(),
    katana: {
      totalVariants: katana.length,
      withSku: katanaWithSku.length,
      blankSku: katana.length - katanaWithSku.length,
      distinctSkus: katanaBySku.size,
      duplicateSkuCount: dupKatanaSkus.length,
      duplicateSkus: dupKatanaSkus.map(([sku, v]) => ({ sku, variantCount: v.length })),
    },
    reverb: {
      totalListings: reverb.length,
      uniqueExcluded: reverbUnique.length,
      hasInventoryNull: reverbNull.length,
      syncable: syncable.length,
      syncableWithSku: syncableWithSku.length,
      syncableWithoutSku: syncable.length - syncableWithSku.length,
      distinctSyncableSkus: reverbBySku.size,
    },
    mappings: {
      total: mappedKatanaSkus.size,
      currentCatalogMapped,
      staleRows: mappedKatanaSkus.size - currentCatalogMapped,
    },
    classification,
    noReverbSkus,
    soldEndedSkus,
    reverbSkusWithoutKatana,
    conflicts,
  };
}
