/**
 * Pure matching helpers for reconciling Shop Flow part numbers against Katana
 * SKUs. Kept free of server-only imports so they can be unit tested directly.
 *
 * Shop Flow and Katana share a part numbering scheme but not its formatting.
 * Observed across production work orders:
 *   - punctuation and casing drift: "MTE1.0-145 Rev B" vs "MTE1.0-145_RevB"
 *   - the Katana code lives in PartName, not Id: Id "CIARI-048" / name
 *     "2550 - TRUSS ROD", where Katana holds "2550"
 *   - compound supplier codes: "JCB4C/AP-0633-010"
 *   - revision suffixes on one side only: "CIARI-512" vs "CIARI-512 Rev A"
 *   - pack-size suffixes: "DCS38X14N52-20PK" vs "DCS38X14N52"
 */

export interface ShopFlowPartLine {
  Id?: string | number | null;
  PartName?: string | null;
  Quantity?: number | string | null;
  CostEach?: number | string | null;
  GroupName?: string | null;
  GroupId?: number | null;
}

export type PartMatchStrategy =
  | "override"
  | "exact"
  | "part-name-code"
  | "revision-tolerant";

/** Uppercase alphanumerics only, so formatting differences stop mattering. */
export function normalisePartCode(value: unknown): string {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * The model family suffix on a colour option id. Spacing around the dash is
 * inconsistent in practice - both "Seafoam Green - TRIO" and "Jet Black -TRIO"
 * occur - and a handedness marker may follow it.
 */
const FAMILY_SUFFIX = /\s*[-–]\s*(TRIO|DUO|SOLO|STD)\b/i;
const HANDEDNESS_MARKER = /\((LH|RH|LEFT|RIGHT)\)/i;

/**
 * Colour selections and other build options ride along in the Parts array but
 * are configuration rather than stock. They carry a "... (Options)" group name
 * and, for finishes, a "<Colour> - TRIO" style id.
 */
export function isConfigurationLine(part: ShopFlowPartLine): boolean {
  const group = String(part.GroupName ?? "");
  if (/colou?r/i.test(group)) return true;
  return FAMILY_SUFFIX.test(String(part.Id ?? ""));
}

/**
 * Reads the finish out of a colour option line: "Seafoam Green - TRIO" and
 * "Jet Black -TRIO (LH)" both yield the bare colour name.
 */
export function finishFromConfigurationLine(
  part: ShopFlowPartLine
): string | null {
  if (!isConfigurationLine(part)) return null;
  const finish = String(part.Id ?? "")
    .replace(FAMILY_SUFFIX, " ")
    .replace(HANDEDNESS_MARKER, " ")
    .replace(/\s+/g, " ")
    .trim();
  return finish.length > 0 ? finish : null;
}

/**
 * Right or left handed. Shop Flow has no orientation field, so it is recovered
 * from two places: an explicit marker on the colour option line such as
 * "Jet Black -TRIO (LH)", which is preferred, and otherwise the pickguard
 * description, which is the only other handed component named in the payload.
 */
export function orientationFromParts(
  parts: ShopFlowPartLine[]
): "Right" | "Left" | null {
  for (const part of parts) {
    if (!isConfigurationLine(part)) continue;
    const marker = String(part.Id ?? "").match(HANDEDNESS_MARKER);
    if (marker) return /^(LH|LEFT)$/i.test(marker[1]) ? "Left" : "Right";
  }

  for (const part of parts) {
    const name = String(part.PartName ?? "");
    if (!/pickguard/i.test(name)) continue;
    if (/(^|\W)(RH|RIGHT)(\W|$)/i.test(name)) return "Right";
    if (/(^|\W)(LH|LEFT)(\W|$)/i.test(name)) return "Left";
  }
  return null;
}

/**
 * Every string that might be the Katana SKU for this part line, most reliable
 * first. Shop Flow's Part Number is authoritative when it resolves; the code
 * embedded in PartName is the documented fallback.
 */
export function partCodeCandidates(part: ShopFlowPartLine): string[] {
  const candidates: string[] = [];
  const push = (value: string | null | undefined) => {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) return;
    if (!candidates.some((c) => normalisePartCode(c) === normalisePartCode(trimmed))) {
      candidates.push(trimmed);
    }
  };

  push(String(part.Id ?? ""));

  const name = String(part.PartName ?? "").trim();
  if (name) {
    // Leading token, cut at " - " or a run of spaces: the convention Shop Flow
    // uses when it prefixes a description with the supplier code.
    const lead = name.split(/\s+[-–]\s+|\s{2,}/)[0].trim().replace(/^#\s*/, "");
    push(lead);
    // "JCB4C/AP-0633-010" is stored under either half depending on the part.
    if (lead.includes("/")) for (const piece of lead.split("/")) push(piece);
    push(name.split(/\s+/)[0].replace(/^#\s*/, ""));
  }

  return candidates;
}

export interface CatalogueEntry {
  sku: string;
  variantId: string;
  normalisedSku: string;
}

export interface PartMatch {
  sku: string;
  variantId: string;
  strategy: PartMatchStrategy;
  /** The candidate string that produced the match, for auditability. */
  matchedOn: string;
}

/**
 * Resolves one part line against the Katana catalogue.
 *
 * Exact normalised matches are trusted. Revision-tolerant matches (one code is
 * a prefix of the other) are returned but flagged, because they include genuine
 * near misses such as Shop Flow's "AP-0670-B10" against Katana's "AP-0670-B01"
 * and should be confirmed by a human before they move stock.
 */
export function matchPartLine(
  part: ShopFlowPartLine,
  catalogue: CatalogueEntry[]
): PartMatch | null {
  const candidates = partCodeCandidates(part);

  const byNormalised = new Map<string, CatalogueEntry>();
  for (const entry of catalogue) {
    if (entry.normalisedSku && !byNormalised.has(entry.normalisedSku)) {
      byNormalised.set(entry.normalisedSku, entry);
    }
  }

  for (const [index, candidate] of candidates.entries()) {
    const hit = byNormalised.get(normalisePartCode(candidate));
    if (hit) {
      return {
        sku: hit.sku,
        variantId: hit.variantId,
        strategy: index === 0 ? "exact" : "part-name-code",
        matchedOn: candidate,
      };
    }
  }

  // Short codes produce too many false positives to prefix match on.
  const MIN_PREFIX_LENGTH = 6;
  for (const candidate of candidates) {
    const key = normalisePartCode(candidate);
    if (key.length < MIN_PREFIX_LENGTH) continue;
    const hit = catalogue.find(
      (entry) =>
        entry.normalisedSku.length >= MIN_PREFIX_LENGTH &&
        (entry.normalisedSku.startsWith(key) || key.startsWith(entry.normalisedSku))
    );
    if (hit) {
      return {
        sku: hit.sku,
        variantId: hit.variantId,
        strategy: "revision-tolerant",
        matchedOn: candidate,
      };
    }
  }

  return null;
}

/**
 * Net change per Katana variant between what was already booked for a work
 * order and what the latest delivery says was consumed.
 *
 * Shop Flow reopens and re-completes work orders, resending the full parts
 * list each time, so a redelivery must apply the difference rather than the
 * whole list again. Parts dropped on the revision come back as positive
 * quantities, returning them to stock.
 */
export interface BookedPart {
  partId: string;
  katanaSku: string;
  variantId: string;
  quantity: number;
}

export function calculateConsumptionDelta(
  previouslyBooked: BookedPart[],
  current: BookedPart[]
): BookedPart[] {
  const byVariant = new Map<string, BookedPart & { delta: number }>();

  for (const part of previouslyBooked) {
    byVariant.set(part.variantId, { ...part, delta: -part.quantity });
  }
  for (const part of current) {
    const existing = byVariant.get(part.variantId);
    if (existing) existing.delta += part.quantity;
    else byVariant.set(part.variantId, { ...part, delta: part.quantity });
  }

  return [...byVariant.values()]
    .filter((entry) => entry.delta !== 0)
    .map(({ partId, katanaSku, variantId, delta }) => ({
      partId,
      katanaSku,
      variantId,
      quantity: delta,
    }));
}
