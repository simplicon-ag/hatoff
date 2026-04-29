// Worker: processes a small batch of pending products.
// Each `pending` row in product_import_log carries `scraped_data.color_urls`
// (set by product-import-discover). For every group we:
//   1. Scrape all colour variants via Firecrawl (with JS-actions for accordion)
//   2. Build ONE Shopify product with Size + Colour options
//   3. Create OR update (when row.update_mode = true OR handle exists)
//
// Trigger: POST { batch_size?: number, only_if_running?: boolean }
//   - only_if_running=true → no-op when product_import_job.state !== 'running'.
//     Used by the pg_cron tick so it doesn't fire when nothing is queued.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_DOMAIN = "style-compass-6nrqi.myshopify.com";
const SHOPIFY_ADMIN_VERSION = "2025-07";
const EUR_TO_CHF = 0.95;

// ============================================================
// Types
// ============================================================

interface ScrapedProduct {
  title: string;
  description: string;
  description_html: string;
  material: string;
  article_number: string;
  care_labels: string[];
  fit: string;
  is_new: boolean;
  features: string[];
  price_eur: number | null;
  compare_at_price_eur: number | null;
  on_sale: boolean;
  image_urls: string[];
  sizes: string[];
  product_type: string | null;
  vendor: string;
  tags: string[];
}

interface ColorData {
  colorName: string;
  colorId: string;
  scraped: ScrapedProduct;
}

// ============================================================
// Helpers (mirrored from product-import-by-url)
// ============================================================

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function parseProductIds(url: string): { articleId: string; colorId: string } | null {
  const m = url.match(/-(\d+)-(\d+)\/?$/);
  if (!m) return null;
  return { articleId: m[1], colorId: m[2] };
}

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

function extractColorFromTitle(title: string): string | null {
  const m = title.match(COLOR_WORDS_RE);
  if (!m) return null;
  return m[0].trim().replace(/\s+/g, " ");
}

