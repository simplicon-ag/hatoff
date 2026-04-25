// Worker: processes a small batch of pending products.
// Steps per item:
//  1. Scrape product page via Firecrawl (HTML+links+screenshot off, html only)
//  2. Extract title, description, price, compare_at_price, image URLs, sizes
//  3. If dry_run: store scraped_data, mark `scraped`
//  4. Else: download images, upload to Shopify, create product+variants, mark `created`
//
// Trigger: POST { batch_size?: number }. Returns processed count.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_DOMAIN = "style-compass-6nrqi.myshopify.com";
const SHOPIFY_ADMIN_VERSION = "2025-07";

interface ScrapedProduct {
  title: string;
  description: string;
  description_html: string;
  material: string;
  article_number: string;
  care_labels: string[];
  price_eur: number | null;
  compare_at_price_eur: number | null;
  on_sale: boolean;
  image_urls: string[];
  sizes: string[];
  product_type: string | null;
  vendor: string;
  tags: string[];
}

const EUR_TO_CHF = 0.95;

async function firecrawlScrape(
  url: string,
  apiKey: string,
): Promise<string | null> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["html"],
        onlyMainContent: false,
        // Casa Moda / Venti are SPAs — material, care, description and SKU
        // are only injected after JS hydration. We need ~12s + a scroll to
        // ensure the product-detail accordion is rendered into the DOM.
        waitFor: 12000,
        actions: [
          { type: "wait", milliseconds: 4000 },
          { type: "scroll", direction: "down" },
          { type: "wait", milliseconds: 3000 },
        ],
      }),
    });
    if (!res.ok) {
      console.error(`[worker] firecrawl ${res.status} for ${url}`);
      return null;
    }
    const data = await res.json();
    return (
      (typeof data?.html === "string" && data.html) ||
      (typeof data?.data?.html === "string" && data.data.html) ||
      null
    );
  } catch (err) {
    console.error(`[worker] firecrawl error:`, err);
    return null;
  }
}


function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/** Extract article id and color id from product URL.
 *  https://www.casamoda.com/de/de/t-shirt-blau-14899-154 → { articleId: "14899", colorId: "154" } */
function parseProductIds(url: string): { articleId: string; colorId: string } | null {
  const m = url.match(/-(\d+)-(\d+)\/?$/);
  if (!m) return null;
  return { articleId: m[1], colorId: m[2] };
}

/** Build a clean title from the <title> tag content.
 *  Casa Moda format: "T-Shirt Blau 126340041 - CASAMODA"
 *  Venti format:     "Businesshemd Hellblau - Modern Fit 001480 - VENTI" */
function cleanTitle(rawTitle: string, brand: string): string {
  let t = decode(rawTitle).trim();
  t = t.replace(/\s*-\s*(CASAMODA|VENTI)\s*$/i, "");
  t = t.replace(/\s+\d{6,}\s*$/g, "");
  return t.trim();
}

/** Strip a colour token from the end of a title so we get the colour-neutral
 *  base title (e.g. "Businesshemd Hellblau" → "Businesshemd"). */
const COLOR_WORDS_RE =
  /\s+(hell|dunkel|mittel|tief|graues?|altes?)?\s*(blau|hellblau|mittelblau|dunkelblau|marine|navy|rot|mittelrot|dunkelrot|weinrot|weiss|weiß|ecru|creme|champagner|champagner[- ]beige|schwarz|tiefschwarz|anthrazit|grau|hellgrau|dunkelgrau|silber|beige|sand|khaki|camel|braun|mittelbraun|dunkelbraun|cognac|gr(?:ue|ü)n|mittelgr(?:ue|ü)n|dunkelgr(?:ue|ü)n|oliv|olive|mint|gelb|senf|ocker|orange|rost|rosa|pink|altrosa|lila|violett|t(?:ue|ü)rkis|petrol)\s*$/i;
