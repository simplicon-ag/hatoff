// product-inventory-sync
// ===========================================================================
// Nightly inventory & price refresh for Casa Moda + Venti products in Shopify.
//
// Per Shopify product (vendor in {Casa Moda, Venti}):
//   1. Read product_import_log.scraped_data → all colour URLs.
//   2. Firecrawl-scrape each colour page and extract:
//        - sizesInStock  ({ size → stock>0 ? true : false })
//        - price_eur, compare_at_price_eur, on_sale
//      Images are deliberately ignored — product images stay untouched.
//   3. Build the desired matrix:  Map<colorName, Map<size, available>>
//   4. Read current Shopify variants and DIFF:
//        - existing variant available on the source  → inventory ON, refresh price
//        - existing variant gone from the source     → inventory OFF
//        - source has a (color × size) we don't have → create the missing variant
//      Variants are NEVER deleted. Images are NEVER changed.
//
// Modes:
//   { mode: "start" }   → reset queue from product_import_log (vendor matches),
//                        set product_import_job to state="syncing" with total.
//   { mode: "tick" }    → only-if-running tick used by pg_cron every 2 minutes.
//   { mode: "batch" }   → process up to N items (default 5) regardless of state.
//                        Used by the manual "Jetzt starten" button + nightly run.
//
// Status / progress is written into product_import_job (singleton row) so the
// existing AdminImport UI can render it.
// ===========================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_DOMAIN = "style-compass-6nrqi.myshopify.com";
const SHOPIFY_ADMIN_VERSION = "2025-07";
const EUR_TO_CHF = 0.95;

// ===========================================================================
// Firecrawl
// ===========================================================================

async function firecrawlScrape(url: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        formats: ["html"],
        onlyMainContent: false,
        waitFor: 1500,
      }),
    });
    if (!res.ok) {
      console.warn(`[sync] firecrawl ${res.status} for ${url}`);
      return null;
    }
    const data = await res.json();
    return (
      (typeof data?.html === "string" && data.html) ||
      (typeof data?.data?.html === "string" && data.data.html) ||
      null
    );
  } catch (e) {
    console.warn(`[sync] firecrawl error:`, e);
    return null;
  }
}

interface SourceColorData {
  colorName: string;
  colorId: string;
  sizes: Map<string, boolean>; // size → in stock
  priceEur: number | null;
  compareAtEur: number | null;
}

const COLOR_RE =
  /\s+(hell|dunkel|mittel|tief|graues?|altes?)?\s*(blau|hellblau|mittelblau|dunkelblau|marine|navy|rot|mittelrot|dunkelrot|weinrot|weiss|weiß|ecru|creme|champagner|champagner[- ]beige|schwarz|tiefschwarz|anthrazit|grau|hellgrau|dunkelgrau|silber|beige|sand|khaki|camel|braun|mittelbraun|dunkelbraun|cognac|gr(?:ue|ü)n|mittelgr(?:ue|ü)n|dunkelgr(?:ue|ü)n|oliv|olive|mint|gelb|senf|ocker|orange|rost|rosa|pink|altrosa|lila|violett|t(?:ue|ü)rkis|petrol)\s*$/i;

