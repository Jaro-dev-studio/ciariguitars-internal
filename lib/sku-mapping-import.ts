import "server-only";

import prisma from "@/lib/prisma";
import { katana } from "@/lib/integrations/katana";
import { reverb } from "@/lib/integrations/reverb";
import { normalisePartCode } from "@/lib/shopflow/part-matching";

export interface CatalogImportResult {
  katanaVariants: number;
  reverbListings: number;
}

const PAGE_SIZE = 250;
const REVERB_PAGE_SIZE = 50;

/**
 * Core catalog import: pulls Katana product variants, Katana materials and
 * Reverb listings into the staging tables. This is the auth-free implementation
 * shared by the `importCatalogs` server action and internal tooling, so a
 * script or cron can refresh staging without a browser session.
 *
 * Both Katana passes are required: finished goods live under /products and feed
 * the Reverb mapping, while materials only appear under /variants and are what
 * Shop Flow work orders consume. Throws on API failure.
 */
export async function importCatalogsCore(): Promise<CatalogImportResult> {
  console.log("[SKUImport] Starting catalog import from Katana and Reverb...");

  console.log("[SKUImport] Fetching Katana products...");
  let katanaCount = 0;
  let page = 1;
  let keepGoing = true;
  while (keepGoing) {
    const products = await katana.listProducts({ limit: PAGE_SIZE, page });
    if (products.length === 0) break;
    for (const product of products) {
      for (const variant of product.variants ?? []) {
        const variantName =
          (variant.config_attributes ?? [])
            .map((a) => a.config_value)
            .join(" / ") || null;
        const fields = {
          productId: String(product.id),
          productName: product.name,
          variantName,
          sku: variant.sku,
          isSellable: product.is_sellable,
          variantType: "product",
          normalisedSku: normalisePartCode(variant.sku) || null,
        };
        await prisma.katanaCatalogVariant.upsert({
          where: { variantId: String(variant.id) },
          create: { variantId: String(variant.id), ...fields },
          update: { ...fields, lastImportedAt: new Date() },
        });
        katanaCount++;
      }
    }
    if (products.length < PAGE_SIZE) keepGoing = false;
    else page++;
  }
  console.log(`[SKUImport] Imported ${katanaCount} Katana product variants`);

  // Components never appear under /products, so they are fetched separately.
  // Shop Flow work orders consume these, not finished goods.
  console.log("[SKUImport] Fetching Katana materials...");
  let materialCount = 0;
  let mPage = 1;
  let mKeepGoing = true;
  while (mKeepGoing) {
    const variants = await katana.listVariants({
      type: "material",
      limit: PAGE_SIZE,
      page: mPage,
    });
    if (variants.length === 0) break;
    for (const variant of variants) {
      const variantName =
        (variant.config_attributes ?? [])
          .map((a) => a.config_value)
          .join(" / ") || null;
      const fields = {
        productId: variant.material_id ? String(variant.material_id) : null,
        // Materials carry no product name; the SKU is the usable label.
        productName: variant.sku ?? `Material ${variant.id}`,
        variantName,
        sku: variant.sku,
        isSellable: false,
        variantType: "material",
        normalisedSku: normalisePartCode(variant.sku) || null,
      };
      await prisma.katanaCatalogVariant.upsert({
        where: { variantId: String(variant.id) },
        create: { variantId: String(variant.id), ...fields },
        update: { ...fields, lastImportedAt: new Date() },
      });
      materialCount++;
    }
    if (variants.length < PAGE_SIZE) mKeepGoing = false;
    else mPage++;
  }
  katanaCount += materialCount;
  console.log(`[SKUImport] Imported ${materialCount} Katana material variants`);

  console.log("[SKUImport] Fetching Reverb listings...");
  let reverbCount = 0;
  let rPage = 1;
  let rTotalPages = 1;
  do {
    const resp = await reverb.listMyListings({
      page: rPage,
      perPage: REVERB_PAGE_SIZE,
      state: "all",
    });
    rTotalPages = resp.total_pages ?? 1;
    for (const l of resp.listings ?? []) {
      const fields = {
        title: l.title,
        make: l.make,
        model: l.model,
        finish: (l as { finish?: string }).finish ?? null,
        state: l.state?.slug ?? null,
        inventory: l.inventory ?? null,
        hasInventory: l.has_inventory ?? null,
        sku: l.sku,
      };
      await prisma.reverbCatalogListing.upsert({
        where: { listingId: String(l.id) },
        create: { listingId: String(l.id), ...fields },
        update: { ...fields, lastImportedAt: new Date() },
      });
      reverbCount++;
    }
    rPage++;
  } while (rPage <= rTotalPages);
  console.log(`[SKUImport] Imported ${reverbCount} Reverb listings`);

  return { katanaVariants: katanaCount, reverbListings: reverbCount };
}
