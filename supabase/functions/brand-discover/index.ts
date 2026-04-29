// Brand Discovery: Crawls a brand listing page (Casa Moda / Venti),
// finds ALL article URLs and ALL color variants per article,
// and queues each color URL as a separate sync_pending entry
// in product_import_log so the per-color importer can process them.
//
// Trigger: POST { brand: "casa-moda" | "venti", listing_url?: string, max_articles?: number }
// Default listing URLs:
//   casa-moda: https://www.casamoda.com/de/de/bekleidung
//   venti:     https://www.venti.com/de/de/hemden-modern-fit

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

const DEFAULT_LISTINGS: Record<string, string[]> = {
  "casa-moda": ["https://www.casamoda.com/de/de/bekleidung?sort=sort_preset_new"],
  "venti": [
    "https://www.venti.com/de/de/hemden-modern-fit?sort=sort_preset_new",
    "https://www.venti.com/de/de/hemden-slim-fit?sort=sort_preset_new",
    "https://www.venti.com/de/de/anzuege?sort=sort_preset_new",
  ],
};

function detectBrand(url: string): "casa-moda" | "venti" | null {
  if (/casamoda\.com/i.test(url)) return "casa-moda";
  if (/venti\.com/i.test(url)) return "venti";
  return null;
}

async function directFetch(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html",
        "Accept-Language": "de-DE,de;q=0.9",
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

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
        waitFor: 8000,
        actions: [
          { type: "wait", milliseconds: 3000 },
          { type: "scroll", direction: "down" },
          { type: "wait", milliseconds: 3000 },
          { type: "scroll", direction: "down" },
          { type: "wait", milliseconds: 3000 },
        ],
      }),
    });
    if (!res.ok) {
      console.error(`[discover] firecrawl ${res.status} for ${url}`);
      return null;
    }
    const data = await res.json();
    return (
      (typeof data?.html === "string" && data.html) ||
      (typeof data?.data?.html === "string" && data.data.html) ||
      null
    );
  } catch (err) {
    console.error(`[discover] firecrawl error:`, err);
    return null;
  }
}

