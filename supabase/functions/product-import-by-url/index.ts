// Single-URL Import: nimmt eine Hersteller-URL (Casa Moda / Venti),
// findet alle Farb-Varianten desselben Artikels, scraped sie via Firecrawl
// und legt EIN Shopify-Produkt mit allen Farben + Grössen + Bildern an.
// Wenn der Handle schon existiert → updaten (Beschreibung, Bilder, Preis).
//
// Trigger: POST { url: string }. Returns { success, shopify_product_id, action: "created"|"updated", colors_found }.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_DOMAIN = "style-compass-6nrqi.myshopify.com";
const SHOPIFY_ADMIN_VERSION = "2025-07";
const EUR_TO_CHF = 0.95;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

interface ScrapedProduct {
  title: string;
  description: string;
  description_html: string;
  material: string;
  article_number: string;
  care_labels: string[];
  fit: string;            // Modern Fit / Body Fit / Comfort Fit / ""
  is_new: boolean;        // NEU-Badge
  features: string[];     // Bullet-Points (Hoher Baumwollanteil, Kent-Kragen, …)
  price_eur: number | null;
  compare_at_price_eur: number | null;
  on_sale: boolean;
  image_urls: string[];
  sizes: string[];
  product_type: string | null;
  vendor: string;
  tags: string[];
}

// ============================================================
// Helpers (mirrored from product-import-run, kept self-contained)
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

