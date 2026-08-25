import { describe, expect, it } from "vitest";

import { parseWorkOrder } from "./contract";

/** Trimmed from a real Shop Flow delivery (invoice 1688). */
const BUILD_PAYLOAD = {
  invoice: {
    id: 1688,
    Status: "Complete",
    InstrumentType: "build",
    InstName: "Ciari Trio HSH",
    InstSerialNumber: "26S1460",
    Notes: [{ Date: "2026-08-18", Note: "Invoice Completed" }],
    Parts: [
      {
        Id: "Seafoam Green - TRIO",
        PartName: "Seafoam Green - TRIO",
        Quantity: 1,
        CostEach: "0.00",
        GroupName: "Color (Options)",
      },
      {
        Id: "MTE1.0-152 Rev A",
        PartName: "RH Pickguard Humbucker Single Coil (Black)",
        Quantity: 1,
        CostEach: "2.38",
        GroupName: "Pickguard (Options)",
      },
      { Id: "OEM-4081N", PartName: "OEM-4081N - Nickel Bridge", Quantity: 1 },
      { Id: "Manual", PartName: "Manual", Quantity: 0 },
    ],
  },
  customer: { CustID: 1405, FullName: "Foster, Michael" },
  instrument: {
    Model: "Trio HSH",
    Submodel: "Seafoam Green",
    SerialNumb: "26S1460",
    Brand: "Ciari",
    Year: "2026",
    ReferenceNumber: "Artist",
  },
};

/** A repair on a customer's own guitar (invoice 1725). */
const REPAIR_PAYLOAD = {
  invoice: {
    id: 1725,
    Status: "Complete",
    InstrumentType: "instrument",
    InstName: "Ciari Ascender Standard",
    InstSerialNumber: "22S146",
    Parts: [],
  },
  instrument: {
    Model: "Ascender Standard",
    Submodel: "Red",
    SerialNumb: "22S146",
  },
};

describe("parseWorkOrder", () => {
  it("parses a build and marks it as producing stock", () => {
    const { data, error } = parseWorkOrder(BUILD_PAYLOAD);
    expect(error).toBeNull();
    expect(data).toMatchObject({
      invoiceId: "1688",
      isBuild: true,
      instrumentType: "build",
      serialNumber: "26S1460",
      model: "Trio HSH",
    });
  });

  it("marks a repair so it never increments finished goods", () => {
    const { data, error } = parseWorkOrder(REPAIR_PAYLOAD);
    expect(error).toBeNull();
    expect(data?.isBuild).toBe(false);
    expect(data?.instrumentType).toBe("instrument");
  });

  it("separates colour options from consumable parts", () => {
    const { data } = parseWorkOrder(BUILD_PAYLOAD);
    expect(data?.configurationParts.map((p) => p.Id)).toEqual([
      "Seafoam Green - TRIO",
    ]);
    expect(data?.consumableParts.map((p) => p.Id)).toEqual([
      "MTE1.0-152 Rev A",
      "OEM-4081N",
    ]);
  });

  it("drops zero-quantity lines from consumption", () => {
    const { data } = parseWorkOrder(BUILD_PAYLOAD);
    expect(data?.consumableParts.map((p) => p.Id)).not.toContain("Manual");
  });

  it("derives the finish from the colour option line", () => {
    const { data } = parseWorkOrder(BUILD_PAYLOAD);
    expect(data?.finish).toBe("Seafoam Green");
  });

  it("derives orientation from the pickguard", () => {
    const { data } = parseWorkOrder(BUILD_PAYLOAD);
    expect(data?.orientation).toBe("Right");
  });

  it("leaves finish null when no colour line is present", () => {
    const { data } = parseWorkOrder(REPAIR_PAYLOAD);
    expect(data?.finish).toBeNull();
  });

  it("accepts unknown keys so a Shop Flow addition cannot reject a delivery", () => {
    const { data, error } = parseWorkOrder({
      invoice: { id: 99, Parts: [], SomethingNew: true },
      instrument: { Model: "Trio SSS", Extra: 1 },
    });
    expect(error).toBeNull();
    expect(data?.invoiceId).toBe("99");
  });

  it("accepts a string invoice id", () => {
    const { data } = parseWorkOrder({ invoice: { id: "A-12", Parts: [] } });
    expect(data?.invoiceId).toBe("A-12");
  });

  it("rejects a payload with no invoice", () => {
    const { data, error } = parseWorkOrder({ foo: "bar" });
    expect(data).toBeNull();
    expect(error).toBeTruthy();
  });

  it("defaults a missing instrument type rather than throwing", () => {
    const { data } = parseWorkOrder({ invoice: { id: 1, Parts: [] } });
    expect(data?.instrumentType).toBe("unknown");
    expect(data?.isBuild).toBe(false);
  });
});