function stripColorFromTitle(title: string): string {
  let t = title;
  for (let i = 0; i < 3; i++) {
    const m = t.match(COLOR_WORDS_RE);
    if (!m) break;
    t = t.slice(0, t.length - m[0].length).trim();
  }
  return t.replace(/[\s,–-]+$/g, "").trim();
}

/** Pull the colour name from a (Casa Moda / Venti) product title. */
function extractColorFromTitle(title: string): string | null {
  const m = title.match(COLOR_WORDS_RE);
  if (!m) return null;
  // Re-build the matched colour phrase preserving case but trimmed
  return m[0].trim().replace(/\s+/g, " ");
}

const BRAND_DEFAULT_SIZES: Record<string, string[]> = {
  Hemd: ["38", "39/40", "41/42", "43/44", "45/46", "47/48"],
  Hose: ["46", "48", "50", "52", "54", "56"],
  Shirt: ["S", "M", "L", "XL", "XXL"],
  Polo: ["S", "M", "L", "XL", "XXL"],
  Strick: ["S", "M", "L", "XL", "XXL"],
  Jacke: ["46", "48", "50", "52", "54", "56"],
  Sakko: ["46", "48", "50", "52", "54", "56"],
  Accessoire: ["One Size"],
};

function extractFromHtml(html: string, brand: string, sourceUrl: string): ScrapedProduct {
  const ids = parseProductIds(sourceUrl);

  // 1) Title: prefer <h1>, then meta og:title, then <title>, then slug fallback.
  // Casa Moda's <title> is buggy ("Loyalty Wallet" everywhere), so H1 wins.
  let title = "";
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    const inner = h1Match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (inner.length > 1 && inner.length < 200) title = decode(inner);
  }
  if (!title) {
    const og = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
    if (og) title = cleanTitle(og[1], brand);
  }
  if (!title) {
    const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (t) {
      const cleaned = cleanTitle(t[1], brand);
      // Only use it if it doesn't look like a generic UI label
      if (cleaned && !/loyalty|wallet|warenkorb|cart|404/i.test(cleaned)) {
        title = cleaned;
      }
    }
  }
  if (!title) {
    // Slug fallback: "freizeithemd-kurzarm-blau" → "Freizeithemd Kurzarm Blau"
    const slug = sourceUrl.replace(/^https?:\/\/[^/]+\/de\/de\//i, "").replace(/-\d+-\d+\/?$/, "");
    title = slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  // 2) Description: Casa Moda / Venti put the marketing copy + material + care
  //    in a hydrated <div class="article-detail"> block. We pull the FULL block,
  //    strip outer wrapper, and reuse the inner HTML for Shopify body_html.
  let description = "";
  let descriptionHtml = "";
  let material = "";
  let articleNumber = "";
  const careLabels: string[] = [];

  // (a) marketing copy: first <p> in product description area
  // The hydrated structure on casamoda.com is:
  //   <div class="row article-detail-text">
  //     <p>...marketing text...</p>
  //   </div>
  const marketingMatch = html.match(
    /<(?:div|section)[^>]*class="[^"]*article-detail-text[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section)>/i,
  );
  if (marketingMatch) {
    const inner = marketingMatch[1];
    // Take only the first <p> with substantial text
    const pMatch = inner.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (pMatch) {
      const text = decode(pMatch[1].replace(/<[^>]+>/g, " "))
        .replace(/\s+/g, " ").trim();
      if (text.length > 40) description = text;
    }
  }
  // Fallback: meta description
  if (!description) {
    const metaDesc = html.match(
      /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
    );
    if (metaDesc) description = decode(metaDesc[1]);
  }

  // (b) Material — "<strong>Material</strong><br> 100 % Baumwolle"
  const matMatch = html.match(
    /<strong[^>]*>\s*Material\s*<\/strong>\s*<br\s*\/?>\s*([^<]+)/i,
  );
  if (matMatch) material = decode(matMatch[1]).replace(/\s+/g, " ").trim();

  // (c) Article number
  const artMatch = html.match(
    /<strong[^>]*>\s*Artikelnummer\s*<\/strong>\s*<br\s*\/?>\s*([^<]+)/i,
  );
  if (artMatch) articleNumber = decode(artMatch[1]).replace(/\s+/g, " ").trim();

  // (d) Care icons — pull alt-text from <img class="care-icon" ... alt="...">
  const careRegex =
    /<img[^>]*class="[^"]*care-icon[^"]*"[^>]*alt="([^"]+)"/gi;
  let careMatch: RegExpExecArray | null;
  const seenCare = new Set<string>();
  while ((careMatch = careRegex.exec(html)) !== null) {
    const label = decode(careMatch[1])
      .replace(/^Icon:\s*/i, "")
      .trim();
    if (label && !seenCare.has(label)) {
      seenCare.add(label);
      careLabels.push(label);
    }
  }

  // Build rich body_html for Shopify
  const parts: string[] = [];
  if (description) parts.push(`<p>${description}</p>`);
  if (material) {
    parts.push(`<p><strong>Material:</strong> ${material}</p>`);
  }
  if (careLabels.length > 0) {
    parts.push(
      `<p><strong>Pflegehinweise:</strong></p><ul>${
        careLabels.map((c) => `<li>${c}</li>`).join("")
      }</ul>`,
    );
  }
  if (articleNumber) {
    parts.push(
      `<p><small>Artikelnummer: ${articleNumber}</small></p>`,
    );
  }
  descriptionHtml = parts.join("\n");

  // 3) Price: prefer <div class="article-price"> blocks (definitive), else fallback to most-frequent.
  let price_eur: number | null = null;
  let compare_at_price_eur: number | null = null;

  const articlePriceBlocks = html.match(
    /<div[^>]*class="[^"]*article-price[^"]*"[\s\S]{0,400}?<\/div>/gi,
  ) ?? [];
  if (articlePriceBlocks.length > 0) {
    const prices: number[] = [];
    for (const block of articlePriceBlocks) {
      const m = block.match(/(\d{1,4}[,.]\d{2})\s*€/);
      if (m) {
        const n = parseFloat(m[1].replace(",", "."));
        if (!isNaN(n) && n > 1 && n < 2000) prices.push(n);
      }
    }
    if (prices.length > 0) {
      // Lowest = current price (sale or normal), highest = compare_at if differs
      price_eur = Math.min(...prices);
      const max = Math.max(...prices);
      if (max > price_eur + 0.5) compare_at_price_eur = max;
    }
  }

  // Fallback: frequency-based extraction from all "X,XX €" patterns
  if (price_eur === null) {
    const priceMatches = html.match(/(\d{1,4}[,.]\d{2})\s*€/g) ?? [];
    const nums = priceMatches
      .map((m) => parseFloat(m.replace(/[€\s]/g, "").replace(",", ".")))
      .filter((n) => !isNaN(n) && n > 5 && n < 1000);
    if (nums.length > 0) {
      const freq: Record<string, number> = {};
      for (const n of nums) freq[n.toFixed(2)] = (freq[n.toFixed(2)] ?? 0) + 1;
      const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
      price_eur = parseFloat(sorted[0][0]);
    }
  }
  const on_sale = compare_at_price_eur !== null;

  // 4) Images: imgix.net product images filtered by article ID
  // Format: https://<brand>-b2c-(cloud-)?production.imgix.net/product/<articleId>/<colorId>/<articleId>-<colorId>-image-N-<hash>.jpg
  const imgUrls = new Set<string>();
  if (ids) {
    const { articleId, colorId } = ids;
    // Match images whose path contains /product/<articleId>/<colorId>/
    const imgRegex = new RegExp(
      `https://[a-z0-9.-]*imgix\\.net/product/${articleId}/${colorId}/[^"'\\s]+?-image-\\d+-[a-f0-9]+\\.(?:jpg|jpeg|png|webp)`,
      "gi",
    );
    const m = html.match(imgRegex) ?? [];
    // Dedupe by image-N (ignoring imgix transform suffix)
    const seen = new Map<string, string>();
    for (const u of m) {
      const cleanUrl = u.split("?")[0]; // strip imgix params
      const imgN = cleanUrl.match(/-image-(\d+)-/);
      const key = imgN ? imgN[1] : cleanUrl;
      if (!seen.has(key)) {
        // Use a high-res variant (no width param = full size)
        seen.set(key, cleanUrl);
      }
    }
    // Sort by image number ascending
    const sortedImgs = Array.from(seen.entries()).sort((a, b) =>
      Number(a[0]) - Number(b[0]),
    );
    for (const [, url] of sortedImgs) imgUrls.add(url);
  }

  // 5) Product type heuristic
  let product_type: string | null = null;
  const t = title.toLowerCase();
  if (/sakko/.test(t)) product_type = "Sakko";
  else if (/anzug/.test(t)) product_type = "Sakko";
  else if (/hemd/.test(t)) product_type = "Hemd";
  else if (/hose|chino|jeans|bermuda/.test(t)) product_type = "Hose";
  else if (/polo/.test(t)) product_type = "Polo";
  else if (/shirt|t-shirt/.test(t)) product_type = "Shirt";
  else if (/strick|pullover|sweater|sweat|cardigan/.test(t)) product_type = "Strick";
  else if (/jacke|mantel|parka|weste/.test(t)) product_type = "Jacke";
  else if (/krawatt|fliege|tuch|gürtel|guertel|schal|cap/.test(t)) product_type = "Accessoire";

  // 6) Sizes: use sensible defaults per product type (page sizes are JS-loaded)
  const sizes = product_type
    ? BRAND_DEFAULT_SIZES[product_type] ?? ["S", "M", "L", "XL", "XXL"]
    : ["S", "M", "L", "XL", "XXL"];

  return {
    title,
    description,
    description_html: descriptionHtml,
    material,
    article_number: articleNumber,
    care_labels: careLabels,
    price_eur,
    compare_at_price_eur,
    on_sale,
    image_urls: Array.from(imgUrls).slice(0, 6),
    sizes,
    product_type,
    vendor: brand === "casa-moda" ? "Casa Moda" : "Venti",
    tags: [brand, ...(product_type ? [product_type.toLowerCase()] : [])],
  };
}

