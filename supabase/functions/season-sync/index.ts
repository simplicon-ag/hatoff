// Edge function: aggregates brand season product URLs from many category pages,
// matches them against `product_price_cache.source_url`, and stores Shopify
// handles per (brand, season) in `brand_season_products`.
//
// Trigger via:
//   POST /season-sync   { "season": "fs-2026" | "hw-2026" | "all" }
//
// Strategy per brand:
// - Casa Moda exposes a JSON product-list endpoint per category:
//     /de/de/article_collection/<category>.json?page=1&size=500
//   We fetch directly (no Firecrawl needed) and extract product URLs from the
//   embedded HTML in `product_list`.
// - Venti renders product cards server-side on category pages — we fetch the
//   HTML directly and grep product URLs out.
// - Both fall back to Firecrawl if the direct fetch fails (anti-bot / 403).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Season = "fs-2026" | "hw-2026";

/**
 * Hard-Exclude-Tokens pro Saison: Wenn der Shopify-Handle eines dieser Tokens
 * enthält, wird das Produkt NICHT in die Saison aufgenommen — auch dann nicht,
 * wenn die Marke es auf einer Saison-Kategorie-Seite gelistet hat (z.B. Casa
 * Moda zeigt Bermudas auf der "Hosen"-Seite, die wir für H/W scrapen).
 */
const SEASON_HANDLE_EXCLUDES: Record<Season, RegExp[]> = {
  "fs-2026": [
    /(^|-)(mantel|wintermantel|daunen|puffer|parka|fleece|wollmantel)(-|$)/,
    /(^|-)(strick|knit|cashmere)(-|$)/,
  ],
  "hw-2026": [
    /(^|-)(bermuda|bermudas|shorts?|short)(-|$)/,
    /(^|-)(badehose|swim|swimshorts)(-|$)/,
    /(^|-)(tank|tanktop|tank-top)(-|$)/,
    /(^|-)(espadrille|sandale|sandalen)(-|$)/,
    /(^|-)(leinen|linen)(-|$)/,
  ],
};

function isExcludedForSeason(handle: string, season: Season): boolean {
  const h = handle.toLowerCase();
  return SEASON_HANDLE_EXCLUDES[season].some((re) => re.test(h));
}

interface BrandCategory {
  // Identifier for logging
  label: string;
  // Full URL to fetch
  url: string;
  // 'casamoda-json' = parse JSON.product_list ; 'html' = scan raw HTML
  fetchMode: "casamoda-json" | "html";
  // Pattern to extract product URLs (must capture full URL in match)
  productUrlPattern: RegExp;
}

interface BrandSeasonSource {
  brand: string; // for logging
  brandKey: string; // matches product_price_cache.brand
  categories: BrandCategory[];
}

const CASAMODA_PRODUCT_RE = /https:\/\/www\.casamoda\.com\/de\/de\/[a-z0-9-]+-\d+-\d+/gi;
const VENTI_PRODUCT_RE = /https:\/\/www\.venti\.com\/de\/de\/[a-z0-9-]+-\d+-\d+/gi;

const cm = (slug: string): BrandCategory => ({
  label: `cm/${slug}`,
  url: `https://www.casamoda.com/de/de/article_collection/${slug}.json?page=1&size=500`,
  fetchMode: "casamoda-json",
  productUrlPattern: CASAMODA_PRODUCT_RE,
});

const vt = (slug: string): BrandCategory => ({
  label: `vt/${slug}`,
  url: `https://www.venti.com/de/de/${slug}`,
  fetchMode: "html",
  productUrlPattern: VENTI_PRODUCT_RE,
});

