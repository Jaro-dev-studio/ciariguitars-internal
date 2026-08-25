import { z } from "zod";

import {
  finishFromConfigurationLine,
  isConfigurationLine,
  orientationFromParts,
  type ShopFlowPartLine,
} from "./part-matching";

/**
 * The shape Shop Flow actually posts on work order completion: a service
 * invoice with the instrument and customer attached. Deliberately lenient -
 * unknown keys pass through, and only the fields the integration depends on
 * are required, so a Shop Flow-side addition never rejects a delivery.
 */

const numberish = z.union([z.number(), z.string()]).nullish();

const partLineSchema = z
  .object({
    Id: z.union([z.string(), z.number()]).nullish(),
    PartName: z.string().nullish(),
    Quantity: numberish,
    CostEach: numberish,
    GroupName: z.string().nullish(),
    GroupId: z.number().nullish(),
  })
  .passthrough();

const invoiceSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    Status: z.string().nullish(),
    // "build" produces new stock. "instrument" is a repair on a guitar the
    // customer already owns.
    InstrumentType: z.string().nullish(),
    InstName: z.string().nullish(),
    InstSerialNumber: z.string().nullish(),
    Parts: z.array(partLineSchema).default([]),
  })
  .passthrough();

const instrumentSchema = z
  .object({
    Model: z.string().nullish(),
    Submodel: z.string().nullish(),
    SerialNumb: z.string().nullish(),
    InstName: z.string().nullish(),
    Brand: z.string().nullish(),
    Year: z.string().nullish(),
    ReferenceNumber: z.string().nullish(),
  })
  .passthrough();

export const shopFlowWorkOrderSchema = z
  .object({
    invoice: invoiceSchema,
    instrument: instrumentSchema.optional(),
    // Customer is present but carries PII we deliberately do not read.
  })
  .passthrough();

export type ShopFlowWorkOrderPayload = z.infer<typeof shopFlowWorkOrderSchema>;

export interface ParsedWorkOrder {
  invoiceId: string;
  /** True when this produces a new instrument rather than repairing one. */
  isBuild: boolean;
  instrumentType: string;
  status: string | null;
  serialNumber: string | null;
  instrumentName: string | null;
  model: string | null;
  submodel: string | null;
  /** Derived from the colour option line, or the submodel when it holds one. */
  finish: string | null;
  /** Derived from the pickguard part description. */
  orientation: "Right" | "Left" | null;
  /** Part lines that represent real stock consumption. */
  consumableParts: ShopFlowPartLine[];
  /** Colour and option lines, excluded from stock movement. */
  configurationParts: ShopFlowPartLine[];
}

function toQuantity(value: unknown): number {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Validates a raw Shop Flow delivery and derives the fields the integration
 * needs. Returns a discriminated result rather than throwing so the webhook can
 * always answer 200 and record why a payload was unusable.
 */
export function parseWorkOrder(
  payload: unknown
): { data: ParsedWorkOrder; error: null } | { data: null; error: string } {
  const result = shopFlowWorkOrderSchema.safeParse(payload);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      data: null,
      error: issue
        ? `${issue.path.join(".") || "payload"}: ${issue.message}`
        : "Payload did not match the Shop Flow work order shape",
    };
  }

  const { invoice, instrument } = result.data;
  const parts = (invoice.Parts ?? []) as ShopFlowPartLine[];

  const configurationParts = parts.filter(isConfigurationLine);
  const consumableParts = parts.filter(
    (part) => !isConfigurationLine(part) && toQuantity(part.Quantity) > 0
  );

  const finishFromOption = configurationParts
    .map(finishFromConfigurationLine)
    .find((value): value is string => Boolean(value));

  const submodel = instrument?.Submodel?.trim() || null;
  const instrumentType = (invoice.InstrumentType ?? "").trim() || "unknown";

  return {
    data: {
      invoiceId: String(invoice.id),
      isBuild: instrumentType.toLowerCase() === "build",
      instrumentType,
      status: invoice.Status?.trim() || null,
      serialNumber:
        invoice.InstSerialNumber?.trim() || instrument?.SerialNumb?.trim() || null,
      instrumentName:
        invoice.InstName?.trim() || instrument?.InstName?.trim() || null,
      model: instrument?.Model?.trim() || null,
      submodel,
      // Submodel is inconsistent - it has held a colour, a pickup brand, "Plus"
      // and "Unknown" - so the colour option line is preferred when present.
      finish: finishFromOption ?? null,
      orientation: orientationFromParts(parts),
      consumableParts,
      configurationParts,
    },
    error: null,
  };
}

export function partQuantity(part: ShopFlowPartLine): number {
  return toQuantity(part.Quantity);
}
