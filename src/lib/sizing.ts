// Sizing logic — fetch + interpret brand size guides from the size-guide edge function
import { supabase } from "@/integrations/supabase/client";
import type { ShopifyProduct } from "@/lib/shopify";

export type Brand = "venti" | "casa-moda";

export interface SizeRow {
  label: string;
  values: (string | null)[];
}

export interface SizeTable {
  fit: string;
  category: string;
  sizeLabels: string[];
  rows: SizeRow[];
}

export interface BrandGuide {
  brand: Brand;
  source_url: string;
  fetched_at: string;
  tables: SizeTable[];
}

/**
 * Fetch brand size guides from the size-guide edge function (cached server-side).
 */
export async function fetchSizeGuides(brand?: Brand): Promise<BrandGuide[]> {
  const { data, error } = await supabase.functions.invoke("size-guide", {
    method: "GET",
    body: undefined,
    headers: {},
  } as Parameters<typeof supabase.functions.invoke>[1]);

  // supabase-js doesn't expose query params on GET well — fallback to direct fetch
  if (error || !data) {
    const url = new URL(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/size-guide`,
    );
    if (brand) url.searchParams.set("brand", brand);
    const res = await fetch(url.toString(), {
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ""}`,
      },
    });
    if (!res.ok) throw new Error(`size-guide failed: ${res.status}`);
    const j = await res.json();
    return j.guides as BrandGuide[];
  }
  return (data as { guides: BrandGuide[] }).guides;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Product → category mapping                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export type ProductCategory =
  | "hemd"
  | "polo"
  | "anzughose"
  | "sakko"
  | "weste"
  | "hose"
  | "jeans"
  | "bermuda"
  | "pullover"
  | "strick"
  | "jacke"
  | "accessoire"
  | "unknown";

export function detectBrand(product: ShopifyProduct | null | undefined): Brand | null {
  if (!product) return null;
  const v = product.node.vendor?.toLowerCase() ?? "";
  if (v.includes("venti")) return "venti";
  if (v.includes("casa") || v.includes("moda")) return "casa-moda";
  // fall back to handle prefix
  const h = product.node.handle?.toLowerCase() ?? "";
  if (h.startsWith("venti-")) return "venti";
  if (h.startsWith("casa-moda-")) return "casa-moda";
  return null;
}

export function detectCategory(product: ShopifyProduct | null | undefined): ProductCategory {
  if (!product) return "unknown";
  const t = `${product.node.title} ${product.node.productType ?? ""} ${product.node.handle}`.toLowerCase();
  if (/(einstecktuch|krawatte|fliege|schal|gürtel|guertel)/.test(t)) return "accessoire";
  if (/(business)?hemd/.test(t)) return "hemd";
  if (/polo/.test(t)) return "polo";
  if (/anzughose/.test(t)) return "anzughose";
  if (/(sakko|blazer)/.test(t)) return "sakko";
  if (/weste/.test(t)) return "weste";
  if (/jeans/.test(t)) return "jeans";
  if (/bermuda|short/.test(t)) return "bermuda";
  if (/pullover|sweat/.test(t)) return "pullover";
  if (/strick|cardigan/.test(t)) return "strick";
  if (/(blouson|steppjacke|hemdjacke|mantel|jacke)/.test(t)) return "jacke";
  if (/(chino|hose)/.test(t)) return "hose";
  return "unknown";
}

/**
 * Pick the most relevant size tables for a product (category + brand).
 * Returns one table per fit (e.g. Body Fit + Modern Fit for Hemden).
 */
