// Edge function: crawls brand collection / new arrivals pages via Firecrawl,
// extracts product page URLs, and matches them against `product_price_cache.source_url`
// to derive Shopify product handles for each season.
//
// Trigger via:
//   POST /season-sync   { "season": "fs-2026" }   -> syncs a single season
//   POST /season-sync   { "season": "hw-2026" }
//   POST /season-sync   { "season": "all" }       -> syncs both seasons
//
// Why this approach:
// - The Lovable Shopify shop has its own product handles (e.g. "casa-moda-hemd-...").
// - product_price_cache.source_url stores the real brand URL per Shopify handle
//   (set by the price-scraping function).
// - So: brand season URLs -> intersect with source_url -> Shopify handles.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Season = "fs-2026" | "hw-2026";

interface BrandSource {
  brand: string;
  // Brand identifier as stored in product_price_cache.brand
  brandKey: string;
  // The listing page that represents the season for this brand.
  url: string;
  // Optional: a regex matching valid product page paths on this brand's site.
  // Anything that matches is considered a product URL candidate.
  productUrlPattern: RegExp;
}

const SOURCES: Record<Season, BrandSource[]> = {
  "fs-2026": [
    {
      brand: "casamoda",
      brandKey: "casa-moda",
      url: "https://www.casamoda.com/de/de/neuheiten",
      // e.g. /de/de/t-shirt-blau-14900-154 or /de/de/businesshemd-weiss-11745-2
      productUrlPattern: /casamoda\.com\/de\/de\/[a-z0-9-]+-\d+-\d+/i,
    },
    {
      brand: "venti",
      brandKey: "venti",
      url: "https://www.venti.com/de/de/neuheiten",
      productUrlPattern: /venti\.com\/de\/de\/[a-z0-9-]+-\d+-\d+/i,
    },
  ],
  "hw-2026": [
    {
      brand: "casamoda",
      brandKey: "casa-moda",
      url: "https://www.casamoda.com/de/de/herren/jacken-mantel",
      productUrlPattern: /casamoda\.com\/de\/de\/[a-z0-9-]+-\d+-\d+/i,
    },
    {
      brand: "venti",
      brandKey: "venti",
      url: "https://www.venti.com/de/de/herren/jacken-mantel",
      productUrlPattern: /venti\.com\/de\/de\/[a-z0-9-]+-\d+-\d+/i,
    },
  ],
};

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v2";

async function firecrawlMap(url: string, apiKey: string): Promise<unknown[]> {
  const res = await fetch(`${FIRECRAWL_BASE}/map`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, limit: 1500, includeSubdomains: false }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Firecrawl map failed [${res.status}]: ${body}`);
  }
  const data = await res.json();
  const links: string[] =
    (Array.isArray(data?.links) && data.links) ||
    (Array.isArray(data?.data?.links) && data.data.links) ||
    [];
  return links;
}

async function firecrawlScrapeLinks(
  url: string,
  apiKey: string,
): Promise<unknown[]> {
  const res = await fetch(`${FIRECRAWL_BASE}/scrape`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["links", "html"],
      onlyMainContent: false,
      waitFor: 5000,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Firecrawl scrape failed [${res.status}]: ${body}`);
  }
  const data = await res.json();
  const links: string[] =
    (Array.isArray(data?.links) && data.links) ||
    (Array.isArray(data?.data?.links) && data.data.links) ||
    [];
  // Also pull links out of the raw HTML (Firecrawl's "links" format sometimes
  // misses non-anchor matches like image color swatches).
  const html: string =
    (typeof data?.html === "string" && data.html) ||
    (typeof data?.data?.html === "string" && data.data.html) ||
    "";
  if (html) {
    const found = html.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];
    return Array.from(new Set([...links, ...found]));
  }
  return links;
}

function extractProductUrls(
  links: unknown[],
  pattern: RegExp,
): string[] {
  const set = new Set<string>();
  for (const link of links) {
    let raw = "";
    if (typeof link === "string") {
      raw = link;
    } else if (link && typeof link === "object") {
      const obj = link as Record<string, unknown>;
      raw =
        (typeof obj.url === "string" && obj.url) ||
        (typeof obj.href === "string" && obj.href) ||
        "";
    }
    if (!raw) continue;
    const m = raw.match(pattern);
    if (m) {
      const clean = m[0].split(/[?#]/)[0].toLowerCase();
      set.add(clean);
    }
  }
  return Array.from(set);
}

// deno-lint-ignore no-explicit-any
type SupabaseLike = any;

async function syncSeason(
  season: Season,
  firecrawlKey: string,
  supabase: SupabaseLike,
): Promise<
  {
    season: Season;
    brand: string;
    urls_found: number;
    handles_matched: number;
    error?: string;
  }[]
> {
  const results: {
    season: Season;
    brand: string;
    urls_found: number;
    handles_matched: number;
    error?: string;
  }[] = [];

  for (const source of SOURCES[season]) {
    try {
      // 1) Get brand-side product URLs from the season page (always scrape — /map
      //    only returns sitemap-listed URLs, which omits dynamic listing pages).
      const links = await firecrawlScrapeLinks(source.url, firecrawlKey);
      const productUrls = extractProductUrls(links, source.productUrlPattern);

      console.log(
        `[season-sync] ${season}/${source.brand}: scrape returned ${links.length} links, ${productUrls.length} matched product pattern`,
      );
      if (productUrls.length > 0) {
        console.log(
          `[season-sync] sample urls: ${productUrls.slice(0, 3).join(", ")}`,
        );
      }

      let matchedHandles: string[] = [];

      if (productUrls.length > 0) {
        // 2) Fetch all known (handle, source_url) pairs for this brand from the cache
        const { data: cacheRows, error: cacheErr } = await supabase
          .from("product_price_cache")
          .select("handle, source_url")
          .eq("brand", source.brandKey);

        if (cacheErr) throw cacheErr;

        const productUrlSet = new Set(productUrls);
        const seen = new Set<string>();
        for (const row of cacheRows ?? []) {
          if (!row.source_url) continue;
          const cleaned = String(row.source_url)
            .split(/[?#]/)[0]
            .toLowerCase();
          if (productUrlSet.has(cleaned)) {
            const handle = String(row.handle).toLowerCase();
            if (!seen.has(handle)) {
              seen.add(handle);
              matchedHandles.push(handle);
            }
          }
        }

        // 3) Replace previous mapping for this brand+season
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
            source_url: source.url,
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
        urls_found: productUrls.length,
        handles_matched: matchedHandles.length,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[season-sync] ${season}/${source.brand} failed:`, msg);
      results.push({
        season,
        brand: source.brandKey,
        urls_found: 0,
        handles_matched: 0,
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
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ error: "FIRECRAWL_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRole);

    let payload: { season?: string } = {};
    try {
      payload = await req.json();
    } catch {
      // GET or empty body -> default to "all"
    }

    const target = (payload.season ?? "all").toLowerCase();
    const seasons: Season[] =
      target === "fs-2026"
        ? ["fs-2026"]
        : target === "hw-2026"
          ? ["hw-2026"]
          : ["fs-2026", "hw-2026"];

    const allResults: Awaited<ReturnType<typeof syncSeason>> = [];
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
