import "server-only";

import prisma from "@/lib/prisma";

import { partQuantity } from "./contract";
import {
  matchPartLine,
  normalisePartCode,
  type CatalogueEntry,
  type PartMatch,
  type PartMatchStrategy,
  type ShopFlowPartLine,
} from "./part-matching";

export interface ResolvedPart {
  partId: string;
  partName: string | null;
  quantity: number;
  katanaSku: string;
  variantId: string;
  strategy: PartMatchStrategy;
  matchedOn: string;
  /**
   * Revision-tolerant matches are near misses, not certainties - Shop Flow's
   * "AP-0670-B10" resolving to Katana's "AP-0670-B01" could be a typo or a
   * different part. Never booked without a human confirming the mapping.
   */
  needsConfirmation: boolean;
}

export interface UnresolvedPart {
  partId: string;
  partName: string | null;
  quantity: number;
}

export interface IgnoredPart {
  partId: string;
  partName: string | null;
  reason: string;
}

export interface PartResolution {
  resolved: ResolvedPart[];
  unresolved: UnresolvedPart[];
  ignored: IgnoredPart[];
}

/**
 * Maps Shop Flow part lines onto Katana variants.
 *
 * Precedence is deliberate: an explicit ShopFlowPartMapping row always wins, so
 * a human decision is never overridden by the automatic matcher. Only then does
 * it fall back to matching against the imported Katana catalogue.
 */
export async function resolveParts(
  parts: ShopFlowPartLine[]
): Promise<PartResolution> {
  console.log(`[ShopFlowResolver] Resolving ${parts.length} part lines...`);

  const partIds = parts.map((part) => String(part.Id ?? "").trim()).filter(Boolean);

  const [overrides, catalogueRows] = await Promise.all([
    prisma.shopFlowPartMapping.findMany({
      where: { shopflowPartId: { in: partIds } },
    }),
    prisma.katanaCatalogVariant.findMany({
      where: { sku: { not: null } },
      select: { sku: true, variantId: true, normalisedSku: true },
    }),
  ]);

  const overrideByPartId = new Map(
    overrides.map((row) => [row.shopflowPartId, row])
  );

  const catalogue: CatalogueEntry[] = catalogueRows
    .filter((row): row is typeof row & { sku: string } => Boolean(row.sku))
    .map((row) => ({
      sku: row.sku,
      variantId: row.variantId,
      // Backfilled defensively: rows imported before normalisedSku existed
      // would otherwise never match.
      normalisedSku: row.normalisedSku || normalisePartCode(row.sku),
    }));

  const resolved: ResolvedPart[] = [];
  const unresolved: UnresolvedPart[] = [];
  const ignored: IgnoredPart[] = [];

  for (const part of parts) {
    const partId = String(part.Id ?? "").trim();
    const partName = part.PartName?.trim() || null;
    const quantity = partQuantity(part);

    if (!partId) {
      ignored.push({ partId: "", partName, reason: "Part line has no id" });
      continue;
    }

    const override = overrideByPartId.get(partId);

    if (override?.isIgnored) {
      ignored.push({
        partId,
        partName,
        reason: override.notes || "Excluded by mapping",
      });
      continue;
    }

    if (override?.katanaSku && override.katanaVariantId) {
      resolved.push({
        partId,
        partName,
        quantity,
        katanaSku: override.katanaSku,
        variantId: override.katanaVariantId,
        strategy: "override",
        matchedOn: partId,
        needsConfirmation: false,
      });
      continue;
    }

    const match: PartMatch | null = matchPartLine(part, catalogue);
    if (!match) {
      unresolved.push({ partId, partName, quantity });
      continue;
    }

    resolved.push({
      partId,
      partName,
      quantity,
      katanaSku: match.sku,
      variantId: match.variantId,
      strategy: match.strategy,
      matchedOn: match.matchedOn,
      needsConfirmation: match.strategy === "revision-tolerant",
    });
  }

  console.log(
    `[ShopFlowResolver] Resolved ${resolved.length}, unresolved ${unresolved.length}, ignored ${ignored.length}`
  );

  return { resolved, unresolved, ignored };
}
