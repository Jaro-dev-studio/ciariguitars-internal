import { describe, expect, it } from "vitest";

import { compactPayload, flattenPayload, summariseShopFlowPayload } from "./shopflow-payload";

describe("flattenPayload", () => {
  it("walks nested objects and arrays into indexed paths", () => {
    const fields = flattenPayload({
      serialNumber: "CG-2026-0142",
      specs: { finish: "Gloss Black", pickups: ["Bridge", "Neck"] },
    });

    expect(fields).toEqual([
      { path: "serialNumber", label: "serialNumber", value: "CG-2026-0142" },
      { path: "specs.finish", label: "finish", value: "Gloss Black" },
      { path: "specs.pickups[0]", label: "pickups[0]", value: "Bridge" },
      { path: "specs.pickups[1]", label: "pickups[1]", value: "Neck" },
    ]);
  });

  it("keeps empty containers as leaves so a blank key stays visible", () => {
    const fields = flattenPayload({ notes: [], meta: {} });

    expect(fields).toEqual([
      { path: "notes", label: "notes", value: "[]" },
      { path: "meta", label: "meta", value: "{}" },
    ]);
  });

  it("preserves non-string leaves and nulls", () => {
    const fields = flattenPayload({ qcPassed: true, count: 0, notes: null });

    expect(fields.map((field) => field.value)).toEqual(["true", "0", "null"]);
  });

  it("returns nothing for a non-object body", () => {
    expect(flattenPayload({})).toEqual([]);
    expect(flattenPayload(null)).toEqual([]);
  });
});

describe("summariseShopFlowPayload", () => {
  it("promotes recognised identifiers whatever casing or separators are used", () => {
    const summary = summariseShopFlowPayload({
      serial_number: "CG-2026-0143",
      Product: "Ciari Ascender Custom",
      sku: "ASC-CST-SBT",
      workOrder: "WO-8892",
    });

    expect(summary.primary).toEqual({ label: "Serial", value: "CG-2026-0143" });
    expect(summary.highlights).toEqual([
      { label: "Serial", value: "CG-2026-0143" },
      { label: "Model", value: "Ciari Ascender Custom" },
      { label: "SKU", value: "ASC-CST-SBT" },
      { label: "Order", value: "WO-8892" },
    ]);
  });

  it("finds identifiers nested inside the payload", () => {
    const summary = summariseShopFlowPayload({
      instrument: { serialNumber: "CG-2026-0144" },
    });

    expect(summary.primary).toEqual({ label: "Serial", value: "CG-2026-0144" });
  });

  it("reports an unrecognised payload without a primary identifier", () => {
    const summary = summariseShopFlowPayload({ anything: "goes" });

    expect(summary.primary).toBeNull();
    expect(summary.isEmpty).toBe(false);
    expect(summary.fields).toHaveLength(1);
  });

  it("flags an empty body", () => {
    expect(summariseShopFlowPayload({}).isEmpty).toBe(true);
  });
});

describe("compactPayload", () => {
  it("truncates long payloads for the table preview", () => {
    const preview = compactPayload({ notes: "x".repeat(200) }, 40);

    expect(preview).toHaveLength(43);
    expect(preview.endsWith("...")).toBe(true);
  });
});
