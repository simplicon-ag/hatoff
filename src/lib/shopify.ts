import { toast } from "sonner";

export const SHOPIFY_API_VERSION = "2025-07";
export const SHOPIFY_STORE_PERMANENT_DOMAIN = "style-compass-6nrqi.myshopify.com";
export const SHOPIFY_STOREFRONT_URL = `https://${SHOPIFY_STORE_PERMANENT_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`;
export const SHOPIFY_STOREFRONT_TOKEN = "82d196dbe5af439ca85dd9e1689f9c50";

export interface ShopifyProduct {
  node: {
    id: string;
    title: string;
    description: string;
    descriptionHtml: string;
    handle: string;
    vendor: string;
    productType: string;
    tags: string[];
    priceRange: {
      minVariantPrice: { amount: string; currencyCode: string };
    };
    images: { edges: Array<{ node: { url: string; altText: string | null } }> };
    variants: {
      edges: Array<{
        node: {
          id: string;
          title: string;
          price: { amount: string; currencyCode: string };
          compareAtPrice?: { amount: string; currencyCode: string } | null;
          availableForSale: boolean;
          selectedOptions: Array<{ name: string; value: string }>;
          image?: { url: string; altText: string | null } | null;
        };
      }>;
    };
    options: Array<{ name: string; values: string[] }>;
  };
}

/**
 * Vollständige Produkt-Query — wird auf Detail-Seiten und überall dort verwendet,
 * wo `descriptionHtml`, alle Varianten und alle Bilder gebraucht werden.
 */
export const PRODUCTS_QUERY = `
  query GetProducts($first: Int!, $query: String, $after: String) {
    products(first: $first, query: $query, after: $after) {
      edges {
        cursor
        node {
          id
          title
          description
          descriptionHtml
          handle
          vendor
          productType
          tags
          priceRange { minVariantPrice { amount currencyCode } }
          images(first: 30) { edges { node { url altText } } }
          variants(first: 50) {
            edges {
              node {
                id
                title
                price { amount currencyCode }
                compareAtPrice { amount currencyCode }
                availableForSale
                selectedOptions { name value }
                image { url altText }
              }
            }
          }
          options { name values }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

/**
 * Schlanke Query für Listings/Karten — keine Description, weniger Bilder/Varianten.
 * Reduziert die Antwortgrösse um ~70 % und beschleunigt das initiale Rendern deutlich.
 */
export const PRODUCTS_LIST_QUERY = `
  query GetProductsList($first: Int!, $query: String, $after: String) {
    products(first: $first, query: $query, after: $after) {
      edges {
        cursor
        node {
          id
          title
          handle
          vendor
          productType
          tags
          priceRange { minVariantPrice { amount currencyCode } }
          images(first: 30) { edges { node { url altText } } }
          variants(first: 100) {
            edges {
              node {
                id
                title
                price { amount currencyCode }
                compareAtPrice { amount currencyCode }
                availableForSale
                selectedOptions { name value }
                image { url altText }
              }
            }
          }
          options { name values }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export const PRODUCT_BY_HANDLE_QUERY = `
  query GetProduct($handle: String!) {
    product(handle: $handle) {
      id
      title
      description
      descriptionHtml
      handle
      vendor
      productType
      tags
      priceRange { minVariantPrice { amount currencyCode } }
      images(first: 30) { edges { node { url altText } } }
      variants(first: 100) {
        edges {
          node {
            id
            title
            price { amount currencyCode }
            compareAtPrice { amount currencyCode }
            availableForSale
            selectedOptions { name value }
            image { url altText }
          }
        }
      }
      options { name values }
      badges: metafield(namespace: "custom", key: "badges") { value type }
    }
  }
`;

export async function storefrontApiRequest(query: string, variables: Record<string, unknown> = {}) {
  const response = await fetch(SHOPIFY_STOREFRONT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": SHOPIFY_STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (response.status === 402) {
    toast.error("Shopify: Zahlung erforderlich", {
      description: "Der Shopify-Store benötigt einen aktiven Plan. Bitte im Shopify-Admin upgraden.",
    });
    return;
  }

  if (!response.ok) throw new Error(`Shopify HTTP ${response.status}`);

  const data = await response.json();
  if (data.errors) throw new Error(`Shopify error: ${data.errors.map((e: { message: string }) => e.message).join(", ")}`);
  return data;
}

export async function fetchProducts(first = 50, query?: string): Promise<ShopifyProduct[]> {
  const data = await storefrontApiRequest(PRODUCTS_QUERY, { first, query: query ?? null, after: null });
  return data?.data?.products?.edges ?? [];
}

/**
 * Fetch ALL products from Shopify, paginating through the Storefront API.
 * Storefront API caps `first` at 250 per request, so we loop until hasNextPage is false.
 *
 * Ergebnisse werden für die Lebensdauer des Tabs im Modul-Cache gehalten,
 * damit Navigation (z.B. Produkt → Zurück zum Shop) nicht jedes Mal alle
 * Produkte neu lädt. Parallele Aufrufe teilen sich dieselbe In-Flight-Promise.
 */
const productListCache = new Map<string, ShopifyProduct[]>();
const productListInFlight = new Map<string, Promise<ShopifyProduct[]>>();

const LS_PREFIX = "hatoff:plist:v6:";
const LS_TTL_MS = 15 * 60 * 1000; // 15 Minuten

function readLocalCache(key: string): ShopifyProduct[] | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { t: number; d: ShopifyProduct[] };
    if (Date.now() - parsed.t > LS_TTL_MS) return null;
    return parsed.d;
  } catch {
    return null;
  }
}

function writeLocalCache(key: string, data: ShopifyProduct[]) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify({ t: Date.now(), d: data }));
  } catch {
    // Quota überschritten — ignorieren, In-Memory-Cache reicht.
  }
}