function extractColorFromHtml(html: string, fallbackUrl: string): string {
  const m = html.match(/data-elb-product="[^"]*color_title:([^;"]+)/i);
  if (m) return m[1].trim();
  // Fallback: parse from URL slug
  const slug = fallbackUrl.replace(/^https?:\/\/[^/]+\/de\/de\//i, "").replace(/-\d+-\d+\/?$/, "");
  const colorMatch = (" " + slug.replace(/-/g, " ")).match(COLOR_RE);
  if (colorMatch) {
    return colorMatch[0].trim().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return "Unbekannt";
}

function extractSizesFromHtml(html: string): Map<string, boolean> {
  // Parse <option data-article-variant-size="S" data-article-variant-stock="1">
  const sizes = new Map<string, boolean>();
  const re = /data-article-variant-size="([^"]+)"\s+data-article-variant-stock="(\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const size = m[1].trim();
    const stock = parseInt(m[2], 10);
    if (!size) continue;
    // If size already seen with stock>0 keep that (some pages may duplicate)
    const prev = sizes.get(size);
    sizes.set(size, (prev ?? false) || stock > 0);
  }
  return sizes;
}

function extractPriceFromHtml(html: string): { priceEur: number | null; compareAtEur: number | null } {
  // <div class="article-price" data-variant-price ...>...49.99 €...</div>
  // Sale pages additionally render <s>69.99 €</s> for the strikethrough price.
  const blocks = html.match(/<div[^>]*class="[^"]*article-price[^"]*"[\s\S]{0,400}?<\/div>/gi) ?? [];
  const prices: number[] = [];
  for (const b of blocks) {
    const m = b.match(/(\d{1,4}[,.]\d{2})\s*€/);
    if (m) {
      const n = parseFloat(m[1].replace(",", "."));
      if (!isNaN(n) && n > 1 && n < 2000) prices.push(n);
    }
  }
  if (prices.length === 0) {
    const m = html.match(/(\d{1,4}[,.]\d{2})\s*€/);
    if (m) {
      const n = parseFloat(m[1].replace(",", "."));
      if (!isNaN(n)) prices.push(n);
    }
  }
  if (prices.length === 0) return { priceEur: null, compareAtEur: null };
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return { priceEur: min, compareAtEur: max > min + 0.5 ? max : null };
}

async function scrapeColor(url: string, colorId: string, fcKey: string): Promise<SourceColorData | null> {
  const html = await firecrawlScrape(url, fcKey);
  if (!html) return null;
  const sizes = extractSizesFromHtml(html);
  if (sizes.size === 0) {
    console.warn(`[sync] no sizes found for ${url}`);
    return null;
  }
  const colorName = extractColorFromHtml(html, url);
  const { priceEur, compareAtEur } = extractPriceFromHtml(html);
  return { colorName, colorId, sizes, priceEur, compareAtEur };
}

// ===========================================================================
// Shopify (rate-limited)
// ===========================================================================

const SHOPIFY_MIN_GAP_MS = 650;
let lastShopifyCallAt = 0;

async function shopifyFetch(
  url: string,
  init: RequestInit & { adminToken: string },
  attempt = 1,
): Promise<Response> {
  const since = Date.now() - lastShopifyCallAt;
  if (since < SHOPIFY_MIN_GAP_MS) {
    await new Promise((r) => setTimeout(r, SHOPIFY_MIN_GAP_MS - since));
  }
  lastShopifyCallAt = Date.now();

  const { adminToken, headers, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: { ...(headers ?? {}), "X-Shopify-Access-Token": adminToken },
  });

  if (res.status === 429 && attempt <= 4) {
    const retryAfter = parseFloat(res.headers.get("Retry-After") ?? "2");
    const waitMs = Math.max(retryAfter * 1000, 2000 * attempt);
    await res.text().catch(() => "");
    await new Promise((r) => setTimeout(r, waitMs));
    return shopifyFetch(url, init, attempt + 1);
  }
  return res;
}

interface ShopifyVariant {
  id: number;
  option1: string | null; // size
  option2: string | null; // colour
  price: string;
  compare_at_price: string | null;
  sku: string;
  inventory_item_id: number;
  inventory_management: string | null;
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  vendor: string;
  options: Array<{ id: number; name: string; position: number; values: string[] }>;
  variants: ShopifyVariant[];
}

async function getShopifyProduct(productId: string, adminToken: string): Promise<ShopifyProduct | null> {
  const res = await shopifyFetch(
    `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_ADMIN_VERSION}/products/${productId}.json?fields=id,title,handle,vendor,options,variants`,
    { method: "GET", adminToken },
  );
  if (!res.ok) return null;
  const json = await res.json();
  return json?.product ?? null;
}

async function updateVariantPrice(
  variantId: number,
  price: string,
  compareAt: string | null,
  adminToken: string,
): Promise<boolean> {
  const res = await shopifyFetch(
    `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_ADMIN_VERSION}/variants/${variantId}.json`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variant: { id: variantId, price, compare_at_price: compareAt },
      }),
      adminToken,
    },
  );
  return res.ok;
}

