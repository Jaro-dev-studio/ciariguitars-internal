import { describe, expect, it } from "vitest";

import {
  calculateConsumptionDelta,
  finishFromConfigurationLine,
  isConfigurationLine,
  matchPartLine,
  normalisePartCode,
  orientationFromParts,
  partCodeCandidates,
  type CatalogueEntry,
} from "./part-matching";

const entry = (sku: string, variantId: string): CatalogueEntry => ({
  sku,
  variantId,
  normalisedSku: normalisePartCode(sku),
});

// Drawn from real Katana material SKUs so the formatting quirks are genuine.
const CATALOGUE: CatalogueEntry[] = [
  entry("OEM-4081N", "39967607"),
  entry("MTE1.0-145_RevB", "39967634"),
  entry("MTE1.1-137 RevB", "39967590"),
  entry("2550", "39967444"),
  entry("BQL-4125-00", "39967493"),
  entry("CIARI-512 Rev A", "39967509"),
  entry("DCS38X14N52", "39967521"),
  entry("JCB4C/AP-0633-010", "39967552"),
  entry("Gig bag", "39967539"),
];

describe("normalisePartCode", () => {
  it("strips punctuation and casing so formatting drift stops mattering", () => {
    expect(normalisePartCode("MTE1.0-145 Rev B")).toBe("MTE10145REVB");
    expect(normalisePartCode("MTE1.0-145_RevB")).toBe("MTE10145REVB");
  });

  it("returns an empty string for nullish input", () => {
    expect(normalisePartCode(null)).toBe("");
    expect(normalisePartCode(undefined)).toBe("");
  });
});

describe("partCodeCandidates", () => {
  it("puts the Shop Flow part id first", () => {
    const candidates = partCodeCandidates({
      Id: "OEM-4081N",
      PartName: "OEM-4081N - Nickel Bridge",
    });
    expect(candidates[0]).toBe("OEM-4081N");
  });

  it("extracts the Katana code from PartName when the id differs", () => {
    // Shop Flow calls this CIARI-048; Katana holds it as 2550.
    const candidates = partCodeCandidates({
      Id: "CIARI-048",
      PartName: "2550 - TRUSS ROD",
    });
    expect(candidates).toContain("2550");
  });

  it("splits compound supplier codes on the slash", () => {
    const candidates = partCodeCandidates({
      Id: "CIARI-097",
      PartName: "JCB4C/AP-0633-010 - Input Jack Plate",
    });
    expect(candidates).toContain("JCB4C/AP-0633-010");
    expect(candidates).toContain("AP-0633-010");
  });

  it("drops a leading hash used as a part prefix", () => {
    const candidates = partCodeCandidates({
      Id: "CIARI-150",
      PartName: "#0149-LB FRET WIRE MEDIUM/HIGH",
    });
    expect(candidates).toContain("0149-LB");
  });
});

describe("matchPartLine", () => {
  it("matches on the part id exactly", () => {
    const match = matchPartLine({ Id: "OEM-4081N" }, CATALOGUE);
    expect(match).toMatchObject({ sku: "OEM-4081N", strategy: "exact" });
  });

  it("ignores punctuation differences between the two systems", () => {
    const match = matchPartLine(
      { Id: "MTE1.0-145 Rev B", PartName: "RH Pickguard" },
      CATALOGUE
    );
    expect(match).toMatchObject({
      sku: "MTE1.0-145_RevB",
      strategy: "exact",
    });
  });

  it("falls back to the code embedded in PartName", () => {
    const match = matchPartLine(
      { Id: "CIARI-048", PartName: "2550 - TRUSS ROD" },
      CATALOGUE
    );
    expect(match).toMatchObject({
      sku: "2550",
      strategy: "part-name-code",
      matchedOn: "2550",
    });
  });

  it("flags revision-tolerant matches rather than trusting them", () => {
    // Katana carries "CIARI-512 Rev A"; Shop Flow sends the bare number.
    const match = matchPartLine({ Id: "CIARI-512" }, CATALOGUE);
    expect(match).toMatchObject({
      sku: "CIARI-512 Rev A",
      strategy: "revision-tolerant",
    });
  });

  it("tolerates a pack-size suffix Katana does not carry", () => {
    const match = matchPartLine({ Id: "DCS38X14N52-20PK" }, CATALOGUE);
    expect(match).toMatchObject({
      sku: "DCS38X14N52",
      strategy: "revision-tolerant",
    });
  });

  it("returns null when nothing plausibly matches", () => {
    const match = matchPartLine(
      { Id: "Backpack", PartName: "Backpack" },
      CATALOGUE
    );
    expect(match).toBeNull();
  });

  it("does not prefix match on short codes", () => {
    // "2550" is in the catalogue but must not swallow an unrelated "25".
    const match = matchPartLine({ Id: "25", PartName: "25" }, CATALOGUE);
    expect(match).toBeNull();
  });
});