// ---------- Rate-limited Shopify fetch helper ----------
// Shopify Admin REST API: 2 calls/sec sustained, bucket of 40.
// We pace at ~1.5/sec (650ms gap) and retry 429 with Retry-After.
const SHOPIFY_MIN_GAP_MS = 650;
let lastShopifyCallAt = 0;

async function shopifyFetch(
  url: string,
  init: RequestInit & { adminToken: string },
  attempt = 1,
): Promise<Response> {
  // Pace requests
  const since = Date.now() - lastShopifyCallAt;
  if (since < SHOPIFY_MIN_GAP_MS) {
    await new Promise((r) => setTimeout(r, SHOPIFY_MIN_GAP_MS - since));
  }
  lastShopifyCallAt = Date.now();

  const { adminToken, headers, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: {
      ...(headers ?? {}),
      "X-Shopify-Access-Token": adminToken,
    },
  });

  if (res.status === 429 && attempt <= 4) {
    const retryAfter = parseFloat(res.headers.get("Retry-After") ?? "2");
    const waitMs = Math.max(retryAfter * 1000, 2000 * attempt);
    console.warn(
      `[worker] 429 rate-limit, retry ${attempt}/4 after ${waitMs}ms`,
    );
    // Drain body to free the connection
    await res.text().catch(() => "");
    await new Promise((r) => setTimeout(r, waitMs));
    return shopifyFetch(url, init, attempt + 1);
  }

  return res;
}