async function setInventoryTracking(variantId: number, adminToken: string): Promise<void> {
  // Switch the variant to Shopify-tracked inventory if it isn't already.
  await shopifyFetch(
    `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_ADMIN_VERSION}/variants/${variantId}.json`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variant: { id: variantId, inventory_management: "shopify", inventory_policy: "deny" },
      }),
      adminToken,
    },
  );
}

async function getPrimaryLocationId(adminToken: string): Promise<number | null> {
  // Try /locations.json first (requires read_locations scope)
  const res = await shopifyFetch(
    `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_ADMIN_VERSION}/locations.json`,
    { method: "GET", adminToken },
  );
  if (res.ok) {
    const json = await res.json();
    const loc = json?.locations?.[0];
    if (loc?.id) return loc.id;
  } else {
    const txt = await res.text().catch(() => "");
    console.warn(`[sync] locations.json failed (${res.status}): ${txt.substring(0, 150)} — falling back via inventory_levels`);
  }

  // Fallback: derive location from any existing variant's inventory_levels
  const prodRes = await shopifyFetch(
    `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_ADMIN_VERSION}/products.json?limit=1&fields=id,variants`,
    { method: "GET", adminToken },
  );
  if (!prodRes.ok) return null;
  const prodJson = await prodRes.json();
  const inventoryItemId = prodJson?.products?.[0]?.variants?.[0]?.inventory_item_id;
  if (!inventoryItemId) return null;
  const lvlRes = await shopifyFetch(
    `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_ADMIN_VERSION}/inventory_levels.json?inventory_item_ids=${inventoryItemId}`,
    { method: "GET", adminToken },
  );
  if (!lvlRes.ok) return null;
  const lvlJson = await lvlRes.json();
  return lvlJson?.inventory_levels?.[0]?.location_id ?? null;
}

async function setInventoryLevel(
  inventoryItemId: number,
  locationId: number,
  available: number,
  adminToken: string,
): Promise<boolean> {
  // Make sure the inventory item is connected to the location first (idempotent).
  await shopifyFetch(
    `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_ADMIN_VERSION}/inventory_levels/connect.json`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inventory_item_id: inventoryItemId, location_id: locationId }),
      adminToken,
    },
  ).catch(() => null);

  const res = await shopifyFetch(
    `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_ADMIN_VERSION}/inventory_levels/set.json`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location_id: locationId,
        inventory_item_id: inventoryItemId,
        available,
      }),
      adminToken,
    },
  );
  return res.ok;
}

async function createVariant(
  productId: number,
  size: string,
  color: string,
  price: string,
  compareAt: string | null,
  sku: string,
  adminToken: string,
): Promise<ShopifyVariant | null> {
  const res = await shopifyFetch(
    `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_ADMIN_VERSION}/products/${productId}/variants.json`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variant: {
          option1: size,
          option2: color,
          price,
          compare_at_price: compareAt,
          sku,
          inventory_management: "shopify",
          inventory_policy: "deny",
        },
      }),
      adminToken,
    },
  );
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.warn(`[sync] createVariant failed ${res.status}: ${t.slice(0, 200)}`);
    return null;
  }
  const json = await res.json();
  return json?.variant ?? null;
}

// ===========================================================================
// Token resolution (mirrors product-import-run)
// ===========================================================================

function resolveAdminToken(): string {
  // Prefer the freshly-rotated online token (per-user, ~24h) over the older static admin token
  for (const [k, v] of Object.entries(Deno.env.toObject())) {
    if (k.startsWith("SHOPIFY_ONLINE_ACCESS_TOKEN") && v?.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(v);
        const t = parsed.access_token ?? parsed.accessToken ?? parsed.token;
        if (typeof t === "string" && t.startsWith("shpat_")) return t;
      } catch { /* ignore */ }
    }
  }
  const direct = Deno.env.get("SHOPIFY_ADMIN_API_TOKEN") ?? Deno.env.get("SHOPIFY_ACCESS_TOKEN");
  if (direct && direct.startsWith("shpat_")) return direct;
  return direct ?? "";
}

