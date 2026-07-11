import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { reverb } from "@/lib/integrations/reverb";
import { katana } from "@/lib/integrations/katana";
import { listSyncableItems } from "@/lib/integrations/sku-resolver";
import { fetchMappingData } from "@/lib/sku-mapping-actions";
import { autoMatchByExactSkuCore } from "@/lib/sku-mapping-core";

export const maxDuration = 300;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured (local/dev)
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

/**
 * Read-only verification endpoint for the has_inventory / unique-listing
 * exclusion. Confirms Reverb returns has_inventory, that one-of-a-kind
 * listings (has_inventory = false) are persisted to staging, and that they are
 * excluded from both the mapping pool and listSyncableItems().
 *
 * Pass ?import=true to re-run the Reverb catalog upsert first so the staging
 * hasInventory column reflects live data before the checks run.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { data: null, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const params = new URL(request.url).searchParams;
    const shouldImport = params.get("import") === "true";
    const shouldAutoMatch = params.get("automatch") === "true";

    let katanaImported = 0;
    if (shouldImport) {
      console.log("[HasInventoryCheck] Importing Katana catalog into staging...");
      let kPage = 1;
      let keepGoing = true;
      while (keepGoing) {
        const products = await katana.listProducts({ limit: 250, page: kPage });
        if (products.length === 0) break;
        for (const product of products) {
          for (const variant of product.variants ?? []) {
            await prisma.katanaCatalogVariant.upsert({
              where: { variantId: String(variant.id) },
              create: {
                variantId: String(variant.id),
                productId: String(product.id),
                productName: product.name,
                variantName:
                  (variant.config_attributes ?? [])
                    .map((a) => a.config_value)
                    .join(" / ") || null,
                sku: variant.sku,
                isSellable: product.is_sellable,
              },
              update: {
                productId: String(product.id),
                productName: product.name,
                variantName:
                  (variant.config_attributes ?? [])
                    .map((a) => a.config_value)
                    .join(" / ") || null,
                sku: variant.sku,
                isSellable: product.is_sellable,
                lastImportedAt: new Date(),
              },
            });
            katanaImported++;
          }
        }
        if (products.length < 250) keepGoing = false;
        else kPage++;
      }
      console.log(
        `[HasInventoryCheck] Imported ${katanaImported} Katana variants`
      );
    }

    console.log(
      "[HasInventoryCheck] Fetching all Reverb listings to inspect has_inventory..."
    );

    let withInventory = 0;
    let withoutInventory = 0;
    let unknown = 0;
    const uniqueSamples: Array<{
      listingId: string;
      title: string;
      sku: string | null;
      state: string | null;
    }> = [];

    let page = 1;
    let totalPages = 1;
    let totalSeen = 0;
    do {
      const resp = await reverb.listMyListings({
        page,
        perPage: 50,
        state: "all",
      });
      totalPages = resp.total_pages ?? 1;
      for (const l of resp.listings ?? []) {
        totalSeen++;
        if (l.has_inventory === true) withInventory++;
        else if (l.has_inventory === false) {
          withoutInventory++;
          if (uniqueSamples.length < 10) {
            uniqueSamples.push({
              listingId: String(l.id),
              title: l.title,
              sku: l.sku,
              state: l.state?.slug ?? null,
            });
          }
        } else unknown++;

        if (shouldImport) {
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
        }
      }
      page++;
    } while (page <= totalPages);

    console.log(
      `[HasInventoryCheck] Live Reverb: ${totalSeen} listings (hasInventory true=${withInventory}, false=${withoutInventory}, unknown=${unknown})`
    );

    console.log("[HasInventoryCheck] Inspecting staging catalog...");
    const [stagedTotal, stagedUnique, stagedUnknown] = await Promise.all([
      prisma.reverbCatalogListing.count(),
      prisma.reverbCatalogListing.count({ where: { hasInventory: false } }),
      prisma.reverbCatalogListing.count({ where: { hasInventory: null } }),
    ]);

    console.log(
      "[HasInventoryCheck] Verifying listSyncableItems() excludes unique listings..."
    );
    const uniqueListingIds = new Set(
      (
        await prisma.reverbCatalogListing.findMany({
          where: { hasInventory: false },
          select: { listingId: true },
        })
      ).map((l) => l.listingId)
    );
    const syncable = await listSyncableItems();
    const leakedIntoSync = syncable.filter(
      (s) => s.reverbListingId && uniqueListingIds.has(s.reverbListingId)
    );

    console.log(
      "[HasInventoryCheck] Verifying mapping pool excludes unique listings..."
    );
    const mapping = await fetchMappingData();
    const poolListingIds = (mapping.data?.unmappedReverb ?? []).map(
      (r) => r.listingId
    );
    const leakedIntoPool = poolListingIds.filter((id) =>
      uniqueListingIds.has(id)
    );

    // Coverage: of the syncable (has_inventory != false) Reverb listings, how
    // many have a SKU and how many of those exact-match a Katana variant SKU?
    console.log("[HasInventoryCheck] Computing exact-SKU coverage...");
    const [katanaStaged, syncableListings] = await Promise.all([
      prisma.katanaCatalogVariant.findMany({ select: { sku: true } }),
      prisma.reverbCatalogListing.findMany({
        where: { NOT: { hasInventory: false } },
        select: { sku: true },
      }),
    ]);
    const katanaSkus = new Set(
      katanaStaged.map((v) => v.sku).filter((s): s is string => Boolean(s))
    );
    const syncableWithSku = syncableListings.filter((l) => Boolean(l.sku));
    const exactSkuMatches = syncableWithSku.filter(
      (l) => l.sku && katanaSkus.has(l.sku)
    );
    const coverage = {
      katanaVariantsStaged: katanaStaged.length,
      syncableReverbListings: syncableListings.length,
      syncableWithSku: syncableWithSku.length,
      syncableWithoutSku: syncableListings.length - syncableWithSku.length,
      exactSkuMatchToKatana: exactSkuMatches.length,
    };

    let autoMatch: Awaited<ReturnType<typeof autoMatchByExactSkuCore>> | null =
      null;
    if (shouldAutoMatch) {
      console.log("[HasInventoryCheck] Running exact-SKU auto-match...");
      autoMatch = await autoMatchByExactSkuCore();
    }

    const result = {
      imported: shouldImport,
      katanaImported,
      liveReverb: {
        totalListings: totalSeen,
        hasInventoryTrue: withInventory,
        hasInventoryFalse: withoutInventory,
        hasInventoryUnknown: unknown,
        uniqueSamples,
      },
      stagingCatalog: {
        total: stagedTotal,
        uniqueExcluded: stagedUnique,
        unknown: stagedUnknown,
      },
      syncable: {
        count: syncable.length,
        uniqueListingsLeaked: leakedIntoSync.length,
        leakedListingIds: leakedIntoSync.map((s) => s.reverbListingId),
      },
      mappingPool: {
        unmappedReverbCount: poolListingIds.length,
        uniqueListingsLeaked: leakedIntoPool.length,
        leakedListingIds: leakedIntoPool,
      },
      coverage,
      autoMatch: autoMatch
        ? {
          created: autoMatch.created,
          ambiguous: autoMatch.ambiguous,
          skipped: autoMatch.skipped,
          items: autoMatch.items,
        }
        : null,
      exclusionWorking:
        leakedIntoSync.length === 0 && leakedIntoPool.length === 0,
    };

    console.log(
      `[HasInventoryCheck] Done. syncable=${syncable.length}, pool=${poolListingIds.length}, leakedSync=${leakedIntoSync.length}, leakedPool=${leakedIntoPool.length}, exclusionWorking=${result.exclusionWorking}`
    );

    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    console.error("[HasInventoryCheck] FAILED:", error);
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : "Check failed",
      },
      { status: 500 }
    );
  }
}