const SOURCES: Record<Season, BrandSeasonSource[]> = {
  "fs-2026": [
    {
      brand: "casamoda",
      brandKey: "casa-moda",
      categories: [
        cm("neuheiten"),
        cm("neue-styles"),
        cm("neue-bestseller"),
        cm("highlights-der-saison"),
        cm("hemden"),
        cm("shirts"),
        cm("shirts-neu"),
        cm("freizeithemden-neu"),
        cm("polos-shirts"),
        cm("hosen"),
        cm("chino"),
        cm("jeans"),
        cm("hosen-shorts-bermudas"),
        cm("strick-sweat"),
        cm("strick-sweat-neu"),
        cm("accessoires"),
        cm("accessoires-neu"),
        cm("outdoor"),
        cm("outdoor-neu"),
        cm("sale"),
      ],
    },
    {
      brand: "venti",
      brandKey: "venti",
      categories: [
        vt("neue-styles"),
        vt("monatshemd"),
        vt("modern-fit-hemden-neu"),
        vt("body-fit-hemden-neu"),
        vt("comfort-fit-hemden-neu"),
        vt("hemden-modern-fit"),
        vt("hemde-body-fit"),
        vt("hemden-comfort-fit"),
        vt("hemden-jerseyflex"),
        vt("hemden-buegelfrei"),
        vt("hemden-extra-lang"),
        vt("hemden-gala-hemden"),
        vt("hemdjacke"),
        vt("neu-hemdjacke"),
        vt("polos-shirts"),
        vt("basics"),
        vt("accessoires"),
        vt("accessoires-neu"),
        vt("accessoires-krawatten"),
        vt("accessoires-fliegen"),
        vt("accessoires-einstecktuecher"),
        vt("sale"),
      ],
    },
  ],
  "hw-2026": [
    {
      brand: "casamoda",
      brandKey: "casa-moda",
      categories: [
        cm("hemden"),
        cm("shirts"),
        cm("polos-shirts"),
        cm("jacken-westen"),
        cm("hosen"),
        cm("chino"),
        cm("jeans"),
        cm("strick-sweat"),
        cm("accessoires"),
        cm("outdoor"),
      ],
    },
    {
      brand: "venti",
      brandKey: "venti",
      categories: [
        vt("hemden-modern-fit"),
        vt("hemde-body-fit"),
        vt("hemden-comfort-fit"),
        vt("hemden-extra-lang"),
        vt("hemden-buegelfrei"),
        vt("hemden-gala-hemden"),
        vt("sakkos-westen"),
        vt("sakkos-westen-neu"),
        vt("sakkos"),
        vt("category-sakkos"),
        vt("anzuege"),
        vt("anzughosen"),
        vt("anzugwesten"),
        vt("strick"),
        vt("basics"),
        vt("accessoires"),
        vt("accessoires-krawatten"),
        vt("accessoires-fliegen"),
        vt("accessoires-einstecktuecher"),
      ],
    },
  ],
};

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v2";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