// ===========================================================================
// Sync one product
// ===========================================================================

interface SyncRow {
  id: string;
  brand: string;
  source_url: string;
  handle: string | null;
  shopify_product_id: string | null;
  scraped_data: {
    color_urls?: Array<{ url: string; colorId: string }>;
    article_id?: string;
    article_number?: string;
  } | null;
}

interface SyncStats {
  newVariants: number;
  setOutOfStock: number;
  setInStock: number;
  pricesUpdated: number;
  colorsScraped: number;
}

async function syncProduct(
  row: SyncRow,
  adminToken: string,
  fcKey: string,
  locationId: number,
): Promise<{ ok: boolean; error?: string; stats?: SyncStats; title?: string }> {
  if (!row.shopify_product_id) return { ok: false, error: "no shopify_product_id" };
  const colorUrls = row.scraped_data?.color_urls ?? [];
  if (colorUrls.length === 0) return { ok: false, error: "no color_urls in scraped_data" };

  // 1) Scrape every colour page (sequentially to be gentle on Firecrawl).
  const sourceColors: SourceColorData[] = [];
  for (const cu of colorUrls) {
    const c = await scrapeColor(cu.url, cu.colorId, fcKey);
    if (c) sourceColors.push(c);
    await new Promise((r) => setTimeout(r, 700));
  }
  if (sourceColors.length === 0) {
    return { ok: false, error: "no colours scraped" };
  }

  // 2) Build target matrix: colorName → Map<size, available>
  const target = new Map<string, Map<string, boolean>>();
  // Aggregate price per colour
  const colorPrices = new Map<string, { price: number | null; compareAt: number | null }>();
  for (const c of sourceColors) {
    const key = c.colorName.toLowerCase();
    target.set(key, c.sizes);
    colorPrices.set(key, { price: c.priceEur, compareAt: c.compareAtEur });
  }

  // 3) Read current Shopify state.
  const product = await getShopifyProduct(row.shopify_product_id, adminToken);
  if (!product) return { ok: false, error: "shopify product not found" };

  // Identify which option index is size vs colour.
  const sizeOption = product.options.find((o) => /grösse|größe|size/i.test(o.name));
  const colorOption = product.options.find((o) => /farbe|color/i.test(o.name));
  if (!sizeOption || !colorOption) {
    return { ok: false, error: "product missing Size or Colour option" };
  }
  const sizeIdx = sizeOption.position; // 1-indexed
  const colorIdx = colorOption.position;

  const variantKey = (size: string, color: string) => `${size.toLowerCase()}|||${color.toLowerCase()}`;
  const existingByKey = new Map<string, ShopifyVariant>();
  for (const v of product.variants) {
    const size = sizeIdx === 1 ? v.option1 : v.option2;
    const color = colorIdx === 1 ? v.option1 : v.option2;
    if (!size || !color) continue;
    existingByKey.set(variantKey(size, color), v);
  }

  const stats: SyncStats = {
    newVariants: 0,
    setOutOfStock: 0,
    setInStock: 0,
    pricesUpdated: 0,
    colorsScraped: sourceColors.length,
  };

  const articleNo = row.scraped_data?.article_number ?? "";

  // 4) Walk every (color, size) from the source — ON or create.
  for (const [colorKeyLower, sizes] of target.entries()) {
    // Find the canonical colour name as it appears on Shopify (case-preserving).
    const canonicalColor =
      product.variants.find((v) => {
        const c = colorIdx === 1 ? v.option1 : v.option2;
        return c?.toLowerCase() === colorKeyLower;
      })?.[colorIdx === 1 ? "option1" : "option2"] ??
      sourceColors.find((c) => c.colorName.toLowerCase() === colorKeyLower)?.colorName ??
      colorKeyLower;

    const priceInfo = colorPrices.get(colorKeyLower);
    const priceChf =
      priceInfo?.price != null ? (priceInfo.price * EUR_TO_CHF).toFixed(2) : null;
    const compareChf =
      priceInfo?.compareAt != null ? (priceInfo.compareAt * EUR_TO_CHF).toFixed(2) : null;

    for (const [size, inStock] of sizes.entries()) {
      const k = variantKey(size, canonicalColor);
      let variant = existingByKey.get(k);

      if (!variant) {
        // Create the missing variant (only when source actually has stock — no
        // point creating phantom variants that never existed).
        if (!inStock || !priceChf) continue;
        const sku = articleNo
          ? `${articleNo}-${size}-${canonicalColor}`.replace(/[^A-Za-z0-9-]/g, "").toUpperCase()
          : `${row.handle ?? "p"}-${size}-${canonicalColor}`
              .replace(/[^A-Za-z0-9-]/g, "")
              .toUpperCase();
        const created = await createVariant(
          product.id,
          size,
          canonicalColor,
          priceChf,
          compareChf,
          sku,
          adminToken,
        );
        if (created) {
          variant = created as ShopifyVariant;
          stats.newVariants++;
        } else {
          continue;
        }
      } else if (priceChf && (variant.price !== priceChf || (variant.compare_at_price ?? null) !== compareChf)) {
        const ok = await updateVariantPrice(variant.id, priceChf, compareChf, adminToken);
        if (ok) stats.pricesUpdated++;
      }

      // Make sure inventory tracking is on, then set the level.
      if (variant.inventory_management !== "shopify") {
        await setInventoryTracking(variant.id, adminToken);
      }
      const ok = await setInventoryLevel(
        variant.inventory_item_id,
        locationId,
        inStock ? 1 : 0,
        adminToken,
      );
      if (ok) {
        if (inStock) stats.setInStock++;
        else stats.setOutOfStock++;
      }
    }
  }

  // 5) For variants the source no longer mentions at all → set inventory 0.
  for (const [k, variant] of existingByKey.entries()) {
    const [sizeLower, colorLower] = k.split("|||");
    const sourceSizes = target.get(colorLower);
    const stillThere = sourceSizes?.get(sizeLower) ?? sourceSizes?.has(sizeLower);
    if (sourceSizes && stillThere) continue;
    if (variant.inventory_management !== "shopify") {
      await setInventoryTracking(variant.id, adminToken);
    }
    const ok = await setInventoryLevel(
      variant.inventory_item_id,
      locationId,
      0,
      adminToken,
    );
    if (ok) stats.setOutOfStock++;
  }

  return { ok: true, stats, title: product.title };
}

