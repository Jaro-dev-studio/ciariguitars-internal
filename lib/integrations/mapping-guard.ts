import "server-only";

import { normalizeSku } from "@/lib/sku-mapping-core";

/**
 * Mappings made to a listing with no SKU store `rev-<listing id>`, and some
 * listings carry that same placeholder on Reverb, so it says nothing about
 * which guitar the listing is.
 */
const PLACEHOLDER_SKU = /^rev-\d+$/i;

function sameSku(a: string, b: string): boolean {
  return normalizeSku(a).toUpperCase() === normalizeSku(b).toUpperCase();
}

/**
 * Whether a listing carries this SKU itself, rather than a blank SKU or
 * Reverb's own rev-<id> placeholder. One-off listings are only synced when
 * they do, so a one-of-a-kind guitar linked some other way is never ended.
 */
export function carriesSku(
  listingSku: string | null | undefined,
  canonicalSku: string
): boolean {
  if (!listingSku) return false;
  const sku = normalizeSku(listingSku);
  return Boolean(sku) && !PLACEHOLDER_SKU.test(sku) && sameSku(sku, canonicalSku);
}

/**
 * Why a mapping can no longer be trusted, or null when it still lines up.
 *
 * A mapping ties a Katana item to a Reverb listing by id, so it keeps pointing
 * at the same two records after either side's SKU changes. Once Ciari renames
 * a Katana SKU or moves a SKU to another listing, syncing the old mapping
 * would put one guitar's count on another guitar's listing, or list the same
 * guitar twice. Those mappings are skipped until someone re-links them.
 */
export function mappingDriftReason(opts: {
  canonicalSku: string;
  /** The Katana item's SKU in the latest catalog import, if known. */
  katanaSku: string | null | undefined;
  /** The SKU on the Reverb listing (or order) right now. */
  reverbSku: string | null | undefined;
}): string | null {
  const { canonicalSku, katanaSku } = opts;
  if (katanaSku && normalizeSku(katanaSku) && !sameSku(katanaSku, canonicalSku)) {
    return `Katana item's SKU is now ${katanaSku}, not ${canonicalSku}`;
  }

  const reverbSku = opts.reverbSku ? normalizeSku(opts.reverbSku) : "";
  if (reverbSku && !PLACEHOLDER_SKU.test(reverbSku) && !sameSku(reverbSku, canonicalSku)) {
    return `Reverb listing's SKU is now ${opts.reverbSku}, not ${canonicalSku}`;
  }

  return null;
}
