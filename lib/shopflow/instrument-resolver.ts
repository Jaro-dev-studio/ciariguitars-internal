import "server-only";

import prisma from "@/lib/prisma";

import { normalisePartCode } from "./part-matching";

/**
 * Shop Flow has no SKU field for instruments, so the Katana finished good is
 * derived from the model name plus the finish and orientation recovered from
 * the parts list.
 *
 * Katana stores these as structured attributes - productName "ASCENDER TRIO
 * HSH" with variantName "Seafoam Green / Right" - so matching happens against
 * the imported catalogue rather than by composing a SKU string.
 */

/**
 * Shop Flow model names that do not contain their Katana product name.
 * Everything else matches by containment ("Trio HSH" is inside "ASCENDER TRIO
 * HSH"), so only genuine divergences belong here.
 */
const MODEL_ALIASES: Record<string, string> = {
  P90DUO: "ASCENDER DUO",
  P90SOLO: "ASCENDER SOLO",
  P90TRIO: "ASCENDER TRIO",
};

export type InstrumentResolutionReason =
  | "resolved"
  | "unknown-model"
  | "missing-finish"
  | "missing-orientation"
  | "no-matching-variant"
  | "ambiguous";

export interface InstrumentResolution {
  sku: string | null;
  variantId: string | null;
  reason: InstrumentResolutionReason;
  /** Human-readable explanation for the events UI. */
  detail: string;
  /** Populated when several variants matched, so the gap is actionable. */
  candidates?: string[];
}

export interface InstrumentResolutionInput {
  model: string | null;
  finish: string | null;
  orientation: "Right" | "Left" | null;
}

export async function resolveFinishedGood(
  input: InstrumentResolutionInput
): Promise<InstrumentResolution> {
  const { model, finish, orientation } = input;

  if (!model) {
    return {
      sku: null,
      variantId: null,
      reason: "unknown-model",
      detail: "Work order carried no instrument model",
    };
  }

  const products = await prisma.katanaCatalogVariant.findMany({
    where: { variantType: "product", sku: { not: null } },
    select: { sku: true, variantId: true, productName: true, variantName: true },
  });

  const normalisedModel = normalisePartCode(model);
  const aliased = MODEL_ALIASES[normalisedModel];
  const target = aliased ? normalisePartCode(aliased) : normalisedModel;

  const byProduct = products.filter((row) => {
    const name = normalisePartCode(row.productName);
    return name === target || name.endsWith(target) || name.includes(target);
  });

  if (byProduct.length === 0) {
    return {
      sku: null,
      variantId: null,
      reason: "unknown-model",
      detail: `No Katana product matches model "${model}"`,
    };
  }

  if (!finish) {
    return {
      sku: null,
      variantId: null,
      reason: "missing-finish",
      detail: `Model "${model}" matched but the work order carried no finish`,
    };
  }

  const normalisedFinish = normalisePartCode(finish);
  const byFinish = byProduct.filter((row) =>
    normalisePartCode(row.variantName).includes(normalisedFinish)
  );

  if (byFinish.length === 0) {
    return {
      sku: null,
      variantId: null,
      reason: "no-matching-variant",
      detail: `Katana has no "${finish}" variant of ${model}`,
      candidates: byProduct.map((row) => row.sku!).sort(),
    };
  }

  // Orientation only narrows products that actually carry it; the Plus and
  // Steve Stevens lines have no left/right split.
  const orientationMatters = byFinish.some((row) =>
    /right|left/i.test(row.variantName ?? "")
  );

  let candidates = byFinish;
  if (orientationMatters) {
    if (!orientation) {
      return {
        sku: null,
        variantId: null,
        reason: "missing-orientation",
        detail: `${model} in ${finish} needs an orientation and none could be derived`,
        candidates: byFinish.map((row) => row.sku!).sort(),
      };
    }
    candidates = byFinish.filter((row) =>
      new RegExp(`\\b${orientation}\\b`, "i").test(row.variantName ?? "")
    );
  }

  if (candidates.length === 0) {
    return {
      sku: null,
      variantId: null,
      reason: "no-matching-variant",
      detail: `No ${model} variant in ${finish} / ${orientation}`,
      candidates: byFinish.map((row) => row.sku!).sort(),
    };
  }

  if (candidates.length > 1) {
    return {
      sku: null,
      variantId: null,
      reason: "ambiguous",
      // The Duo splits on pickup type, which Shop Flow reports only as the
      // free-text submodel "Duncan P-90s" - matching both Katana values.
      detail: `${candidates.length} Katana variants match ${model} / ${finish}${orientation ? ` / ${orientation}` : ""}`,
      candidates: candidates.map((row) => row.sku!).sort(),
    };
  }

  const match = candidates[0];
  return {
    sku: match.sku!,
    variantId: match.variantId,
    reason: "resolved",
    detail: `Matched ${match.sku}`,
  };
}
