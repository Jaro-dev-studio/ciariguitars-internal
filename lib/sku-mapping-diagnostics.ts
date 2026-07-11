import "server-only";

import { IntegrationPlatform } from "@prisma/client";
import prisma from "@/lib/prisma";
import { normalizeSku } from "@/lib/sku-mapping-core";

export interface DiagnosticDuplicate {
  sku: string;
  variantCount: number;
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
    ambiguous: number;
  };
  noReverbSkus: string[];
  soldEndedSkus: string[];
  reverbSkusWithoutKatana: string[];
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

  console.log("[MappingDiagnostics] Classifying every distinct Katana SKU...");
  const classification = {
    mappedLive: 0,
    readyToMap: 0,
    noReverbListing: 0,
    onlySoldEnded: 0,
    uniqueExcludedMatch: 0,
    ambiguous: 0,
  };
  const noReverbSkus: string[] = [];
  const soldEndedSkus: string[] = [];

  const reverbNormSkusWithAnyListing = new Set(
    reverb.map((l) => (l.sku ? normalizeSku(l.sku) : "")).filter(Boolean)
  );

  for (const [sku] of katanaBySku) {
    if (mappedKatanaSkus.has(sku)) {
      classification.mappedLive++;
      continue;
    }
    const candidates = reverbBySku.get(normalizeSku(sku)) ?? [];
    if (candidates.length === 0) {
      if (reverbNormSkusWithAnyListing.has(normalizeSku(sku))) {
        classification.uniqueExcludedMatch++;
      } else {
        classification.noReverbListing++;
        noReverbSkus.push(sku);
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
    `[MappingDiagnostics] Done. mapped=${mappedKatanaSkus.size}, readyToMap=${classification.readyToMap}, noReverb=${noReverbSkus.length}`
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
  };
}