/** Fetch raw HTML / JSON directly. Returns null on failure. */
async function directFetch(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept:
          "text/html,application/xhtml+xml,application/json,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Firecrawl scrape fallback. Returns merged HTML+links text (best-effort). */
async function firecrawlFallback(
  url: string,
  apiKey: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${FIRECRAWL_BASE}/scrape`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["html", "links"],
        onlyMainContent: false,
        waitFor: 4000,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const html: string =
      (typeof data?.html === "string" && data.html) ||
      (typeof data?.data?.html === "string" && data.data.html) ||
      "";
    const links: unknown[] =
      (Array.isArray(data?.links) && data.links) ||
      (Array.isArray(data?.data?.links) && data.data.links) ||
      [];
    const linkStrs = links
      .map((l) =>
        typeof l === "string"
          ? l
          : ((l as Record<string, unknown>)?.url as string) ?? "",
      )
      .join(" ");
    return `${html} ${linkStrs}`;
  } catch {
    return null;
  }
}

function extractUrlsFromText(text: string, pattern: RegExp): string[] {
  const matches = text.match(pattern) ?? [];
  const set = new Set<string>();
  for (const m of matches) {
    set.add(m.split(/[?#]/)[0].toLowerCase());
  }
  return Array.from(set);
}

/** Read product URLs from a single brand category. */
async function fetchCategoryUrls(
  cat: BrandCategory,
  firecrawlKey: string,
): Promise<string[]> {
  // 1) Direct fetch
  let body = await directFetch(cat.url);
  let textForRegex = "";

  if (body && cat.fetchMode === "casamoda-json") {
    try {
      const json = JSON.parse(body);
      textForRegex = String(json?.product_list ?? "");
    } catch {
      textForRegex = body;
    }
  } else if (body) {
    textForRegex = body;
  }

  let urls = textForRegex
    ? extractUrlsFromText(textForRegex, cat.productUrlPattern)
    : [];

  // 2) Fallback to Firecrawl if we got nothing
  if (urls.length === 0) {
    const fc = await firecrawlFallback(cat.url, firecrawlKey);
    if (fc) urls = extractUrlsFromText(fc, cat.productUrlPattern);
  }

  return urls;
}

// deno-lint-ignore no-explicit-any
type SupabaseLike = any;

interface SyncResult {
  season: Season;
  brand: string;
  urls_found: number;
  handles_matched: number;
  per_category: Record<string, number>;
  error?: string;
}

async function syncSeason(
  season: Season,
  firecrawlKey: string,
  supabase: SupabaseLike,
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  for (const source of SOURCES[season]) {
    try {
      // 1) Collect product URLs from all category pages
      const allUrls = new Set<string>();
      const perCategory: Record<string, number> = {};

      // Fetch categories sequentially to be polite (and avoid rate limits)
      for (const cat of source.categories) {
        const urls = await fetchCategoryUrls(cat, firecrawlKey);
        perCategory[cat.label] = urls.length;
        for (const u of urls) allUrls.add(u);
      }

      console.log(
        `[season-sync] ${season}/${source.brand}: ${allUrls.size} unique product URLs across ${source.categories.length} categories`,
        perCategory,
      );

      let matchedHandles: string[] = [];

      if (allUrls.size > 0) {
        // 2) Load brand cache (handle, source_url) and match
        const { data: cacheRows, error: cacheErr } = await supabase
          .from("product_price_cache")
          .select("handle, source_url")
          .eq("brand", source.brandKey);
        if (cacheErr) throw cacheErr;

        const normalize = (u: string) =>
          u
            .replace(/^https?:\/\//i, "")
            .replace(/^www\./i, "")
            .split(/[?#]/)[0]
            .toLowerCase();

        const productUrlSet = new Set([...allUrls].map(normalize));
        const seen = new Set<string>();
        for (const row of cacheRows ?? []) {
          if (!row.source_url) continue;
          const cleaned = normalize(String(row.source_url));
          if (productUrlSet.has(cleaned)) {
            const handle = String(row.handle).toLowerCase();
            if (seen.has(handle)) continue;
            // Saison-spezifische Hard-Excludes (z.B. Bermudas raus aus H/W,
            // auch wenn die Marke sie auf der Hosen-Seite listet)
            if (isExcludedForSeason(handle, season)) continue;
            seen.add(handle);
            matchedHandles.push(handle);
          }
        }
        console.log(
          `[season-sync] ${season}/${source.brand}: matched ${matchedHandles.length} handles from ${cacheRows?.length ?? 0} cache rows`,
        );

        // 3) Replace mapping for this brand+season
        await supabase
          .from("brand_season_products")
          .delete()
          .eq("brand", source.brandKey)
          .eq("season", season);

        if (matchedHandles.length > 0) {
          const rows = matchedHandles.map((handle) => ({
            brand: source.brandKey,
            season,
            handle,
            source_url: source.categories[0].url,
          }));
          const { error: insertError } = await supabase
            .from("brand_season_products")
            .insert(rows);
          if (insertError) throw insertError;
        }
      }

      results.push({
        season,
        brand: source.brandKey,
        urls_found: allUrls.size,
        handles_matched: matchedHandles.length,
        per_category: perCategory,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[season-sync] ${season}/${source.brand} failed:`, msg);
      results.push({
        season,
        brand: source.brandKey,
        urls_found: 0,
        handles_matched: 0,
        per_category: {},
        error: msg,
      });
    }
  }

  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRole);

    let payload: { season?: string } = {};
    try {
      payload = await req.json();
    } catch {
      // empty body
    }

    const target = (payload.season ?? "all").toLowerCase();
    const seasons: Season[] =
      target === "fs-2026"
        ? ["fs-2026"]
        : target === "hw-2026"
          ? ["hw-2026"]
          : ["fs-2026", "hw-2026"];

    const allResults: SyncResult[] = [];
    for (const s of seasons) {
      const r = await syncSeason(s, firecrawlKey, supabase);
      allResults.push(...r);
    }

    return new Response(
      JSON.stringify({ success: true, results: allResults }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[season-sync] fatal:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