async function uploadImageToShopify(
  productId: string,
  imageUrl: string,
  adminToken: string,
): Promise<boolean> {
  try {
    const res = await shopifyFetch(
      `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_ADMIN_VERSION}/products/${productId}/images.json`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: { src: imageUrl } }),
        adminToken,
      },
    );
    if (!res.ok) {
      console.error(`[worker] image upload ${res.status}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[worker] image upload error:", err);
    return false;
  }
}

/** Look up an existing product by handle. Returns its Shopify ID or null. */
async function findShopifyProductByHandle(
  handle: string,
  adminToken: string,
): Promise<string | null> {
  try {
    const res = await shopifyFetch(
      `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_ADMIN_VERSION}/products.json?handle=${encodeURIComponent(handle)}&fields=id,handle&limit=1`,
      { method: "GET", adminToken },
    );
    if (!res.ok) {
      await res.text().catch(() => "");
      return null;
    }
    const json = await res.json();
    const p = json?.products?.[0];
    return p?.id ? String(p.id) : null;
  } catch {
    return null;
  }
}

/** Per-colour scraped data used to build a multi-variant product. */
interface ColorData {
  colorName: string;       // e.g. "Hellblau"
  colorId: string;         // e.g. "314"
  scraped: ScrapedProduct;
}

async function createMultiColorProduct(
  base: ScrapedProduct,
  colors: ColorData[],
  handle: string,
  adminToken: string,
): Promise<{ id: string; duplicate?: boolean; variantImageMap: Array<{ colorName: string; imageSrc: string | null }> } | null> {
  // Use the cheapest price across colours as the published price.
  const minPriceEur = colors.reduce(
    (m, c) => (c.scraped.price_eur != null && c.scraped.price_eur < m ? c.scraped.price_eur : m),
    base.price_eur ?? Number.POSITIVE_INFINITY,
  );
  const compareEur = colors.reduce<number | null>(
    (m, c) => {
      const v = c.scraped.compare_at_price_eur;
      if (v == null) return m;
      if (m == null) return v;
      return v > m ? v : m;
    },
    base.compare_at_price_eur,
  );
  const priceChf = isFinite(minPriceEur) ? (minPriceEur * EUR_TO_CHF).toFixed(2) : "0.00";
  const compareAt = compareEur ? (compareEur * EUR_TO_CHF).toFixed(2) : null;

  // Build the cross-product Größe × Farbe.
  const sizes = base.sizes.length > 0 ? base.sizes : ["One Size"];
  const colorNames = colors.map((c) => c.colorName);

  const variants = [];
  for (const c of colors) {
    // Prefer the real manufacturer article number from each colour's scrape.
    // Fallback to the base article number, then to the URL-derived handle.
    const articleNo = c.scraped.article_number || base.article_number || "";
    const skuBase = articleNo
      ? articleNo.replace(/[^a-z0-9-]/gi, "")
      : `${handle}-${c.colorId}`.replace(/[^a-z0-9-]/gi, "").toLowerCase();
    for (const size of sizes) {
      variants.push({
        option1: size,
        option2: c.colorName,
        price: priceChf,
        compare_at_price: compareAt,
        sku: `${skuBase}-${size}`.replace(/[^A-Za-z0-9-]/g, "").toUpperCase(),
        inventory_management: null,
        inventory_policy: "continue",
      });
    }
  }

  const body = {
    product: {
      title: base.title || handle,
      body_html: base.description_html || base.description || "",
      vendor: base.vendor,
      product_type: base.product_type ?? "Bekleidung",
      tags: [
        ...base.tags,
        ...colors
          .map((c) => c.scraped.article_number)
          .filter((n): n is string => !!n)
          .map((n) => `art:${n}`),
      ].join(","),
      handle,
      status: "active",
      options: [
        { name: "Grösse", values: sizes },
        { name: "Farbe", values: colorNames },
      ],
      variants,
    },
  };

  const res = await shopifyFetch(
    `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_ADMIN_VERSION}/products.json`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      adminToken,
    },
  );
  if (!res.ok) {
    const errText = await res.text();
    console.error(`[worker] create product ${res.status}: ${errText}`);
    if (res.status === 422 && /handle/i.test(errText) && /taken/i.test(errText)) {
      const existing = await findShopifyProductByHandle(handle, adminToken);
      if (existing) return { id: existing, duplicate: true, variantImageMap: [] };
    }
    throw new Error(`Shopify ${res.status}: ${errText.slice(0, 300)}`);
  }
  const json = await res.json();
  const productId = String(json.product.id);
  // Map each colour to its first image so we can attach images to variants later.
  const variantImageMap = colors.map((c) => ({
    colorName: c.colorName,
    imageSrc: c.scraped.image_urls[0] ?? null,
  }));
  return { id: productId, variantImageMap };
}

/** Upload an image and link it to all variants of a given colour. */
async function uploadColorImage(
  productId: string,
  imageUrl: string,
  variantIds: string[],
  adminToken: string,
): Promise<boolean> {
  try {
    const res = await shopifyFetch(
      `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_ADMIN_VERSION}/products/${productId}/images.json`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: { src: imageUrl, variant_ids: variantIds },
        }),
        adminToken,
      },
    );
    if (!res.ok) {
      console.error(`[worker] color image ${res.status}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[worker] color image error:", err);
    return false;
  }
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    // Sequential processing with rate limit → keep batches small
    const batchSize = Math.min(Math.max(Number(body.batch_size ?? 2), 1), 4);

    // Check job state
    const { data: job } = await supabase
      .from("product_import_job")
      .select("*")
      .eq("id", "singleton")
      .single();

    if (!job) {
      return new Response(
        JSON.stringify({ success: false, error: "no job row" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (job.state === "stopping" || job.state === "stopped" || job.state === "idle") {
      await supabase
        .from("product_import_job")
        .update({
          state: "stopped",
          message: "Gestoppt",
          updated_at: new Date().toISOString(),
        })
        .eq("id", "singleton");
      return new Response(
        JSON.stringify({ success: true, state: "stopped", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Worker lock: if another worker updated the job in the last 25s, skip this tick
    // to prevent overlapping workers hammering the Shopify rate limit.
    if (job.state === "running" && job.updated_at) {
      const ageMs = Date.now() - new Date(job.updated_at).getTime();
      if (ageMs < 25_000) {
        console.log(`[worker] skip tick — another worker active ${ageMs}ms ago`);
        return new Response(
          JSON.stringify({ success: true, state: "running", processed: 0, skipped: "lock" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Heartbeat — claim the lock now so overlapping ticks bail out
    await supabase
      .from("product_import_job")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", "singleton");


    const dryRun = Boolean(job.dry_run);
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY") ?? "";

    // Resolve a working Shopify Admin token. Order of preference:
    //   1) SHOPIFY_ADMIN_API_TOKEN (manual custom-app token)
    //   2) SHOPIFY_ACCESS_TOKEN    (legacy Lovable token)
    //   3) SHOPIFY_ONLINE_ACCESS_TOKEN:user:* (current Lovable connection — JSON wrapped)
    function resolveAdminToken(): { token: string; source: string } {
      const direct =
        Deno.env.get("SHOPIFY_ADMIN_API_TOKEN") ??
        Deno.env.get("SHOPIFY_ACCESS_TOKEN");
      if (direct && direct.startsWith("shpat_")) {
        return { token: direct, source: "SHOPIFY_ADMIN_API_TOKEN/ACCESS_TOKEN" };
      }
      // Look for SHOPIFY_ONLINE_ACCESS_TOKEN:user:* (JSON-wrapped)
      for (const [k, v] of Object.entries(Deno.env.toObject())) {
        if (k.startsWith("SHOPIFY_ONLINE_ACCESS_TOKEN") && v?.trim().startsWith("{")) {
          try {
            const parsed = JSON.parse(v);
            const t = parsed.access_token ?? parsed.accessToken ?? parsed.token;
            if (typeof t === "string" && t.startsWith("shpat_")) {
              return { token: t, source: `${k} (Lovable Verbindung)` };
            }
          } catch { /* ignore */ }
        }
      }
      // Last resort: return whatever direct value we had (even if not shpat_)
      return { token: direct ?? "", source: "fallback" };
    }

    const { token: adminToken, source: tokenSource } = resolveAdminToken();

    if (!dryRun) {
      if (!adminToken) {
        await supabase
          .from("product_import_job")
          .update({
            state: "error",
            message:
              "SHOPIFY_ADMIN_API_TOKEN nicht konfiguriert — bitte Secret setzen.",
            updated_at: new Date().toISOString(),
          })
          .eq("id", "singleton");
        return new Response(
          JSON.stringify({ success: false, error: "no admin token" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Fail-fast auth probe — verify token works before processing batch
      const tokenPrefix = adminToken.slice(0, 6);
      const tokenLen = adminToken.length;
      console.log(
        `[worker] token source=${tokenSource} prefix=${tokenPrefix}... length=${tokenLen} domain=${SHOPIFY_DOMAIN}`,
      );
      const probe = await fetch(
        `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_ADMIN_VERSION}/shop.json`,
        { headers: { "X-Shopify-Access-Token": adminToken } },
      );
      if (probe.status === 401 || probe.status === 403) {
        const body = await probe.text().catch(() => "");
        console.error(`[worker] auth probe failed ${probe.status}: ${body}`);
        await supabase
          .from("product_import_job")
          .update({
            state: "error",
            message: `Shopify-Token ungültig (${probe.status}) — bitte SHOPIFY_ADMIN_API_TOKEN aktualisieren. Quelle: ${tokenSource}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", "singleton");
        return new Response(
          JSON.stringify({
            success: false,
            error: `shopify auth ${probe.status}`,
            token_source: tokenSource,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Pull a batch of pending items (need scraped_data for color_urls)
    const { data: items, error: fetchErr } = await supabase
      .from("product_import_log")
      .select("id, brand, source_url, handle, scraped_data")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (fetchErr) throw fetchErr;

    if (!items || items.length === 0) {
      await supabase
        .from("product_import_job")
        .update({
          state: "done",
          message: "Alle Produkte verarbeitet",
          updated_at: new Date().toISOString(),
        })
        .eq("id", "singleton");
      return new Response(
        JSON.stringify({ success: true, state: "done", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let processed = 0;
    let createdCount = 0;
    let errorCount = 0;

    for (const item of items) {
      processed++;

      try {
        // Resolve list of colour URLs. Fallback: just the source_url as a
        // single colour group (handles legacy entries without scraped_data).
        const sd = (item.scraped_data ?? {}) as {
          color_urls?: Array<{ url: string; colorId: string }>;
        };
        const colorUrls = sd.color_urls && sd.color_urls.length > 0
          ? sd.color_urls
          : [{ url: item.source_url, colorId: "0" }];

        await supabase
          .from("product_import_log")
          .update({
            status: "scraping",
            dry_run: dryRun,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        // Scrape every colour sequentially.
        const colors: ColorData[] = [];
        for (const cu of colorUrls) {
          const html = await firecrawlScrape(cu.url, firecrawlKey);
          if (!html) {
            console.warn(`[worker] firecrawl failed for ${cu.url} — skipping colour`);
            continue;
          }
          const sc = extractFromHtml(html, item.brand, cu.url);
          if (!sc.title || sc.price_eur === null) {
            console.warn(`[worker] incomplete data for ${cu.url} — skipping colour`);
            continue;
          }
          // Derive colour name from the title (or fall back to colorId)
          const colorName = extractColorFromTitle(sc.title) || `Farbe ${cu.colorId}`;
          colors.push({ colorName, colorId: cu.colorId, scraped: sc });
        }

        if (colors.length === 0) {
          await supabase
            .from("product_import_log")
            .update({
              status: "error",
              error_message: `Keine Farb-Variante konnte gescraped werden (${colorUrls.length} URLs)`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);
          errorCount++;
          continue;
        }

        // Build colour-neutral base data from the first successful colour scrape.
        const first = colors[0].scraped;
        const baseTitle = stripColorFromTitle(first.title) || first.title;
        const base: ScrapedProduct = {
          ...first,
          title: baseTitle,
          // Aggregate every colour's images so we can attach them per-variant
          image_urls: [],
        };

        const aggregatedScrape = {
          base_title: baseTitle,
          colors: colors.map((c) => ({
            colorName: c.colorName,
            colorId: c.colorId,
            price_eur: c.scraped.price_eur,
            image_urls: c.scraped.image_urls,
          })),
          sizes: base.sizes,
          description: base.description,
          description_html: base.description_html,
          material: base.material,
          article_number: base.article_number,
          care_labels: base.care_labels,
          color_urls: colorUrls,
        };

        if (dryRun) {
          await supabase
            .from("product_import_log")
            .update({
              status: "scraped",
              scraped_data: aggregatedScrape,
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);
          createdCount++;
          continue;
        }

        // Real run — create the multi-colour product
        await supabase
          .from("product_import_log")
          .update({
            status: "creating",
            scraped_data: aggregatedScrape,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        const created = await createMultiColorProduct(
          base,
          colors,
          item.handle,
          adminToken,
        );
        if (!created) throw new Error("create returned null");

        if (created.duplicate) {
          await supabase
            .from("product_import_log")
            .update({
              status: "skipped",
              shopify_product_id: created.id,
              error_message: "Bereits in Shopify vorhanden",
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);
          continue;
        }

        // Fetch back the created product to get variant IDs grouped by colour.
        const variantsByColor = new Map<string, string[]>();
        try {
          const vRes = await shopifyFetch(
            `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_ADMIN_VERSION}/products/${created.id}.json?fields=variants`,
            { method: "GET", adminToken },
          );
          if (vRes.ok) {
            const vJson = await vRes.json();
            for (const v of vJson?.product?.variants ?? []) {
              const cn = String(v.option2 ?? "");
              if (!variantsByColor.has(cn)) variantsByColor.set(cn, []);
              variantsByColor.get(cn)!.push(String(v.id));
            }
          }
        } catch (e) {
          console.warn("[worker] could not fetch variants for image mapping", e);
        }

        // Upload all images per colour and link them to that colour's variants
        for (const c of colors) {
          const variantIds = variantsByColor.get(c.colorName) ?? [];
          for (const imgUrl of c.scraped.image_urls) {
            await uploadColorImage(created.id, imgUrl, variantIds, adminToken);
          }
        }

        // Heartbeat
        await supabase
          .from("product_import_job")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", "singleton");

        // Persist a colour→variantIds map for the look-detail UI
        const variants_summary = Object.fromEntries(
          Array.from(variantsByColor.entries()),
        );
        await supabase
          .from("product_import_log")
          .update({
            status: "created",
            shopify_product_id: created.id,
            scraped_data: { ...aggregatedScrape, variants_summary },
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        createdCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await supabase
          .from("product_import_log")
          .update({
            status: "error",
            error_message: msg.slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        errorCount++;
      }
    }

    // Update job counters
    await supabase
      .from("product_import_job")
      .update({
        processed: (job.processed ?? 0) + processed,
        created_count: (job.created_count ?? 0) + createdCount,
        error_count: (job.error_count ?? 0) + errorCount,
        message: `Batch fertig: ${createdCount} ok, ${errorCount} Fehler`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "singleton");

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        created: createdCount,
        errors: errorCount,
        state: "running",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[worker] fatal:", msg);
    await supabase
      .from("product_import_job")
      .update({
        message: `Worker-Fehler: ${msg.slice(0, 200)}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "singleton");
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