function cleanTitle(rawTitle: string): string {
  let t = decode(rawTitle).trim();
  t = t.replace(/\s*-\s*(CASAMODA|VENTI)\s*$/i, "");
  t = t.replace(/\s+\d{6,}\s*$/g, "");
  return t.trim();
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

function titleFromSlug(sourceUrl: string): string {
  const slug = sourceUrl
    .replace(/^https?:\/\/[^/]+\/de\/de\//i, "")
    .replace(/-\d+-\d+\/?$/, "");
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function extractFit(sourceUrl: string, title: string): string {
  const haystack = (sourceUrl + " " + title).toLowerCase();
  if (/body[- ]?fit/.test(haystack)) return "Body Fit";
  if (/modern[- ]?fit/.test(haystack)) return "Modern Fit";
  if (/comfort[- ]?fit/.test(haystack)) return "Comfort Fit";
  if (/regular[- ]?fit/.test(haystack)) return "Regular Fit";
  if (/slim[- ]?fit/.test(haystack)) return "Slim Fit";
  return "";
}

// ============================================================
// Firecrawl
// ============================================================

async function firecrawlScrape(url: string, apiKey: string): Promise<string | null> {
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
        waitFor: 1500,
        actions: [
          { type: "wait", milliseconds: 500 },
          { type: "scroll", direction: "down" },
          { type: "wait", milliseconds: 500 },
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

function extractFromHtml(html: string, brand: string, sourceUrl: string): ScrapedProduct {
  const ids = parseProductIds(sourceUrl);
  const slugTitle = titleFromSlug(sourceUrl);

  // Title
  let title = "";
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    const inner = h1Match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (inner.length > 1 && inner.length < 200) title = decode(inner);
  }
  if (!title) {
    const og = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
    if (og) title = cleanTitle(og[1]);
  }
  if (!title) {
    const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (t) {
      const cleaned = cleanTitle(t[1]);
      if (cleaned && !/loyalty|wallet|warenkorb|cart|404/i.test(cleaned)) title = cleaned;
    }
  }
  if (!title) title = slugTitle;

  // Description / material / article number / care labels / features
  let description = "";
  let material = "";
  let articleNumber = "";
  const careLabels: string[] = [];
  const features: string[] = [];

  const marketingMatch = html.match(
    /<(?:div|section)[^>]*class="[^"]*article-detail-text[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section)>/i,
  );
  if (marketingMatch) {
    const inner = marketingMatch[1];
    const pMatch = inner.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (pMatch) {
      const text = decode(pMatch[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
      if (text.length > 40) description = text;
    }
  }
  if (!description) {
    const metaDesc = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    if (metaDesc) {
      const t = decode(metaDesc[1]).trim();
      if (t.length > 40) description = t;
    }
  }

  const matMatch = html.match(/<strong[^>]*>\s*Material\s*<\/strong>\s*<br\s*\/?>\s*([^<]+)/i);
  if (matMatch) material = decode(matMatch[1]).replace(/\s+/g, " ").trim();
  if (!material) {
    const m2 = html.match(/Material[\s:]*<[^>]+>\s*([^<]{5,200})/i);
    if (m2) material = decode(m2[1]).replace(/\s+/g, " ").trim();
  }

  const artMatch = html.match(/<strong[^>]*>\s*Artikelnummer\s*<\/strong>\s*<br\s*\/?>\s*([^<]+)/i);
  if (artMatch) articleNumber = decode(artMatch[1]).replace(/\s+/g, " ").trim();
  if (!articleNumber) {
    const a2 = html.match(/Artikel(?:nr|nummer)[\s:.\-]*<[^>]*>\s*([0-9]{6,})/i);
    if (a2) articleNumber = a2[1].trim();
  }
  if (!articleNumber && ids) articleNumber = ids.articleId;

  const careRegex = /<img[^>]*class="[^"]*care-icon[^"]*"[^>]*alt="([^"]+)"/gi;
  let careMatch: RegExpExecArray | null;
  const seenCare = new Set<string>();
  while ((careMatch = careRegex.exec(html)) !== null) {
    const label = decode(careMatch[1]).replace(/^Icon:\s*/i, "").trim();
    if (label && !seenCare.has(label)) {
      seenCare.add(label);
      careLabels.push(label);
    }
  }

  const featureContainers = [
    /<(?:ul|div)[^>]*class="[^"]*article-features[^"]*"[^>]*>([\s\S]{0,2000}?)<\/(?:ul|div)>/i,
    /<(?:ul|div)[^>]*class="[^"]*product-features[^"]*"[^>]*>([\s\S]{0,2000}?)<\/(?:ul|div)>/i,
    /<(?:ul|div)[^>]*class="[^"]*features?[- ]list[^"]*"[^>]*>([\s\S]{0,2000}?)<\/(?:ul|div)>/i,
  ];
  for (const re of featureContainers) {
    const m = html.match(re);
    if (!m) continue;
    const liMatches = m[1].match(/<li[^>]*>([\s\S]*?)<\/li>/gi) ?? [];
    for (const li of liMatches) {
      const txt = decode(li.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
      if (txt && txt.length < 200) features.push(txt);
    }
    if (features.length > 0) break;
  }

  let isNew = false;
  if (/class="[^"]*\b(?:badge|label|tag)[^"]*"[^>]*>\s*NEU\s*</i.test(html)) isNew = true;
  if (/<span[^>]*>\s*NEU\s*<\/span>/i.test(html) && !/Newsletter/.test(html.slice(0, html.indexOf("NEU") + 50))) {
    isNew = true;
  }

  const fit = extractFit(sourceUrl, title);

  // body_html
  const parts: string[] = [];
  if (description) parts.push(`<p>${description}</p>`);
  if (features.length > 0) {
    parts.push(`<ul>${features.map((f) => `<li>${f}</li>`).join("")}</ul>`);
  }
  if (material) parts.push(`<p><strong>Material:</strong> ${material}</p>`);
  if (fit) parts.push(`<p><strong>Passform:</strong> ${fit}</p>`);
  if (careLabels.length > 0) {
    parts.push(
      `<p><strong>Pflegehinweise:</strong></p><ul>${careLabels.map((c) => `<li>${c}</li>`).join("")}</ul>`,
    );
  }
  if (articleNumber) parts.push(`<p><small>Artikelnummer: ${articleNumber}</small></p>`);
  const descriptionHtml = parts.join("\n");

  // Price
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
      price_eur = Math.min(...prices);
      const max = Math.max(...prices);
      if (max > price_eur + 0.5) compare_at_price_eur = max;
    }
  }
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

  // Images
  const imgUrls = new Set<string>();
  if (ids) {
    const { articleId, colorId } = ids;
    const imgRegex = new RegExp(
      `https://[a-z0-9.-]*imgix\\.net/product/${articleId}/${colorId}/[^"'\\s]+?-image-\\d+-[a-f0-9]+\\.(?:jpg|jpeg|png|webp)`,
      "gi",
    );
    const m = html.match(imgRegex) ?? [];
    const seen = new Map<string, string>();
    for (const u of m) {
      const cleanUrl = u.split("?")[0];
      const imgN = cleanUrl.match(/-image-(\d+)-/);
      const key = imgN ? imgN[1] : cleanUrl;
      if (!seen.has(key)) seen.set(key, cleanUrl);
    }
    const sortedImgs = Array.from(seen.entries()).sort((a, b) => Number(a[0]) - Number(b[0]));
    for (const [, url] of sortedImgs) imgUrls.add(url);
  }

  // Product type
  let product_type: string | null = null;
  const t = (title + " " + slugTitle).toLowerCase();
  if (/sakko|anzug/.test(t)) product_type = "Sakko";
  else if (/hemd/.test(t)) product_type = "Hemd";
  else if (/hose|chino|jeans|bermuda/.test(t)) product_type = "Hose";
  else if (/polo/.test(t)) product_type = "Polo";
  else if (/shirt|t-shirt/.test(t)) product_type = "Shirt";
  else if (/strick|pullover|sweater|sweat|cardigan/.test(t)) product_type = "Strick";
  else if (/jacke|mantel|parka|weste/.test(t)) product_type = "Jacke";
  else if (/krawatt|fliege|tuch|gürtel|guertel|schal|cap/.test(t)) product_type = "Accessoire";

  const sizes = product_type
    ? BRAND_DEFAULT_SIZES[product_type] ?? ["S", "M", "L", "XL", "XXL"]
    : ["S", "M", "L", "XL", "XXL"];

  const tags = [brand];
  if (product_type) tags.push(product_type.toLowerCase());
  if (fit) tags.push(fit.toLowerCase().replace(/\s+/g, "-"));
  if (isNew) tags.push("neu");
  if (on_sale) tags.push("sale");

  return {
    title,
    description,
    description_html: descriptionHtml,
    material,
    article_number: articleNumber,
    care_labels: careLabels,
    fit,
    is_new: isNew,
    features,
    price_eur,
    compare_at_price_eur,
    on_sale,
    image_urls: Array.from(imgUrls).slice(0, 6),
    sizes,
    product_type,
    vendor: brand === "casa-moda" ? "Casa Moda" : "Venti",
    tags,
  };
}

// ============================================================
// Shopify (rate-limited)
// ============================================================

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

async function findShopifyProductByHandle(handle: string, adminToken: string): Promise<string | null> {
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

async function deleteAllImages(productId: string, adminToken: string): Promise<void> {
  try {
    const res = await shopifyFetch(
      `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_ADMIN_VERSION}/products/${productId}/images.json`,
      { method: "GET", adminToken },
    );
    if (!res.ok) return;
    const json = await res.json();
    const images: Array<{ id: number }> = json?.images ?? [];
    for (const img of images) {
      await shopifyFetch(
        `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_ADMIN_VERSION}/products/${productId}/images/${img.id}.json`,
        { method: "DELETE", adminToken },
      );
    }
  } catch (e) {
    console.warn("[worker] delete images failed:", e);
  }
}

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
        body: JSON.stringify({ image: { src: imageUrl, variant_ids: variantIds } }),
        adminToken,
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

function buildProductPayload(base: ScrapedProduct, colors: ColorData[], handle: string) {
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

  const sizes = base.sizes.length > 0 ? base.sizes : ["One Size"];
  const colorNames = colors.map((c) => c.colorName);

  const variants = [];
  for (const c of colors) {
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

  return {
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
}

// ============================================================
// Token resolution
// ============================================================

function isValidShopifyToken(t: string | null | undefined): t is string {
  if (!t) return false;
  return /^shp(at|ua|ca|ss|pa)_/.test(t.trim());
}

function resolveAdminToken(): string {
  for (const [k, v] of Object.entries(Deno.env.toObject())) {
    if (!k.startsWith("SHOPIFY_ONLINE_ACCESS_TOKEN")) continue;
    const raw = v?.trim() ?? "";
    if (raw.startsWith("{")) {
      try {
        const parsed = JSON.parse(raw);
        const t = parsed.access_token ?? parsed.accessToken ?? parsed.token;
        if (isValidShopifyToken(t)) return t;
      } catch { /* ignore */ }
    } else if (isValidShopifyToken(raw)) {
      return raw;
    }
  }
  const legacy = Deno.env.get("SHOPIFY_ADMIN_API_TOKEN") ?? Deno.env.get("SHOPIFY_ACCESS_TOKEN");
  if (isValidShopifyToken(legacy)) return legacy!;
  return legacy ?? "";
}

function detectBrand(brandSlug: string): string {
  if (brandSlug === "casa-moda" || brandSlug === "casamoda") return "casa-moda";
  if (brandSlug === "venti") return "venti";
  return brandSlug;
}

// ============================================================
// Process a single grouped row
// ============================================================

interface LogRow {
  id: string;
  brand: string;
  source_url: string;
  handle: string | null;
  scraped_data: { color_urls?: Array<{ url: string; colorId: string }>; article_id?: string } | null;
  update_mode: boolean;
}

async function processRow(
  row: LogRow,
  adminToken: string,
  firecrawlKey: string,
  supabase: ReturnType<typeof createClient>,
): Promise<{ ok: boolean; action?: "created" | "updated"; error?: string; productId?: string; title?: string; colorsCount?: number }> {
  const brand = detectBrand(row.brand);
  const handle = row.handle ?? "";
  const colorUrls = row.scraped_data?.color_urls ?? [{ url: row.source_url, colorId: parseProductIds(row.source_url)?.colorId ?? "0" }];

  // 1) Mark as scraping
  await supabase.from("product_import_log").update({
    status: "scraping",
    updated_at: new Date().toISOString(),
  }).eq("id", row.id);

  // 2) Scrape a bounded number of colours per run. Some articles expose many
  // colour URLs; scraping every variant + uploading every image can exceed the
  // 150s function limit. The product still gets all colour options from the
  // discovered URLs, while full data/images come from the first few colours.
  const colors: ColorData[] = [];
  const urlsToScrape = colorUrls.slice(0, 3);
  for (const cu of urlsToScrape) {
    const html = await firecrawlScrape(cu.url, firecrawlKey);
    if (!html) {
      console.warn(`[worker] firecrawl failed for ${cu.url}`);
      continue;
    }
    const sc = extractFromHtml(html, brand, cu.url);
    if (!sc.title || sc.price_eur === null) {
      console.warn(`[worker] incomplete data for ${cu.url}`);
      continue;
    }
    let colorName = extractColorFromTitle(sc.title) || "";
    if (!colorName) {
      const slug = cu.url.replace(/^https?:\/\/[^/]+\/de\/de\//i, "").replace(/-\d+-\d+\/?$/, "");
      const slugColor = extractColorFromTitle(" " + slug.replace(/-/g, " "));
      if (slugColor) colorName = slugColor.replace(/\b\w/g, (c) => c.toUpperCase());
    }
    if (!colorName) colorName = `Farbe ${cu.colorId}`;
    colors.push({ colorName, colorId: cu.colorId, scraped: sc });
  }

  if (colors.length === 0) {
    return { ok: false, error: "Keine Farb-Variante konnte gescraped werden" };
  }

  // 3) Build base
  const first = colors[0].scraped;
  const baseTitle = stripColorFromTitle(first.title) || first.title;
  const base: ScrapedProduct = { ...first, title: baseTitle, image_urls: [] };

  // 4) Upsert
  const existingId = await findShopifyProductByHandle(handle, adminToken);
  const discoveredColorIds = new Set(colors.map((c) => c.colorId));
  const allColors = [...colors];
  for (const cu of colorUrls) {
    if (discoveredColorIds.has(cu.colorId)) continue;
    allColors.push({
      colorId: cu.colorId,
      colorName: `Farbe ${cu.colorId}`,
      scraped: { ...base, image_urls: [], article_number: base.article_number },
    });
  }
  const payload = buildProductPayload(base, allColors, handle);

  let productId: string;
  let action: "created" | "updated";

  if (existingId) {
    await supabase.from("product_import_log").update({
      status: "creating",
      updated_at: new Date().toISOString(),
    }).eq("id", row.id);

    const updateBody = {
      product: {
        id: Number(existingId),
        title: payload.product.title,
        body_html: payload.product.body_html,
        vendor: payload.product.vendor,
        product_type: payload.product.product_type,
        tags: payload.product.tags,
        options: payload.product.options,
        variants: payload.product.variants,
      },
    };
    const res = await shopifyFetch(
      `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_ADMIN_VERSION}/products/${existingId}.json`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateBody),
        adminToken,
      },
    );
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `Shopify update ${res.status}: ${errText.slice(0, 300)}` };
    }
    productId = existingId;
    action = "updated";
    await deleteAllImages(productId, adminToken);
  } else {
    await supabase.from("product_import_log").update({
      status: "creating",
      updated_at: new Date().toISOString(),
    }).eq("id", row.id);

    const res = await shopifyFetch(
      `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_ADMIN_VERSION}/products.json`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        adminToken,
      },
    );
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `Shopify create ${res.status}: ${errText.slice(0, 300)}` };
    }
    const json = await res.json();
    productId = String(json.product.id);
    action = "created";
  }

  // 5) Images per colour
  const variantsByColor = new Map<string, string[]>();
  try {
    const vRes = await shopifyFetch(
      `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_ADMIN_VERSION}/products/${productId}.json?fields=variants`,
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
    console.warn("[worker] variant fetch failed:", e);
  }

  for (const c of colors) {
    const variantIds = variantsByColor.get(c.colorName) ?? [];
    for (const imgUrl of c.scraped.image_urls) {
      await uploadColorImage(productId, imgUrl, variantIds, adminToken);
    }
  }

  // 6) Save aggregated scrape data
  const aggregatedImages = colors.flatMap((c) => c.scraped.image_urls).slice(0, 6);
  await supabase.from("product_import_log").update({
    status: action === "created" ? "created" : "skipped",
    shopify_product_id: productId,
    error_message: action === "updated" ? "Bestehendes Produkt aktualisiert" : null,
    scraped_data: {
      base_title: baseTitle,
      title: baseTitle,
      colors: allColors.map((c) => ({ colorName: c.colorName, colorId: c.colorId })),
      sizes: base.sizes,
      price_eur: base.price_eur,
      image_urls: aggregatedImages,
      material: base.material,
      article_number: base.article_number,
    },
    updated_at: new Date().toISOString(),
  }).eq("id", row.id);

  // 7) Pre-generate style inspirations in background (fire-and-forget).
  //    Uses the product handle + first scraped image. The style-inspirations
  //    function caches results, so when a visitor opens the product page
  //    the 3 outfit images are already ready.
  if (handle && aggregatedImages[0]) {
    triggerStyleInspirations(handle, aggregatedImages[0], supabase).catch((e) => {
      console.warn(`[worker] style-inspirations trigger failed for ${handle}:`, e);
    });
  }

  // 8) Trigger automatic look (set) generation in background.
  //    The look-generate function decides itself whether the product is a
  //    valid anchor (Hemd/Hose/Jacke/Pullover/Sakko) and whether new looks
  //    are needed (smart-dedupe). All produced looks are saved as drafts
  //    awaiting admin review.
  if (handle) {
    triggerLookGeneration(handle).catch((e) => {
      console.warn(`[worker] look-generate trigger failed for ${handle}:`, e);
    });
  }

  return { ok: true, action, productId, title: baseTitle, colorsCount: allColors.length };
}