// ===========================================================================
// Queue management
// ===========================================================================

async function startSync(
  supabase: ReturnType<typeof createClient>,
): Promise<{ total: number }> {
  // Reset every Casa Moda + Venti row to "sync_pending".
  const { data: rows, error } = await supabase
    .from("product_import_log")
    .select("id")
    .in("brand", ["casa-moda", "venti"])
    .not("shopify_product_id", "is", null);
  if (error) throw error;
  const ids = (rows ?? []).map((r: { id: string }) => r.id);
  if (ids.length > 0) {
    await supabase
      .from("product_import_log")
      .update({ status: "sync_pending", error_message: null, updated_at: new Date().toISOString() })
      .in("id", ids);
  }
  await supabase.from("product_import_job").upsert({
    id: "singleton",
    state: "syncing",
    total: ids.length,
    processed: 0,
    created_count: 0,
    error_count: 0,
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    message: "Inventar-Sync gestartet",
    dry_run: false,
  });
  return { total: ids.length };
}

// ===========================================================================
// Main handler
// ===========================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const mode: "start" | "tick" | "batch" = body.mode ?? "batch";
    const batchSize = Math.max(1, Math.min(5, Number(body.batch_size ?? 3)));

    const adminToken = resolveAdminToken();
    if (!adminToken) {
      return new Response(JSON.stringify({ error: "SHOPIFY_ADMIN_API_TOKEN fehlt" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const fcKey = Deno.env.get("FIRECRAWL_API_KEY") ?? "";
    if (!fcKey) {
      return new Response(JSON.stringify({ error: "FIRECRAWL_API_KEY fehlt" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "start") {
      const r = await startSync(supabase);
      return new Response(JSON.stringify({ started: true, total: r.total }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // tick: only run if a sync is currently in progress
    const { data: jobRow } = await supabase
      .from("product_import_job")
      .select("state")
      .eq("id", "singleton")
      .maybeSingle();

    if (mode === "tick" && jobRow?.state !== "syncing") {
      return new Response(JSON.stringify({ skipped: true, reason: "no_sync_running", state: jobRow?.state }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (jobRow?.state === "stopping") {
      await supabase.from("product_import_job").update({
        state: "stopped", message: "Sync gestoppt", updated_at: new Date().toISOString(),
      }).eq("id", "singleton");
      return new Response(JSON.stringify({ stopped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const locationId = await getPrimaryLocationId(adminToken);
    if (!locationId) {
      return new Response(JSON.stringify({ error: "No Shopify location found" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch a small batch
    const { data: rows, error: fetchErr } = await supabase
      .from("product_import_log")
      .select("id, brand, source_url, handle, shopify_product_id, scraped_data")
      .eq("status", "sync_pending")
      .order("updated_at", { ascending: true })
      .limit(batchSize);
    if (fetchErr) throw fetchErr;

    if (!rows || rows.length === 0) {
      await supabase.from("product_import_job").update({
        state: "done",
        message: "Inventar-Sync abgeschlossen",
        updated_at: new Date().toISOString(),
      }).eq("id", "singleton");
      return new Response(JSON.stringify({ done: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ handle: string | null; ok: boolean; stats?: SyncStats; error?: string }> = [];
    for (const r of rows) {
      await supabase.from("product_import_log").update({
        status: "syncing", updated_at: new Date().toISOString(),
      }).eq("id", r.id);
      try {
        const out = await syncProduct(r as SyncRow, adminToken, fcKey, locationId);
        if (out.ok) {
          await supabase.from("product_import_log").update({
            status: "synced",
            error_message: out.stats
              ? `+${out.stats.newVariants} Varianten · ${out.stats.setInStock} verfügbar · ${out.stats.setOutOfStock} ausverkauft · ${out.stats.pricesUpdated} Preise`
              : null,
            updated_at: new Date().toISOString(),
          }).eq("id", r.id);
          await supabase.from("product_import_job").update({
            message: `Synced: ${out.title ?? r.handle ?? r.id}`,
            updated_at: new Date().toISOString(),
          }).eq("id", "singleton");
          results.push({ handle: r.handle, ok: true, stats: out.stats });
        } else {
          await supabase.from("product_import_log").update({
            status: "sync_error",
            error_message: out.error ?? "unknown",
            updated_at: new Date().toISOString(),
          }).eq("id", r.id);
          results.push({ handle: r.handle, ok: false, error: out.error });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await supabase.from("product_import_log").update({
          status: "sync_error", error_message: msg, updated_at: new Date().toISOString(),
        }).eq("id", r.id);
        results.push({ handle: r.handle, ok: false, error: msg });
      }
    }

    // Update counters
    const { count: pendingTotal } = await supabase
      .from("product_import_log")
      .select("id", { count: "exact", head: true })
      .eq("status", "sync_pending");
    const { count: doneTotal } = await supabase
      .from("product_import_log")
      .select("id", { count: "exact", head: true })
      .eq("status", "synced");
    const { count: errTotal } = await supabase
      .from("product_import_log")
      .select("id", { count: "exact", head: true })
      .eq("status", "sync_error");

    await supabase.from("product_import_job").update({
      processed: doneTotal ?? 0,
      created_count: doneTotal ?? 0,
      error_count: errTotal ?? 0,
      updated_at: new Date().toISOString(),
      ...(pendingTotal === 0 ? { state: "done", message: "Inventar-Sync abgeschlossen" } : {}),
    }).eq("id", "singleton");

    return new Response(JSON.stringify({
      processed: rows.length,
      pending: pendingTotal ?? 0,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sync] fatal:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