/** Extract product detail URLs from a listing page. */
function extractProductUrlsFromListing(html: string, brand: string): string[] {
  const host = brand === "casa-moda" ? "casamoda\\.com" : "venti\\.com";
  // Product URLs look like .../de/de/<slug>-<articleId>-<colorId>
  const re = new RegExp(
    `https?://www\\.${host}/de/de/[a-z0-9-]+-\\d{3,8}-\\d{1,5}(?=["'?#\\s])`,
    "gi",
  );
  const matches = html.match(re) ?? [];
  // Also match relative paths
  const reRel = /href=["']/de/de/[a-z0-9-]+-\d{3,8}-\d{1,5}["']/gi;
  const relMatches = html.match(reRel) ?? [];
  const baseHost = brand === "casa-moda" ? "https://www.casamoda.com" : "https://www.venti.com";
  const out = new Set<string>();
  for (const m of matches) out.add(m.split(/[?#]/)[0].toLowerCase());
  for (const m of relMatches) {
    const path = m.match(/\/de\/de\/[a-z0-9-]+-\d{3,8}-\d{1,5}/i);
    if (path) out.add((baseHost + path[0]).toLowerCase());
  }
  return Array.from(out);
}

/** From a product detail page, extract ALL sibling color URLs (sharing the same articleId). */
function extractColorUrlsFromDetail(html: string, brand: string, articleId: string): Array<{ url: string; colorId: string }> {
  const host = brand === "casa-moda" ? "casamoda\\.com" : "venti\\.com";
  const re = new RegExp(
    `https?://www\\.${host}/de/de/[a-z0-9-]+-${articleId}-(\\d{1,5})`,
    "gi",
  );
  const matches = html.match(re) ?? [];
  const reRel = new RegExp(
    `href=["']/de/de/[a-z0-9-]+-${articleId}-(\\d{1,5})["']`,
    "gi",
  );
  const relMatches = html.match(reRel) ?? [];
  const baseHost = brand === "casa-moda" ? "https://www.casamoda.com" : "https://www.venti.com";
  const map = new Map<string, string>();
  for (const m of matches) {
    const clean = m.split(/[?#]/)[0].toLowerCase();
    const colorId = clean.match(/-(\d+)$/)?.[1];
    if (colorId && !map.has(colorId)) map.set(colorId, clean);
  }
  for (const m of relMatches) {
    const path = m.match(new RegExp(`/de/de/[a-z0-9-]+-${articleId}-(\\d{1,5})`, "i"));
    if (path) {
      const colorId = path[0].match(/-(\d+)$/)?.[1];
      const full = (baseHost + path[0]).toLowerCase();
      if (colorId && !map.has(colorId)) map.set(colorId, full);
    }
  }
  return Array.from(map.entries()).map(([colorId, url]) => ({ url, colorId }));
}

function parseProductIds(url: string): { articleId: string; colorId: string } | null {
  const m = url.match(/-(\d+)-(\d+)\/?$/);
  if (!m) return null;
  return { articleId: m[1], colorId: m[2] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

  let body: { brand?: string; listing_url?: string; max_articles?: number; max_pages?: number };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const brand = body.brand;
  if (brand !== "casa-moda" && brand !== "venti") {
    return new Response(JSON.stringify({ error: "brand must be 'casa-moda' or 'venti'" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const maxArticles = Math.min(Math.max(body.max_articles ?? 100, 1), 1000);
  const maxPages = Math.min(Math.max(body.max_pages ?? 5, 1), 20);
  const listings = body.listing_url ? [body.listing_url] : DEFAULT_LISTINGS[brand];

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Step 1: collect all product URLs from listing pages (paginate)
  const productUrls = new Set<string>();
  for (const baseListing of listings) {
    for (let page = 1; page <= maxPages; page++) {
      const sep = baseListing.includes("?") ? "&" : "?";
      const url = page === 1 ? baseListing : `${baseListing}${sep}p=${page}`;
      let html = await directFetch(url);
      if (!html && FIRECRAWL_API_KEY) html = await firecrawlScrape(url, FIRECRAWL_API_KEY);
      if (!html) break;
      const found = extractProductUrlsFromListing(html, brand);
      const sizeBefore = productUrls.size;
      for (const u of found) productUrls.add(u);
      if (productUrls.size === sizeBefore) break; // no new products → end of pagination
      if (productUrls.size >= maxArticles) break;
    }
    if (productUrls.size >= maxArticles) break;
  }

  // Step 2: group by articleId (collapse sibling color URLs), keep one representative per article
  const articleToRep = new Map<string, string>();
  for (const url of productUrls) {
    const ids = parseProductIds(url);
    if (!ids) continue;
    if (!articleToRep.has(ids.articleId)) articleToRep.set(ids.articleId, url);
  }

  // Step 3: for each article, fetch detail page and extract ALL color URLs
  const allColorUrls = new Map<string, { url: string; articleId: string; colorId: string }>();
  let articlesProcessed = 0;
  for (const [articleId, repUrl] of articleToRep) {
    if (articlesProcessed >= maxArticles) break;
    articlesProcessed++;
    let html = await directFetch(repUrl);
    if (!html && FIRECRAWL_API_KEY) html = await firecrawlScrape(repUrl, FIRECRAWL_API_KEY);
    if (!html) {
      // At least keep the representative
      allColorUrls.set(repUrl, { url: repUrl, articleId, colorId: parseProductIds(repUrl)?.colorId ?? "0" });
      continue;
    }
    const colors = extractColorUrlsFromDetail(html, brand, articleId);
    if (colors.length === 0) {
      allColorUrls.set(repUrl, { url: repUrl, articleId, colorId: parseProductIds(repUrl)?.colorId ?? "0" });
    } else {
      for (const c of colors) {
        allColorUrls.set(c.url, { url: c.url, articleId, colorId: c.colorId });
      }
    }
  }

  // Step 4: insert each color URL as sync_pending into product_import_log (skip duplicates)
  let queuedNew = 0;
  let skippedExisting = 0;
  for (const { url } of allColorUrls.values()) {
    const { data: existing } = await supabase
      .from("product_import_log")
      .select("id")
      .eq("source_url", url)
      .limit(1);
    if (existing && existing.length > 0) {
      skippedExisting++;
      continue;
    }
    await supabase.from("product_import_log").insert({
      brand,
      source_url: url,
      status: "sync_pending",
      dry_run: false,
      update_mode: false,
    });
    queuedNew++;
  }

  return new Response(
    JSON.stringify({
      success: true,
      brand,
      listings_scanned: listings.length,
      articles_found: articleToRep.size,
      articles_processed: articlesProcessed,
      total_color_urls: allColorUrls.size,
      queued_new: queuedNew,
      skipped_existing: skippedExisting,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