export function selectTablesFor(
  guide: BrandGuide | undefined,
  category: ProductCategory,
): SizeTable[] {
  if (!guide) return [];
  const wanted = (() => {
    switch (category) {
      case "hemd":
        return /hemd/i;
      case "anzughose":
      case "hose":
      case "jeans":
        return /hose/i;
      case "sakko":
        return /sakko/i;
      case "weste":
        return /weste/i;
      case "polo":
      case "pullover":
      case "strick":
        // No dedicated tables on brand pages — fall back to Hemden chest measurements
        return /hemd/i;
      default:
        return /hemd/i;
    }
  })();
  return guide.tables.filter((t) => wanted.test(t.category));
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Size-from-measurements recommendation                                      */
/* ────────────────────────────────────────────────────────────────────────── */

function num(v: string | null): number | null {
  if (!v) return null;
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export interface MeasurementInput {
  chest?: number; // Brust / Oberweite (cm)
  waist?: number; // Bund / Taille (cm)
  hip?: number; // Hüfte / Saumweite (cm)
  collar?: number; // Kragenweite (cm) — Hemden
  inseam?: number; // Schrittlänge (cm) — Hosen
  height?: number; // optional
}

export interface SizeRecommendation {
  size: string;
  fit: string;
  category: string;
  reason: string;
  matchedRows: { label: string; value: string; userValue: number; delta: number }[];
}

/** For each size column, sum the absolute deltas across all matching measurements; pick lowest. */
export function recommendFromMeasurements(
  table: SizeTable,
  input: MeasurementInput,
): SizeRecommendation | null {
  // Map our input fields to potential row labels in the table
  const targets: { key: keyof MeasurementInput; matchers: RegExp[] }[] = [
    { key: "chest", matchers: [/oberweite/i, /brust/i] },
    { key: "waist", matchers: [/taillenweite/i, /taille/i] },
    { key: "hip", matchers: [/saumweite/i, /hüft/i, /huft/i] },
    { key: "inseam", matchers: [/schrittlänge/i, /schrittlange/i] },
  ];

  const used: { row: SizeRow; user: number }[] = [];
  for (const t of targets) {
    const u = input[t.key];
    if (typeof u !== "number" || !Number.isFinite(u)) continue;
    const row = table.rows.find((r) => t.matchers.some((m) => m.test(r.label)));
    if (row) used.push({ row, user: u });
  }

  if (used.length === 0) return null;

  // Score each size column
  let best: { idx: number; total: number } | null = null;
  for (let idx = 0; idx < table.sizeLabels.length; idx++) {
    let total = 0;
    let valid = 0;
    for (const u of used) {
      const v = num(u.row.values[idx]);
      if (v == null) continue;
      total += Math.abs(v - u.user);
      valid++;
    }
    if (valid === 0) continue;
    if (!best || total < best.total) best = { idx, total };
  }

  if (!best) return null;

  const matched = used
    .map((u) => {
      const v = num(u.row.values[best!.idx]);
      if (v == null) return null;
      return {
        label: u.row.label,
        value: u.row.values[best!.idx]!,
        userValue: u.user,
        delta: +(v - u.user).toFixed(1),
      };
    })
    .filter(Boolean) as SizeRecommendation["matchedRows"];

  return {
    size: table.sizeLabels[best.idx],
    fit: table.fit,
    category: table.category,
    reason:
      matched.length === 1
        ? `Beste Übereinstimmung bei ${matched[0].label}`
        : `Beste Gesamt-Übereinstimmung über ${matched.length} Maße`,
    matchedRows: matched,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Known-size translation                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

/** Map common letter sizes (S/M/L/XL) → likely chest in cm to drive recommendation. */
const LETTER_TO_CHEST: Record<string, number> = {
  XS: 92,
  S: 100,
  M: 108,
  L: 116,
  XL: 124,
  XXL: 132,
  "3XL": 140,
};

/** Map shirt collar (cm) → chest (rough heuristic). */
function collarToChest(collar: number): number {
  // 38 → ~96, 40 → ~104, 42 → ~112, 44 → ~120, 46 → ~128
  return Math.round((collar - 38) * 4 + 96);
}

/** Map waist (cm) → suit/pants size (approx EU). */
function waistToSuit(waist: number): number {
  // Rough: EU = waist + ~9 (varies). Returns even number.
  const s = Math.round((waist + 9) / 2) * 2;
  return Math.max(44, Math.min(64, s));
}

export interface KnownSizeInput {
  letter?: string; // "L" / "XL" etc.
  collar?: number; // shirt collar size (e.g. 41)
  waist?: number; // pants waist size (e.g. 33 inches OR cm depending on input)
  waistUnit?: "cm" | "inch";
}

/** Convert a "known size" into measurement inputs we can feed to recommendFromMeasurements. */
export function knownSizeToMeasurements(input: KnownSizeInput): MeasurementInput {
  const out: MeasurementInput = {};

  if (input.letter) {
    const key = input.letter.toUpperCase().replace(/\s/g, "");
    if (LETTER_TO_CHEST[key]) out.chest = LETTER_TO_CHEST[key];
  }

  if (input.collar) {
    out.chest = out.chest ?? collarToChest(input.collar);
    out.collar = input.collar;
  }

  if (input.waist) {
    const cm = input.waistUnit === "inch" ? Math.round(input.waist * 2.54) : input.waist;
    out.waist = cm;
  }

  return out;
}
