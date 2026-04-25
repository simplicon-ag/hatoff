import fs26Image from "@/assets/saison-fs26.jpg";
import hw26Image from "@/assets/saison-hw26.jpg";
import type { ShopifyProduct } from "@/lib/shopify";

export type SaisonSlug = "fs-2026" | "hw-2026";

export interface SaisonConfig {
  slug: SaisonSlug;
  shortLabel: string;       // e.g. "F/S 2026"
  fullLabel: string;        // e.g. "Frühling / Sommer 2026"
  kicker: string;           // small uppercase line
  headline: string;         // big editorial headline
  subline: string;          // 1–2 sentence intro
  story: string;            // longer paragraph
  heroImage: string;
  // Heuristic keywords (matched against title, productType, tags, vendor)
  keywords: string[];
  // Colour-keywords typically tagged as `farbe:<value>` or appearing in the title
  colors: string[];
  // Categories that strongly indicate this season (productType / tag fragment)
  categories: string[];
  // Categories that disqualify a product (so winter coats don't show in S/S)
  excludeCategories: string[];
  cross: SaisonSlug;        // the "other" season for cross-linking
}

export const saisons: Record<SaisonSlug, SaisonConfig> = {
  "fs-2026": {
    slug: "fs-2026",
    shortLabel: "F/S 2026",
    fullLabel: "Frühling / Sommer 2026",
    kicker: "Saison F/S 2026",
    headline: "Leichte Stoffe. Lange Tage.",
    subline:
      "Linnen, Baumwolle, ungebleichte Töne. Looks für die Stunden zwischen Espresso und Sonnenuntergang.",
    story:
      "Die F/S-26-Auswahl folgt einem einfachen Prinzip: weniger Schichten, mehr Atem. Helle Hemden, weite Hosen, unverbrauchte Farben. Stücke, die du anziehst und vergisst – im besten Sinne.",
    heroImage: fs26Image,
    keywords: [
      "leinen",
      "linen",
      "kurzarm",
      "short sleeve",
      "polo",
      "sommer",
      "summer",
      "shorts",
      "bermuda",
      "badehose",
      "swim",
      "tank",
      "espadrille",
      "loafer",
      "sandale",
    ],
    colors: [
      "weiss",
      "weiß",
      "white",
      "beige",
      "ecru",
      "creme",
      "cream",
      "sand",
      "hellblau",
      "light blue",
      "mint",
      "rosa",
      "pink",
      "gelb",
      "yellow",
      "stone",
      "natur",
      "olive",
      "khaki",
    ],
    categories: ["polo", "shorts", "t-shirt", "tee", "leinen", "swim", "badehose"],
    excludeCategories: [
      "mantel",
      "coat",
      "wintermantel",
      "daunen",
      "puffer",
      "parka",
      "fleece",
      "strick",
      "wool",
      "cashmere",
    ],
    cross: "hw-2026",
  },
  "hw-2026": {
    slug: "hw-2026",
    shortLabel: "H/W 2026",
    fullLabel: "Herbst / Winter 2026",
    kicker: "Saison H/W 2026 · Vorschau",
    headline: "Wärme mit Haltung.",
    subline:
      "Wolle, Strick, schwere Stoffe. Looks, die dem Wind etwas entgegensetzen – und dabei ruhig bleiben.",
    story:
      "Die H/W-26-Auswahl ist eine Studie in Tiefe: Marineblau, Anthrazit, gebrannter Bordeaux. Mantel über Strick, Boots über Hose. Stücke, die mit der Saison reifen, statt sie nur zu überstehen.",
    heroImage: hw26Image,
    keywords: [
      "pullover",
      "sweater",
      "strick",
      "knit",
      "jacke",
      "jacket",
      "mantel",
      "coat",
      "parka",
      "puffer",
      "daune",
      "down",
      "fleece",
      "flanell",
      "flannel",
      "cord",
      "corduroy",
      "wolle",
      "wool",
      "cashmere",
      "winter",
      "boots",
      "stiefel",
      "schal",
      "scarf",
      "mütze",
      "beanie",
    ],
    colors: [
      "navy",
      "marine",
      "schwarz",
      "black",
      "anthrazit",
      "charcoal",
      "bordeaux",
      "burgundy",
      "dunkelgrün",
      "dark green",
      "forest",
      "braun",
      "brown",
      "camel",
      "rost",
      "rust",
      "tabak",
      "tobacco",
      "grau",
      "grey",
      "gray",
    ],
    categories: ["pullover", "strick", "jacke", "mantel", "coat", "knit", "boots", "schal", "mütze"],
    excludeCategories: [
      "shorts",
      "bermuda",
      "badehose",
      "swim",
      "espadrille",
      "sandale",
      "tank",
    ],
    cross: "fs-2026",
  },
};

export const saisonList: SaisonConfig[] = [saisons["fs-2026"], saisons["hw-2026"]];

const norm = (s: string) => s.toLowerCase();

const productHaystack = (p: ShopifyProduct["node"]) =>
  [
    p.title,
    p.productType ?? "",
    p.vendor ?? "",
    ...(p.tags ?? []),
  ]
    .map(norm)
    .join(" | ");

/**
 * Score: higher = stronger match for that season.
 * Negative values from the exclusion list disqualify a product.
 */
export function scoreProductForSaison(
  product: ShopifyProduct,
  saison: SaisonConfig,
): number {
  const hay = productHaystack(product.node);

  // Hard exclusions first
  for (const ex of saison.excludeCategories) {
    if (hay.includes(ex)) return -1;
  }

  let score = 0;
  for (const kw of saison.keywords) {
    if (hay.includes(kw)) score += 2;
  }
  for (const cat of saison.categories) {
    if (hay.includes(cat)) score += 3;
  }
  for (const c of saison.colors) {
    if (hay.includes(c)) score += 1;
  }
  return score;
}

/**
 * Filter & sort products by relevance for a saison. Drops anything with score <= 0.
 */
export function filterProductsForSaison(
  products: ShopifyProduct[],
  saison: SaisonConfig,
): ShopifyProduct[] {
  return products
    .map((p) => ({ p, s: scoreProductForSaison(p, saison) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p);
}
