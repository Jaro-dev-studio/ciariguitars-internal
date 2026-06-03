import "server-only";

import { IntegrationPlatform } from "@prisma/client";
import prisma from "@/lib/prisma";

/**
 * Ciari's Katana and Reverb SKUs do NOT match today (Reverb uses generated
 * SKUs, Katana uses manually-set ones). All cross-platform matching therefore
 * goes through an explicit mapping table keyed on a canonical InventoryItem.
 *
 * Canonical SKU == the Katana SKU (the one Jonathan controls). If/when Reverb
 * SKUs are updated to match, this resolver keeps working unchanged - the Reverb
 * mapping simply becomes identical to the canonical SKU.
 */

export interface ResolvedMapping {
  inventoryItemId: string;
  canonicalSku: string;
  katanaSku: string | null;
  katanaVariantId: string | null;
  reverbSku: string | null;
  reverbListingId: string | null;
}

export async function resolveByKatanaSku(
  katanaSku: string
): Promise<ResolvedMapping | null> {
  const mapping = await prisma.sKUMapping.findUnique({
    where: {
      platform_externalSku: {
        platform: IntegrationPlatform.KATANA,
        externalSku: katanaSku,
      },
    },
    include: {
      inventoryItem: { include: { skuMappings: true } },
    },
  });

  if (!mapping) return null;
  return buildResolved(mapping.inventoryItem);
}

export async function resolveByReverbSku(
  reverbSku: string
): Promise<ResolvedMapping | null> {
  const mapping = await prisma.sKUMapping.findUnique({
    where: {
      platform_externalSku: {
        platform: IntegrationPlatform.REVERB,
        externalSku: reverbSku,
      },
    },
    include: {
      inventoryItem: { include: { skuMappings: true } },
    },
  });

  if (!mapping) return null;
  return buildResolved(mapping.inventoryItem);
}

export async function resolveByReverbListingId(
  listingId: string
): Promise<ResolvedMapping | null> {
  const mapping = await prisma.sKUMapping.findFirst({
    where: {
      platform: IntegrationPlatform.REVERB,
      externalId: listingId,
    },
    include: {
      inventoryItem: { include: { skuMappings: true } },
    },
  });

  if (!mapping) return null;
  return buildResolved(mapping.inventoryItem);
}

type ItemWithMappings = {
  id: string;
  sku: string;
  skuMappings: Array<{
    platform: IntegrationPlatform;
    externalSku: string;
    externalId: string | null;
    isActive: boolean;
  }>;
};

function buildResolved(item: ItemWithMappings): ResolvedMapping {
  const katana = item.skuMappings.find(
    (m) => m.platform === IntegrationPlatform.KATANA && m.isActive
  );
  const reverb = item.skuMappings.find(
    (m) => m.platform === IntegrationPlatform.REVERB && m.isActive
  );

  return {
    inventoryItemId: item.id,
    canonicalSku: item.sku,
    katanaSku: katana?.externalSku ?? null,
    katanaVariantId: katana?.externalId ?? null,
    reverbSku: reverb?.externalSku ?? null,
    reverbListingId: reverb?.externalId ?? null,
  };
}

/**
 * All inventory items that have BOTH a Katana and Reverb mapping - i.e. the
 * set we can actively keep in sync. Items missing either side are surfaced as
 * coverage gaps elsewhere.
 */
export async function listSyncableItems(): Promise<ResolvedMapping[]> {
  const items = await prisma.inventoryItem.findMany({
    include: { skuMappings: true },
  });

  return items
    .map(buildResolved)
    .filter((r) => r.katanaVariantId !== null && r.reverbListingId !== null);
}

export async function listCoverageGaps(): Promise<{
  missingReverb: ResolvedMapping[];
  missingKatana: ResolvedMapping[];
}> {
  const items = await prisma.inventoryItem.findMany({
    include: { skuMappings: true },
  });

  const resolved = items.map(buildResolved);
  return {
    missingReverb: resolved.filter(
      (r) => r.katanaVariantId !== null && r.reverbListingId === null
    ),
    missingKatana: resolved.filter(
      (r) => r.reverbListingId !== null && r.katanaVariantId === null
    ),
  };
}
