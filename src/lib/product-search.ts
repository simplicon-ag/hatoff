import type { ShopifyProduct } from "@/lib/shopify";

/**
 * Zentrale, robuste Produktsuche.
 * Wird sowohl von der globalen Suche (Header) als auch der Shop-Seite genutzt,
 * damit überall identische, präzise Ergebnisse erscheinen.
 *
 * Durchsucht werden:
 *  - Titel, Marke, Produkttyp, Handle
 *  - Tags (inkl. Werte hinter Präfixen wie `art:`, `welt:`, `farbe:`)
 *  - Variantenoptionen (Farbe, Grösse, …)
 *  - Beschreibung (Plain + HTML→Text)
 *  - Artikelnummern aus dem Beschreibungstext (z. B. „Artikelnummer: 126430023“)
 *
 * Mehrwort-Suchen: jedes Token muss irgendwo matchen (UND-Logik),
 * darf aber in unterschiedlichen Feldern stehen.
 */

const stripHtml = (html: string): string =>
  html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ");

interface SearchableProduct {
  title: string;
  titleWords: string[];
  vendor: string;
  type: string;
  handle: string;
  rawTags: string[];
  tagParts: Set<string>;
  variantValues: string[];
  description: string;
  descNumbers: Set<string>;
}

const cache = new WeakMap<ShopifyProduct, SearchableProduct>();

function buildSearchable(p: ShopifyProduct): SearchableProduct {
  const cached = cache.get(p);
  if (cached) return cached;

  const n = p.node;
  const title = (n.title ?? "").toLowerCase();
  const titleWords = title.split(/[\s\-/]+/).filter(Boolean);
  const vendor = (n.vendor ?? "").toLowerCase();
  const type = (n.productType ?? "").toLowerCase();
  const handle = (n.handle ?? "").toLowerCase();
  const rawTags = (n.tags ?? []).map((t) => t.toLowerCase());

  const tagParts = new Set<string>();
  rawTags.forEach((t) => {
    tagParts.add(t);
    t.split(/[:\-_/\s]+/)
      .filter(Boolean)
      .forEach((part) => tagParts.add(part));
  });

  const variantValues = (n.variants?.edges ?? []).flatMap((v) =>
    (v.node.selectedOptions ?? []).map((o) => o.value.toLowerCase()),
  );

  const plainDesc = (n.description ?? "").toLowerCase();
  const htmlDesc = n.descriptionHtml ? stripHtml(n.descriptionHtml).toLowerCase() : "";
  const description = `${plainDesc} ${htmlDesc}`.trim();

  // Artikelnummern: alle 5+stelligen Zahlen aus Beschreibung & Tags
  const descNumbers = new Set<string>();
  (description.match(/\b\d{5,}\b/g) ?? []).forEach((m) => descNumbers.add(m));
  rawTags.forEach((t) => {
    const m = t.match(/\b\d{5,}\b/g);
    if (m) m.forEach((x) => descNumbers.add(x));
  });

  const out: SearchableProduct = {
    title,
    titleWords,
    vendor,
    type,
    handle,
    rawTags,
    tagParts,
    variantValues,
    description,
    descNumbers,
  };
  cache.set(p, out);
  return out;
}

/**
 * Score eines Produkts gegen einen Suchstring.
 * Score 0 = kein Treffer. Höher = besser.
 * Cutoff für „relevant“ liegt typischerweise bei 35.
 */
export function scoreProduct(p: ShopifyProduct, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;

  const s = buildSearchable(p);

  let total = 0;
  for (const t of tokens) {
    const isNumeric = /^\d{4,}$/.test(t);
    let best = 0;

    // Exakte / starke Treffer
    if (
      s.handle === t ||
      s.tagParts.has(t) ||
      s.variantValues.includes(t) ||
      s.descNumbers.has(t)
    ) {
      best = 100;
    } else if (isNumeric && s.description.includes(t)) {
      best = 100;
    } else if (s.titleWords.includes(t)) {
      best = Math.max(best, 80);
    } else if (s.vendor === t) {
      best = Math.max(best, 70);
    } else if (s.handle.includes(t)) {
      best = Math.max(best, 60);
    } else if (s.title.startsWith(t)) {
      best = Math.max(best, 50);
    } else if (s.title.includes(t)) {
      best = Math.max(best, 35);
    } else if (s.vendor.includes(t)) {
      best = Math.max(best, 25);
    } else if (s.type.includes(t)) {
      best = Math.max(best, 20);
    } else if (s.rawTags.some((tag) => tag.includes(t))) {
      best = Math.max(best, 15);
    } else if (s.description.includes(t)) {
      // Treffer im Beschreibungstext (Fließtext / HTML-extrahiert)
      best = Math.max(best, 18);
    }

    // Jedes Token MUSS irgendwo matchen (UND-Logik)
    if (best === 0) return 0;
    total += best;
  }
  return total;
}

/**
 * Filtert + sortiert eine Produktliste anhand eines Suchstrings.
 * Wird von der Shop-Seite für die textuelle Filterung benutzt.
 */
export function searchProducts(
  products: ShopifyProduct[],
  query: string,
  minScore = 35,
): ShopifyProduct[] {
  const q = query.trim();
  if (!q) return products;
  return products
    .map((p) => ({ p, s: scoreProduct(p, q) }))
    .filter((x) => x.s >= minScore)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p);
}
