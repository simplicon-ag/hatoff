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

export const PRODUCTS_QUERY = `
  query GetProducts($first: Int!, $query: String, $after: String) {
    products(first: $first, query: $query, after: $after) {
      edges {
        cursor
        node {
          id
          title
          description
          handle
          vendor
          productType
          tags
          priceRange { minVariantPrice { amount currencyCode } }
          images(first: 5) { edges { node { url altText } } }
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

export const PRODUCT_BY_HANDLE_QUERY = `
  query GetProduct($handle: String!) {
    product(handle: $handle) {
      id
      title
      description
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
 */
export async function fetchAllProducts(query?: string, pageSize = 250): Promise<ShopifyProduct[]> {
  const all: ShopifyProduct[] = [];
  let after: string | null = null;
  // Hard safety cap to prevent runaway loops
  for (let i = 0; i < 50; i++) {
    const data = await storefrontApiRequest(PRODUCTS_QUERY, {
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
  const results = await Promise.all(handles.map((h) => fetchProductByHandle(h)));
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
