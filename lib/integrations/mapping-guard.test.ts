import { describe, expect, it } from "vitest";
import { mappingDriftReason } from "./mapping-guard";

describe("mappingDriftReason", () => {
  it("passes a mapping whose SKUs still match", () => {
    expect(
      mappingDriftReason({
        canonicalSku: "CIARI-DUO-OW-L-P90V",
        katanaSku: "CIARI-DUO-OW-L-P90V",
        reverbSku: "CIARI-DUO-OW-L-P90V",
      })
    ).toBeNull();
  });

  it("ignores stray dashes and casing", () => {
    expect(
      mappingDriftReason({
        canonicalSku: "CIARI-STD-OW-R",
        katanaSku: "CIARI-STD-OW-R",
        reverbSku: "-CIARI-STD-OW-R",
      })
    ).toBeNull();
    expect(
      mappingDriftReason({
        canonicalSku: "CIARI-DUO-RWR-R-P90V",
        katanaSku: "CIARI-DUO-RWR-R-P90v",
        reverbSku: "ciari-duo-rwr-r-p90v",
      })
    ).toBeNull();
  });

  it("skips a mapping whose Katana SKU was renamed", () => {
    expect(
      mappingDriftReason({
        canonicalSku: "CIARI-SOLO-JB-R-P90C",
        katanaSku: "CIARI-SOLO-JB-R-P90V",
        reverbSku: "rev-98285433",
      })
    ).toBe("Katana item's SKU is now CIARI-SOLO-JB-R-P90V, not CIARI-SOLO-JB-R-P90C");
  });

  it("skips a listing whose Reverb SKU now belongs to another guitar", () => {
    expect(
      mappingDriftReason({
        canonicalSku: "CIARI-SOLO-VB-L-P90S",
        katanaSku: "CIARI-SOLO-VB-L-P90S",
        reverbSku: "CIARI-SOLO-VB-L-P90V-LC",
      })
    ).toBe("Reverb listing's SKU is now CIARI-SOLO-VB-L-P90V-LC, not CIARI-SOLO-VB-L-P90S");
  });

  it("does not judge listings without a real SKU", () => {
    for (const reverbSku of [null, undefined, "", " - ", "rev-98285433"]) {
      expect(
        mappingDriftReason({
          canonicalSku: "CIARI-SOLO-JB-R-P90V",
          katanaSku: "CIARI-SOLO-JB-R-P90V",
          reverbSku,
        })
      ).toBeNull();
    }
  });

  it("does not judge the Katana side when the catalog has no SKU for it", () => {
    expect(
      mappingDriftReason({
        canonicalSku: "CIARI-SOLO-VB-RA",
        katanaSku: null,
        reverbSku: "CIARI-SOLO-VB-RA",
      })
    ).toBeNull();
  });
});
