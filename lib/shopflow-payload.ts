/**
 * Helpers for reading the arbitrary JSON that Shop Flow posts to
 * `/api/webhooks/shopflow`. The receiver stores payloads verbatim and makes no
 * assumptions about their shape, so the UI has to discover the structure at
 * render time rather than relying on a fixed schema.
 */

export interface PayloadField {
  /** Dot/bracket path into the payload, e.g. `instrument.specs[0].finish`. */
  path: string;
  /** Last path segment, used as the display label. */
  label: string;
  value: string;
}

/** Guards against a pathological payload freezing the detail view. */
const MAX_DEPTH = 6;
const MAX_FIELDS = 300;

function formatLeaf(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  return String(value);
}

function lastSegment(path: string): string {
  const segments = path.split(".");
  return segments[segments.length - 1] || path;
}

/**
 * Walks a payload into a flat list of leaf values so it can be shown as a
 * readable field table instead of raw JSON. Empty objects and arrays are kept
 * as leaves, since "this key arrived empty" is itself worth seeing.
 */
export function flattenPayload(payload: unknown): PayloadField[] {
  const fields: PayloadField[] = [];

  const visit = (value: unknown, path: string, depth: number) => {
    if (fields.length >= MAX_FIELDS) return;

    if (value === null || typeof value !== "object") {
      fields.push({ path, label: lastSegment(path), value: formatLeaf(value) });
      return;
    }

    if (depth >= MAX_DEPTH) {
      fields.push({ path, label: lastSegment(path), value: JSON.stringify(value) });
      return;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        fields.push({ path, label: lastSegment(path), value: "[]" });
        return;
      }
      value.forEach((entry, index) => visit(entry, `${path}[${index}]`, depth + 1));
      return;
    }

    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      fields.push({ path, label: lastSegment(path), value: "{}" });
      return;
    }
    for (const [key, entry] of entries) {
      visit(entry, path ? `${path}.${key}` : key, depth + 1);
    }
  };

  visit(payload, "", 0);

  return fields.filter((field) => field.path !== "");
}

/**
 * Fields worth promoting to the table and the top of the detail view. Matched
 * case-insensitively against the last path segment with separators stripped,
 * so `serial_number`, `serialNumber` and `SerialNumber` all resolve.
 */
const HIGHLIGHTS: Array<{ label: string; keys: string[] }> = [
  { label: "Serial", keys: ["serialnumber", "serial"] },
  { label: "Model", keys: ["model", "productname", "product", "instrumentname"] },
  { label: "SKU", keys: ["sku", "variantsku"] },
  { label: "Order", keys: ["ordernumber", "orderid", "workorder", "workordernumber"] },
  { label: "Stage", keys: ["stage", "step", "status", "state"] },
  { label: "Completed by", keys: ["completedby", "builder", "technician", "operator"] },
  { label: "Completed at", keys: ["completedat", "finishedat", "completiondate"] },
];

function normaliseKey(label: string): string {
  return label.toLowerCase().replace(/[_\-\s]/g, "");
}

export interface PayloadHighlight {
  label: string;
  value: string;
}

export interface ShopFlowPayloadSummary {
  fields: PayloadField[];
  highlights: PayloadHighlight[];
  /** First highlight, used as the row's headline in the events table. */
  primary: PayloadHighlight | null;
  isEmpty: boolean;
}

export function summariseShopFlowPayload(payload: unknown): ShopFlowPayloadSummary {
  const fields = flattenPayload(payload);

  const byKey = new Map<string, string>();
  for (const field of fields) {
    const key = normaliseKey(field.label);
    // First occurrence wins: shallower keys are visited before nested ones.
    if (!byKey.has(key) && field.value.trim()) byKey.set(key, field.value);
  }

  const highlights = HIGHLIGHTS.reduce<PayloadHighlight[]>((found, highlight) => {
    const match = highlight.keys.map((key) => byKey.get(key)).find(Boolean);
    if (match) found.push({ label: highlight.label, value: match });
    return found;
  }, []);

  return {
    fields,
    highlights,
    primary: highlights[0] ?? null,
    isEmpty: fields.length === 0,
  };
}

/** Single-line preview of the whole payload for the table's fallback column. */
export function compactPayload(payload: unknown, maxLength = 120): string {
  if (payload === null || payload === undefined) return "-";
  const text = typeof payload === "object" ? JSON.stringify(payload) : String(payload);
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

export function formatPayloadJson(payload: unknown): string {
  if (payload === null || payload === undefined) return "";
  return typeof payload === "object"
    ? JSON.stringify(payload, null, 2)
    : String(payload);
}