async function triggerLookGeneration(productHandle: string): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  console.log(`[worker] triggering look-generate for ${productHandle}`);
  fetch(`${supabaseUrl}/functions/v1/look-generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    body: JSON.stringify({ productHandle }),
  })
    .then((r) => r.text().then((t) => console.log(`[worker] look-generate ${productHandle} → ${r.status}`, t.slice(0, 160))))
    .catch((e) => console.warn(`[worker] look-generate fetch error for ${productHandle}:`, e));
}

async function triggerStyleInspirations(
  productHandle: string,
  sourceImageUrl: string,
  supabase: ReturnType<typeof createClient>,
): Promise<void> {
  // Skip if already cached for all 3 slots
  const { data: cached } = await supabase
    .from("style_inspiration_cache")
    .select("slot")
    .eq("product_handle", productHandle);
  if ((cached?.length ?? 0) >= 3) {
    console.log(`[worker] style-inspirations already cached for ${productHandle}`);
    return;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  console.log(`[worker] pre-generating style-inspirations for ${productHandle}`);

  // Fire-and-forget POST. We don't await the response body — generation
  // takes 10–30s and we don't want to block the import worker.
  fetch(`${supabaseUrl}/functions/v1/style-inspirations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    body: JSON.stringify({ productHandle, sourceImageUrl }),
  })
    .then((r) => r.text().then((t) => console.log(`[worker] style-inspirations ${productHandle} → ${r.status}`, t.slice(0, 120))))
    .catch((e) => console.warn(`[worker] style-inspirations fetch error for ${productHandle}:`, e));
}