function detectBrand(url: string): "casa-moda" | "venti" | null {
  if (/casamoda\.com/i.test(url)) return "casa-moda";
  if (/venti\.com/i.test(url)) return "venti";
  return null;
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

const COLOR_SLUG_WORDS = new Set([
  "blau","hellblau","mittelblau","dunkelblau","marine","navy",
  "rot","mittelrot","dunkelrot","weinrot",
  "weiss","weiß","ecru","creme","champagner","champagner-beige",
  "schwarz","tiefschwarz","anthrazit","grau","hellgrau","dunkelgrau","silber",
  "beige","sand","khaki","camel","braun","mittelbraun","dunkelbraun","cognac",
  "gruen","grün","mittelgruen","dunkelgruen","oliv","olive","mint",
  "gelb","senf","ocker","orange","rost",
  "rosa","pink","altrosa","lila","violett","tuerkis","türkis","petrol",
  "graues","mittel","dunkel","hell",
]);

function parseProductUrl(url: string): { slugBase: string; articleId: string; colorId: string } | null {
  // Strip protocol+host, any locale prefix like /de/de/, /de/, /at/de/, etc., and trailing slash.
  let path = url
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/[a-z]{2}(?:\/[a-z]{2})?\//i, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .toLowerCase();

  // Use only the last path segment (in case there are extra prefixes).
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  const slug = segments[segments.length - 1];

  // Match `<slug>-<articleId>-<colorId>` with looser digit ranges.
  const m = slug.match(/^([a-z0-9-]+?)-(\d{3,8})-(\d{1,5})$/);
  if (!m) return null;

  let slugBase = m[1];
  for (let i = 0; i < 3; i++) {
    const parts = slugBase.split("-");
    if (parts.length > 1 && COLOR_SLUG_WORDS.has(parts[parts.length - 1])) {
      parts.pop();
      slugBase = parts.join("-");
    } else break;
  }
  return { slugBase, articleId: m[2], colorId: m[3] };
}

function buildBaseHandle(brand: string, slugBase: string, articleId: string): string {
  return `${brand}-${slugBase}-${articleId}`.toLowerCase();
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

// ============================================================
// Color discovery: find sibling colour URLs of the same article
// ============================================================

async function directFetch(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/json,*/*;q=0.8",
        "Accept-Language": "de-DE,de;q=0.9",
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Find all URLs on the page that share the same article ID — those are the sibling colour variants. */
async function discoverColorUrls(
  sourceUrl: string,
  articleId: string,
  brand: string,
): Promise<Array<{ url: string; colorId: string }>> {
  const html = await directFetch(sourceUrl);
  const found = new Map<string, { url: string; colorId: string }>();

  // Always include the source URL itself
  const srcParsed = parseProductIds(sourceUrl);
  if (srcParsed) {
    found.set(srcParsed.colorId, { url: sourceUrl.split(/[?#]/)[0], colorId: srcParsed.colorId });
  }

  if (html) {
    const host = brand === "casa-moda" ? "casamoda\\.com" : "venti\\.com";
    const re = new RegExp(
      `https://www\\.${host}/de/de/[a-z0-9-]+\\-${articleId}\\-(\\d+)`,
      "gi",
    );
    const matches = html.match(re) ?? [];
    for (const m of matches) {
      const clean = m.split(/[?#]/)[0].toLowerCase();
      const ids = parseProductIds(clean);
      if (ids && !found.has(ids.colorId)) {
        found.set(ids.colorId, { url: clean, colorId: ids.colorId });
      }
    }
  }

  return Array.from(found.values());
}

// ============================================================
// Firecrawl scraping
// ============================================================

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
        waitFor: 12000,
        actions: [
          { type: "wait", milliseconds: 4000 },
          { type: "scroll", direction: "down" },
          { type: "wait", milliseconds: 3000 },
        ],
      }),
    });
    if (!res.ok) {
      console.error(`[by-url] firecrawl ${res.status} for ${url}`);
      return null;
    }
    const data = await res.json();
    return (
      (typeof data?.html === "string" && data.html) ||
      (typeof data?.data?.html === "string" && data.data.html) ||
      null
    );
  } catch (err) {
    console.error(`[by-url] firecrawl error:`, err);
    return null;
  }
}

/** Build a clean colour-aware title from the URL slug as a robust fallback.
 *  /de/de/sommerjacke-beige-126410120-600 → "Sommerjacke Beige" */
function titleFromSlug(sourceUrl: string): string {
  const slug = sourceUrl
    .replace(/^https?:\/\/[^/]+\/de\/de\//i, "")
    .replace(/-\d+-\d+\/?$/, "");
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Detect fit from the URL slug or title (Modern Fit / Body Fit / Comfort Fit). */
function extractFit(sourceUrl: string, title: string): string {
  const haystack = (sourceUrl + " " + title).toLowerCase();
  if (/body[- ]?fit/.test(haystack)) return "Body Fit";
  if (/modern[- ]?fit/.test(haystack)) return "Modern Fit";
  if (/comfort[- ]?fit/.test(haystack)) return "Comfort Fit";
  if (/regular[- ]?fit/.test(haystack)) return "Regular Fit";
  if (/slim[- ]?fit/.test(haystack)) return "Slim Fit";
  return "";
}

function extractFromHtml(html: string, brand: string, sourceUrl: string): ScrapedProduct {
  const ids = parseProductIds(sourceUrl);
  const slugTitle = titleFromSlug(sourceUrl);

  // 1) Title — prefer H1, then OG, then <title>, fallback to URL slug
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

  // 2) Description / material / article number / care labels — try multiple patterns
  let description = "";
  let material = "";
  let articleNumber = "";
  const careLabels: string[] = [];
  const features: string[] = [];

  // Marketing copy: <div class="article-detail-text"><p>…</p>
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
  // Fallback: meta description (often empty on Casa Moda)
  if (!description) {
    const metaDesc = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    if (metaDesc) {
      const t = decode(metaDesc[1]).trim();
      if (t.length > 40) description = t;
    }
  }

  // Material — tries: <strong>Material</strong><br>X, "Material: X", or "X % Y" pattern
  const matMatch = html.match(/<strong[^>]*>\s*Material\s*<\/strong>\s*<br\s*\/?>\s*([^<]+)/i);
  if (matMatch) material = decode(matMatch[1]).replace(/\s+/g, " ").trim();
  if (!material) {
    const m2 = html.match(/Material[\s:]*<[^>]+>\s*([^<]{5,200})/i);
    if (m2) material = decode(m2[1]).replace(/\s+/g, " ").trim();
  }

  // Article number — explicit "Artikelnummer" label, or fallback to URL ID
  const artMatch = html.match(/<strong[^>]*>\s*Artikelnummer\s*<\/strong>\s*<br\s*\/?>\s*([^<]+)/i);
  if (artMatch) articleNumber = decode(artMatch[1]).replace(/\s+/g, " ").trim();
  if (!articleNumber) {
    const a2 = html.match(/Artikel(?:nr|nummer)[\s:.\-]*<[^>]*>\s*([0-9]{6,})/i);
    if (a2) articleNumber = a2[1].trim();
  }
  if (!articleNumber && ids) {
    // Final fallback: use the article ID from the URL itself (e.g. 126410120)
    articleNumber = ids.articleId;
  }

  // Care icons — alt text from <img class="care-icon" alt="…">
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

  // Bullet features — list items inside the product details column
  // Try several common containers: .article-features, .product-features, .features-list, .article-detail ul
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

  // 3) Badges (NEU / Sale)
  let isNew = false;
  if (/class="[^"]*\b(?:badge|label|tag)[^"]*"[^>]*>\s*NEU\s*</i.test(html)) isNew = true;
  if (/<span[^>]*>\s*NEU\s*<\/span>/i.test(html) && !/Newsletter/.test(html.slice(0, html.indexOf("NEU") + 50))) {
    isNew = true;
  }

  // 4) Fit detection
  const fit = extractFit(sourceUrl, title);

  // 5) Build rich body_html for Shopify
  const parts: string[] = [];
  if (description) parts.push(`<p>${description}</p>`);
  if (features.length > 0) {
    parts.push(`<ul>${features.map((f) => `<li>${f}</li>`).join("")}</ul>`);
  }
  if (material) parts.push(`<p><strong>Material:</strong> ${material}</p>`);
  if (fit) parts.push(`<p><strong>Passform:</strong> ${fit}</p>`);
  if (careLabels.length > 0) {
    parts.push(
      `<p><strong>Pflegehinweise:</strong></p><ul>${
        careLabels.map((c) => `<li>${c}</li>`).join("")
      }</ul>`,
    );
  }
  if (articleNumber) parts.push(`<p><small>Artikelnummer: ${articleNumber}</small></p>`);
  const descriptionHtml = parts.join("\n");

  // 6) Price
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

  // 7) Images
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

  // 8) Product type heuristic
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

  // 9) Tags — brand, type, fit, NEU
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

async function findShopifyProductByHandle(
  handle: string,
  adminToken: string,
): Promise<{ id: string; title: string; handle: string } | null> {
  try {
    const res = await shopifyFetch(
      `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_ADMIN_VERSION}/products.json?handle=${encodeURIComponent(handle)}&fields=id,handle,title&limit=1`,
      { method: "GET", adminToken },
    );
    if (!res.ok) {
      await res.text().catch(() => "");
      return null;
    }
    const json = await res.json();
    const p = json?.products?.[0];
    return p?.id ? { id: String(p.id), title: String(p.title ?? ""), handle: String(p.handle ?? "") } : null;
  } catch {
    return null;
  }
}

/** Search Shopify by article-number tag (art:123456789). Catches duplicates whose
 *  handle differs (e.g. slight slug variations) but the same article ID is tagged. */
async function findShopifyProductByArticleId(
  articleId: string,
  adminToken: string,
): Promise<{ id: string; title: string; handle: string } | null> {
  try {
    const tag = `art:${articleId}`;
    // Use REST search via tags filter — the products endpoint supports `?tag=`
    const res = await shopifyFetch(
      `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_ADMIN_VERSION}/products.json?tag=${encodeURIComponent(tag)}&fields=id,handle,title,tags&limit=5`,
      { method: "GET", adminToken },
    );
    if (!res.ok) {
      await res.text().catch(() => "");
      return null;
    }
    const json = await res.json();
    const products: Array<{ id: number; handle: string; title: string; tags: string }> = json?.products ?? [];
    // Defensive: confirm the tag is actually present (tag= filter should already do this)
    for (const p of products) {
      const tags = String(p.tags ?? "").split(",").map((t) => t.trim().toLowerCase());
      if (tags.includes(tag.toLowerCase())) {
        return { id: String(p.id), title: String(p.title ?? ""), handle: String(p.handle ?? "") };
      }
    }
    return null;
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
    console.warn("[by-url] delete images failed:", e);
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

interface ColorData {
  colorName: string;
  colorId: string;
  scraped: ScrapedProduct;
}

function buildProductPayload(
  base: ScrapedProduct,
  colors: ColorData[],
  handle: string,
) {
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

function resolveAdminToken(): string {
  const direct =
    Deno.env.get("SHOPIFY_ADMIN_API_TOKEN") ?? Deno.env.get("SHOPIFY_ACCESS_TOKEN");
  if (direct && direct.startsWith("shpat_")) return direct;
  for (const [k, v] of Object.entries(Deno.env.toObject())) {
    if (k.startsWith("SHOPIFY_ONLINE_ACCESS_TOKEN") && v?.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(v);
        const t = parsed.access_token ?? parsed.accessToken ?? parsed.token;
        if (typeof t === "string" && t.startsWith("shpat_")) return t;
      } catch { /* ignore */ }
    }
  }
  return direct ?? "";
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
    const rawUrl = String(body.url ?? "").trim();
    const force = Boolean(body.force);
    if (!rawUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "url required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sourceUrl = rawUrl.split(/[?#]/)[0];
    const brand = detectBrand(sourceUrl);
    if (!brand) {
      return new Response(
        JSON.stringify({ success: false, error: "Nur casamoda.com oder venti.com URLs werden unterstützt" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const parsed = parseProductUrl(sourceUrl);
    if (!parsed) {
      return new Response(
        JSON.stringify({ success: false, error: "URL-Format unbekannt — erwarte z.B. /de/de/businesshemd-3760-474" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const handle = buildBaseHandle(brand, parsed.slugBase, parsed.articleId);
    const adminToken = resolveAdminToken();
    if (!adminToken) {
      return new Response(
        JSON.stringify({ success: false, error: "SHOPIFY_ADMIN_API_TOKEN fehlt" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ============================================================
    // EARLY DUPLICATE CHECK — runs BEFORE Firecrawl to save credits.
    // Looks up by (1) handle, then (2) article-number tag `art:<id>`.
    // If found and `force` is not set → abort with `already_exists`.
    // ============================================================
    const existingByHandle = await findShopifyProductByHandle(handle, adminToken);
    const existingByArticle = existingByHandle
      ? null
      : await findShopifyProductByArticleId(parsed.articleId, adminToken);
    const existing = existingByHandle ?? existingByArticle;

    if (existing && !force) {
      const adminUrl = `https://${SHOPIFY_DOMAIN.replace(".myshopify.com","")}.myshopify.com/admin/products/${existing.id}`;
      console.log(`[by-url] duplicate found id=${existing.id} handle=${existing.handle} — aborting`);
      return new Response(
        JSON.stringify({
          success: false,
          already_exists: true,
          matched_by: existingByHandle ? "handle" : "article_number",
          shopify_product_id: existing.id,
          handle: existing.handle,
          title: existing.title,
          article_number: parsed.articleId,
          shopify_admin_url: adminUrl,
          error:
            `Produkt existiert bereits in Shopify (${existingByHandle ? "Handle-Match" : "Artikelnummer-Match"}): ` +
            `"${existing.title}". Mit "force: true" kann es überschrieben werden.`,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY") ?? "";
    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ success: false, error: "FIRECRAWL_API_KEY fehlt" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[by-url] start brand=${brand} handle=${handle} force=${force} existing=${existing?.id ?? "no"}`);

    // 1) Find sibling colour URLs
    const colorUrls = await discoverColorUrls(sourceUrl, parsed.articleId, brand);
    console.log(`[by-url] discovered ${colorUrls.length} colour URLs`);

    // 2) Scrape every colour
    const colors: ColorData[] = [];
    for (const cu of colorUrls) {
      const html = await firecrawlScrape(cu.url, firecrawlKey);
      if (!html) {
        console.warn(`[by-url] firecrawl failed for ${cu.url}`);
        continue;
      }
      const sc = extractFromHtml(html, brand, cu.url);
      if (!sc.title || sc.price_eur === null) {
        console.warn(`[by-url] incomplete data for ${cu.url}`);
        continue;
      }
      // Colour name: prefer title, fall back to URL slug, then to colorId.
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
      return new Response(
        JSON.stringify({ success: false, error: "Keine Farb-Variante konnte gescraped werden" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3) Build colour-neutral base
    const first = colors[0].scraped;
    const baseTitle = stripColorFromTitle(first.title) || first.title;
    const base: ScrapedProduct = { ...first, title: baseTitle, image_urls: [] };

    // 4) Upsert: re-use the existence result from the early check.
    //    With force=true we update the matched product (by handle or by article number).
    const existingId = existing?.id ?? null;
    const payload = buildProductPayload(base, colors, handle);

    let productId: string;
    let action: "created" | "updated";

    if (existingId) {
      console.log(`[by-url] updating existing product ${existingId} (force)`);
      // Strip handle from update payload (Shopify dislikes changing it on update if same)
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
        throw new Error(`Shopify update ${res.status}: ${errText.slice(0, 300)}`);
      }
      productId = existingId;
      action = "updated";

      // Replace images: delete old then re-upload
      await deleteAllImages(productId, adminToken);
    } else {
      console.log(`[by-url] creating new product`);
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
        throw new Error(`Shopify create ${res.status}: ${errText.slice(0, 300)}`);
      }
      const json = await res.json();
      productId = String(json.product.id);
      action = "created";
    }

    // 5) Map variants by colour and upload images
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
      console.warn("[by-url] variant fetch failed:", e);
    }

    let imagesUploaded = 0;
    for (const c of colors) {
      const variantIds = variantsByColor.get(c.colorName) ?? [];
      for (const imgUrl of c.scraped.image_urls) {
        const ok = await uploadColorImage(productId, imgUrl, variantIds, adminToken);
        if (ok) imagesUploaded++;
      }
    }

    // 6) Log to product_import_log so it appears in the activity feed
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
      variants_summary: Object.fromEntries(Array.from(variantsByColor.entries())),
      single_url_import: true,
    };
    await supabase.from("product_import_log").insert({
      brand,
      source_url: sourceUrl,
      handle,
      status: action === "created" ? "created" : "skipped",
      shopify_product_id: productId,
      scraped_data: aggregatedScrape,
      error_message: action === "updated" ? "Bestehendes Produkt aktualisiert" : null,
    });

    // Compute which fields couldn't be scraped (so the admin can fill them in Shopify).
    const missing: string[] = [];
    if (!base.description) missing.push("Beschreibung");
    if (!base.material) missing.push("Material");
    if (base.care_labels.length === 0) missing.push("Pflegehinweise");
    if (base.features.length === 0) missing.push("Bullet-Features");
    if (!base.fit) missing.push("Passform");

    return new Response(
      JSON.stringify({
        success: true,
        action,
        shopify_product_id: productId,
        handle,
        title: baseTitle,
        colors_found: colors.length,
        colors: colors.map((c) => c.colorName),
        sizes: base.sizes,
        images_uploaded: imagesUploaded,
        price_eur: base.price_eur,
        compare_at_price_eur: base.compare_at_price_eur,
        material: base.material,
        article_number: base.article_number,
        fit: base.fit,
        is_new: base.is_new,
        features_count: base.features.length,
        care_count: base.care_labels.length,
        description_length: base.description.length,
        missing_fields: missing,
        shopify_admin_url: `https://${SHOPIFY_DOMAIN.replace(".myshopify.com","")}.myshopify.com/admin/products/${productId}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[by-url] fatal:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