export function clearProductListCache() {
  productListCache.clear();
  productListInFlight.clear();
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(LS_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export async function fetchAllProducts(query?: string, pageSize = 250): Promise<ShopifyProduct[]> {
  const cacheKey = `${query ?? ""}::${pageSize}`;
  const cached = productListCache.get(cacheKey);
  if (cached) return cached;
  const inFlight = productListInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  // Persistenter Cache: instant aus localStorage zurückgeben (für Navigation/Re-Visit).
  const local = readLocalCache(cacheKey);
  if (local && local.length > 0) {
    productListCache.set(cacheKey, local);
    // Im Hintergrund frisch nachladen, damit zukünftige Aufrufe aktuell bleiben.
    void (async () => {
      try {
        const fresh = await fetchAllProductsRaw(query, pageSize);
        productListCache.set(cacheKey, fresh);
        writeLocalCache(cacheKey, fresh);
      } catch {
        /* ignore */
      }
    })();
    return local;
  }

  const promise = fetchAllProductsRaw(query, pageSize)
    .then((all) => {
      productListCache.set(cacheKey, all);
      writeLocalCache(cacheKey, all);
      productListInFlight.delete(cacheKey);
      return all;
    })
    .catch((err) => {
      productListInFlight.delete(cacheKey);
      throw err;
    });

  productListInFlight.set(cacheKey, promise);
  return promise;
}

async function fetchAllProductsRaw(query: string | undefined, pageSize: number): Promise<ShopifyProduct[]> {
  const all: ShopifyProduct[] = [];
  let after: string | null = null;
  for (let i = 0; i < 50; i++) {
    const data = await storefrontApiRequest(PRODUCTS_LIST_QUERY, {
      first: pageSize,
      query: query ?? null,
      after,
    });
    const products = data?.data?.products;
    if (!products) break;
    all.push(...(products.edges ?? []));
    if (!products.pageInfo?.hasNextPage) break;
    after = products.pageInfo.endCursor;
  }
  return all;
}

export async function fetchProductByHandle(handle: string) {
  const data = await storefrontApiRequest(PRODUCT_BY_HANDLE_QUERY, { handle });
  return data?.data?.product ?? null;
}

export async function fetchProductsByHandles(handles: string[]): Promise<ShopifyProduct[]> {
  // Handles können einen Farb-Suffix tragen (z.B. "casa-moda-pullover-14504#color=Dunkelblau"),
  // der nicht zum Shopify-Handle gehört. Beim Fetch entfernen, damit das Produkt geladen wird.
  const cleaned = handles.map((h) => h.split("#")[0]);
  const results = await Promise.all(cleaned.map((h) => fetchProductByHandle(h)));
  return results
    .filter(Boolean)
    .map((node) => ({ node }) as ShopifyProduct);
}

/**
 * Findet die Farb-Option (Farbe / Color / Colour) eines Produkts, falls vorhanden.
 */
export function getColorOption(product: ShopifyProduct["node"]) {
  return product.options.find((o) => /farbe|color|colour/i.test(o.name));
}

/**
 * Expandiert die Produktliste so, dass jedes Mehrfarb-Produkt
 * pro Farbvariante als eigene Karte erscheint. Produkte ohne Farb-Option
 * bleiben unverändert.
 */
export interface ExpandedProduct extends ShopifyProduct {
  initialColor?: string;
}

export function expandProductsByColor(products: ShopifyProduct[]): ExpandedProduct[] {
  const out: ExpandedProduct[] = [];
  for (const p of products) {
    const colorOpt = getColorOption(p.node);
    if (!colorOpt || colorOpt.values.length <= 1) {
      out.push(p);
      continue;
    }
    for (const color of colorOpt.values) {
      out.push({ ...p, initialColor: color });
    }
  }
  return out;
}

/**
 * Formatiert einen Preis im HATOFF-Schema:
 *  - Währung immer CHF (Shopify liefert teilweise andere Codes für Sandbox-Stores)
 *  - Endet immer auf `.95` (psychologische Preisgestaltung)
 *  - Ganzzahliger Frankenbetrag wird vom Shopify-Sales-Preis übernommen,
 *    Rappen werden auf `.95` normalisiert (z.B. 89.00 → CHF 89.95, 120.50 → CHF 120.95)
 */
export function formatPrice(amount: string | number, _currencyCode = "CHF") {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (!isFinite(num)) return "CHF –";
  const francs = Math.floor(num);
  return `CHF ${francs}.95`;
}

/**
 * Shopify-CDN Bilder-Resize: hängt width/height-Parameter an die URL.
 * Liefert kleinere, schnellere Bilder für Listings/Karten.
 * Bei Nicht-Shopify-URLs wird die Original-URL zurückgegeben.
 */
export function shopifyImage(url: string | null | undefined, width: number, height?: number): string {
  if (!url) return "";
  if (!url.includes("cdn.shopify.com")) return url;
  try {
    const u = new URL(url);
    u.searchParams.set("width", String(width));
    if (height) u.searchParams.set("height", String(height));
    return u.toString();
  } catch {
    return url;
  }
}