describe("isConfigurationLine", () => {
  it("treats colour option lines as configuration, not stock", () => {
    expect(
      isConfigurationLine({
        Id: "Seafoam Green - TRIO",
        GroupName: "Color (Options)",
      })
    ).toBe(true);
  });

  it("treats a colour id as configuration even without a group", () => {
    expect(isConfigurationLine({ Id: "Olympic White - TRIO" })).toBe(true);
  });

  it("leaves real components alone", () => {
    expect(
      isConfigurationLine({ Id: "OEM-4081N", GroupName: "Pickup (Options)" })
    ).toBe(false);
  });
});

describe("finishFromConfigurationLine", () => {
  it("reads the finish out of the option line", () => {
    expect(
      finishFromConfigurationLine({
        Id: "Seafoam Green - TRIO",
        GroupName: "Color (Options)",
      })
    ).toBe("Seafoam Green");
  });

  it("copes with the dash spacing Shop Flow actually sends", () => {
    expect(finishFromConfigurationLine({ Id: "Jet Black -TRIO" })).toBe(
      "Jet Black"
    );
  });

  it("strips a trailing handedness marker from the finish", () => {
    expect(finishFromConfigurationLine({ Id: "Jet Black -TRIO (LH)" })).toBe(
      "Jet Black"
    );
  });

  it("returns null for a non-colour line", () => {
    expect(finishFromConfigurationLine({ Id: "OEM-4081N" })).toBeNull();
  });
});

describe("orientationFromParts", () => {
  it("infers handedness from the pickguard description", () => {
    expect(
      orientationFromParts([
        { Id: "MTE1.0-145 Rev B", PartName: "RH Pickguard NEW P90 Duo (Black)" },
      ])
    ).toBe("Right");
  });

  it("recognises left-handed pickguards", () => {
    expect(
      orientationFromParts([{ Id: "x", PartName: "LH Pickguard P90 Duo" }])
    ).toBe("Left");
  });

  it("prefers an explicit marker on the colour line over the pickguard", () => {
    expect(
      orientationFromParts([
        { Id: "Jet Black -TRIO (LH)", GroupName: "Color (Options)" },
        { Id: "MTE1.0-145 Rev B", PartName: "RH Pickguard P90 Duo (Black)" },
      ])
    ).toBe("Left");
  });

  it("returns null when no pickguard is present", () => {
    expect(orientationFromParts([{ Id: "OEM-4081N", PartName: "Bridge" }])).toBeNull();
  });
});

describe("calculateConsumptionDelta", () => {
  const part = (variantId: string, quantity: number) => ({
    partId: `part-${variantId}`,
    katanaSku: `SKU-${variantId}`,
    variantId,
    quantity,
  });

  it("returns the full list on a first booking", () => {
    expect(calculateConsumptionDelta([], [part("1", 2), part("2", 1)])).toEqual([
      part("1", 2),
      part("2", 1),
    ]);
  });

  it("returns nothing when a redelivery is unchanged", () => {
    const booked = [part("1", 2), part("2", 1)];
    expect(calculateConsumptionDelta(booked, booked)).toEqual([]);
  });

  it("books only the increase when a revision uses more of a part", () => {
    expect(calculateConsumptionDelta([part("1", 2)], [part("1", 5)])).toEqual([
      part("1", 3),
    ]);
  });

  it("returns stock when a revision drops a part", () => {
    expect(calculateConsumptionDelta([part("1", 2)], [])).toEqual([
      part("1", -2),
    ]);
  });

  it("handles a swap in a single pass", () => {
    const delta = calculateConsumptionDelta([part("1", 1)], [part("2", 1)]);
    expect(delta).toEqual([part("1", -1), part("2", 1)]);
  });
});