// ============================================================
// Main handler
// ============================================================

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
    // Keep batch tiny: each product scrapes 1-N colour variants via Firecrawl
    // (slow) + many rate-limited Shopify calls. Bigger batches → 504 IDLE_TIMEOUT.
    const batchSize = Math.max(1, Math.min(5, Number(body.batch_size ?? 1)));
    const onlyIfRunning = Boolean(body.only_if_running ?? false);

    // Cron-safety: skip when no job is running
    const { data: jobRow } = await supabase
      .from("product_import_job")
      .select("state, dry_run")
      .eq("id", "singleton")
      .maybeSingle();

    if (onlyIfRunning && jobRow?.state !== "running") {
      return new Response(JSON.stringify({ skipped: true, reason: "no_running_job", state: jobRow?.state }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If user pressed Stop, finalise and exit
    if (jobRow?.state === "stopping") {
      await supabase.from("product_import_job").update({
        state: "stopped",
        message: "Worker gestoppt",
        updated_at: new Date().toISOString(),
      }).eq("id", "singleton");
      return new Response(JSON.stringify({ stopped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminToken = resolveAdminToken();
    if (!adminToken) {
      return new Response(JSON.stringify({ error: "SHOPIFY_ADMIN_API_TOKEN fehlt" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY") ?? "";
    if (!firecrawlKey) {
      return new Response(JSON.stringify({ error: "FIRECRAWL_API_KEY fehlt" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch a small batch of pending rows
    const { data: rows, error: fetchErr } = await supabase
      .from("product_import_log")
      .select("id, brand, source_url, handle, scraped_data, update_mode")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (fetchErr) throw fetchErr;

    if (!rows || rows.length === 0) {
      // No more work — mark job done
      await supabase.from("product_import_job").update({
        state: "done",
        message: "Alle Produkte verarbeitet",
        updated_at: new Date().toISOString(),
      }).eq("id", "singleton");

      return new Response(JSON.stringify({ done: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let createdCount = 0;
    let errorCount = 0;
    const results: Array<{ handle: string | null; ok: boolean; action?: string; error?: string }> = [];

    for (const row of rows) {
      try {
        const r = await processRow(row as LogRow, adminToken, firecrawlKey, supabase);
        if (r.ok) {
          createdCount++;
          results.push({ handle: row.handle, ok: true, action: r.action });
          // Live "current item" message on the job
          await supabase.from("product_import_job").update({
            message: `${r.action === "created" ? "Neu" : "Aktualisiert"}: ${r.title} (${r.colorsCount} Farben)`,
            updated_at: new Date().toISOString(),
          }).eq("id", "singleton");
        } else {
          errorCount++;
          await supabase.from("product_import_log").update({
            status: "error",
            error_message: r.error ?? "Unbekannter Fehler",
            updated_at: new Date().toISOString(),
          }).eq("id", row.id);
          results.push({ handle: row.handle, ok: false, error: r.error });
        }
      } catch (e) {
        errorCount++;
        const msg = e instanceof Error ? e.message : String(e);
        await supabase.from("product_import_log").update({
          status: "error",
          error_message: msg,
          updated_at: new Date().toISOString(),
        }).eq("id", row.id);
        results.push({ handle: row.handle, ok: false, error: msg });
      }
    }

    // Update job counters
    const { count: pendingTotal } = await supabase
      .from("product_import_log")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    const { count: doneTotal } = await supabase
      .from("product_import_log")
      .select("id", { count: "exact", head: true })
      .in("status", ["created", "skipped"]);

    const { count: errTotal } = await supabase
      .from("product_import_log")
      .select("id", { count: "exact", head: true })
      .eq("status", "error");

    const total = (pendingTotal ?? 0) + (doneTotal ?? 0) + (errTotal ?? 0);

    await supabase.from("product_import_job").update({
      processed: doneTotal ?? 0,
      created_count: doneTotal ?? 0,
      error_count: errTotal ?? 0,
      total,
      updated_at: new Date().toISOString(),
      ...(pendingTotal === 0 ? { state: "done", message: "Alle Produkte verarbeitet" } : {}),
    }).eq("id", "singleton");

    return new Response(JSON.stringify({
      processed: rows.length,
      created: createdCount,
      errors: errorCount,
      pending: pendingTotal ?? 0,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[worker] fatal:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
