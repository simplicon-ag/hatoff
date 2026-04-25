// Edge function: crawls brand collection/new arrivals pages via Firecrawl,
// extracts product handles, and upserts them into brand_season_products.
//
// Trigger via:
//   POST /season-sync   { "season": "fs-2026" }   -> syncs a single season
//   POST /season-sync   { "season": "all" }       -> syncs both seasons
//
// Notes:
// - We use Firecrawl's /map endpoint (fast URL discovery) on each brand's
//   season-specific listing page, then derive product handles from the URLs.
// - We also fall back to /scrape with `links` format if /map returns nothing useful.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Season = "fs-2026" | "hw-2026";

interface BrandSource {
  brand: string;
  // The listing page that represents the season for this brand.
  // We use "Neuheiten" (new arrivals) for the current S/S 2026 season,
  // and a generic collection / coats page for H/W 2026 as a preview proxy.
  url: string;
  // Regex applied to discovered URLs to extract the product handle.
  // The first capture group must be the handle.
  handlePattern: RegExp;
}

const SOURCES: Record<Season, BrandSource[]> = {
  "fs-2026": [
    {
      brand: "casamoda",
      url: "https://www.casamoda.com/de-ch/neuheiten/",
      handlePattern: /casamoda\.com\/[^"'\s]*\/p\/([a-z0-9-]+)/i,
    },
    {
      brand: "venti",
      url: "https://www.venti.com/de-ch/neuheiten/",
      handlePattern: /venti\.com\/[^"'\s]*\/p\/([a-z0-9-]+)/i,
    },
  ],
  "hw-2026": [
    {
      brand: "casamoda",
      url: "https://www.casamoda.com/de-ch/herren/jacken-mantel/",
      handlePattern: /casamoda\.com\/[^"'\s]*\/p\/([a-z0-9-]+)/i,
    },
    {
      brand: "venti",
      url: "https://www.venti.com/de-ch/herren/jacken-mantel/",
      handlePattern: /venti\.com\/[^"'\s]*\/p\/([a-z0-9-]+)/i,
    },
  ],
};

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v2";

async function firecrawlMap(url: string, apiKey: string): Promise<string[]> {
  const res = await fetch(`${FIRECRAWL_BASE}/map`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, limit: 1000, includeSubdomains: false }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Firecrawl map failed [${res.status}]: ${body}`);
  }
  const data = await res.json();
  // v2 returns { success, links: [...] } or { success, data: { links: [...] } }
  const links: string[] =
    (Array.isArray(data?.links) && data.links) ||
    (Array.isArray(data?.data?.links) && data.data.links) ||
    [];
  return links;
}

async function firecrawlScrapeLinks(
  url: string,
  apiKey: string,
): Promise<string[]> {
  const res = await fetch(`${FIRECRAWL_BASE}/scrape`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["links"],
      onlyMainContent: false,
      waitFor: 2000,
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
  return links;
}

function extractHandles(links: string[], pattern: RegExp): string[] {
  const set = new Set<string>();
  for (const link of links) {
    const m = link.match(pattern);
    if (m && m[1]) set.add(m[1].toLowerCase());
  }
  return Array.from(set);
}

async function syncSeason(
  season: Season,
  firecrawlKey: string,
  supabase: ReturnType<typeof createClient>,
): Promise<{ season: Season; brand: string; count: number; error?: string }[]> {
  const results: {
    season: Season;
    brand: string;
    count: number;
    error?: string;
  }[] = [];

  for (const source of SOURCES[season]) {
    try {
      // Try /map first (cheap & fast)
      let links = await firecrawlMap(source.url, firecrawlKey);
      let handles = extractHandles(links, source.handlePattern);

      // Fallback: scrape with links format
      if (handles.length === 0) {
        links = await firecrawlScrapeLinks(source.url, firecrawlKey);
        handles = extractHandles(links, source.handlePattern);
      }

      if (handles.length > 0) {
        // Replace previous mapping for this brand+season
        await supabase
          .from("brand_season_products")
          .delete()
          .eq("brand", source.brand)
          .eq("season", season);

        const rows = handles.map((handle) => ({
          brand: source.brand,
          season,
          handle,
          source_url: source.url,
        }));

        const { error: insertError } = await supabase
          .from("brand_season_products")
          .insert(rows);

        if (insertError) throw insertError;
      }

      results.push({ season, brand: source.brand, count: handles.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[season-sync] ${season}/${source.brand} failed:`, msg);
      results.push({
        season,
        brand: source.brand,
        count: 0,
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
