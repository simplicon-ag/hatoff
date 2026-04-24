// Live-Preis pro Produkt-Handle von casamoda.com / venti.com via Firecrawl
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Cache: 7 Tage
const CACHE_TTL_HOURS = 24 * 7;

type Brand = "casa-moda" | "venti";

interface PriceResult {
  handle: string;
  brand: string;
  source_url: string | null;
  raw_price_eur: number | null;
  display_price_chf: number;
  status: "ok" | "fallback" | "not_found";
  fetched_at: string;
}

/** Erkennt die Marke aus dem Shopify-Handle. */
function detectBrand(handle: string): Brand | null {
  if (handle.startsWith("casa-moda-")) return "casa-moda";
  if (handle.startsWith("venti-")) return "venti";
  return null;
}

/**
 * Baut aus dem Shopify-Handle einen sinnvollen Suchbegriff:
 *  "casa-moda-chinohose-chris-dunkelblau"
 *    → "chinohose chris dunkelblau"
 *  "venti-businesshemd-extra-langer-arm-72cm-weiss-var-3"
 *    → "businesshemd extra langer arm 72cm weiss"
 */
function handleToSearchTerm(handle: string, brand: Brand): string {
  const stripped = handle.replace(/^(casa-moda|venti)-/, "");
  // var-XX Suffixe entfernen
  const noVar = stripped.replace(/-var-\d+$/, "");
  const words = noVar.split("-").join(" ");
  return words.trim();
}

/** Markendomain für die Search-Site-Filterung. */
function brandSite(brand: Brand): string {
  return brand === "casa-moda" ? "casamoda.com" : "venti.com";
}

/**
 * Parsed einen EUR-Preis aus Markdown/Text der Produktseite.
 * Strategie: Auf Webshop-Produktseiten erscheint der aktuelle Preis sehr oft (Variantentabelle).
 * Wir nehmen daher den HÄUFIGSTEN Preis (Modus), nicht den niedrigsten.
 * Bei Gleichstand gewinnt der höhere (UVP > Sale-Banner Snippet).
 */
function extractEurPrice(text: string): number | null {
  const re = /(?:€\s*)?(\d{1,4})[.,](\d{2})\s*€/g;
  const counts = new Map<number, number>();
  let m;
  while ((m = re.exec(text)) !== null) {
    const whole = parseInt(m[1], 10);
    const decimals = parseInt(m[2], 10);
    if (whole >= 5 && whole < 2000) {
      const price = whole + decimals / 100;
      counts.set(price, (counts.get(price) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return null;
  // Sortiere nach Häufigkeit DESC, bei Gleichstand höherer Preis zuerst
  const sorted = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });
  return sorted[0][0];
}

/** Rundet ABWÄRTS auf nächste .95-Grenze (89.99 → 89.95, 90.10 → 89.95). */
function roundDownTo95(amount: number): number {
  const floor = Math.floor(amount);
  // wenn die Nachkommastelle unter .95 liegt, nimm den vorherigen Franken + .95
  if (amount - floor < 0.95) {
    return Math.max(0, floor - 1) + 0.95;
  }
  return floor + 0.95;
}

/** Fallback: nimmt einen Shopify-Preis und macht eine plausible UVP-Schätzung. */
function fallbackPrice(shopifyPrice?: number): number {
  if (!shopifyPrice || shopifyPrice <= 0) return 49.95;
  // Shopify-Sandbox-Preise sind meist sehr niedrig — UVP grob ×3, dann auf .95
  const estimated = shopifyPrice * 3;
  return roundDownTo95(estimated);
}

async function firecrawlSearch(
  query: string,
  site: string,
): Promise<{ url: string; content: string } | null> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY not configured");

  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `${query} site:${site}`,
      limit: 3,
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Firecrawl search [${res.status}]: ${JSON.stringify(data).slice(0, 300)}`,
    );
  }

  // Response shape kann variieren — robust auslesen
  const results =
    data?.data?.web ?? data?.web ?? data?.data ?? data?.results ?? [];
  for (const r of results) {
    const url = r?.url ?? r?.link;
    const md = r?.markdown ?? r?.content ?? r?.snippet ?? "";
    if (url && md && md.length > 50) {
      return { url, content: md };
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let handles: string[] = [];
    let shopifyPrices: Record<string, number> = {};
    let force = url.searchParams.get("force") === "1";

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      handles = Array.isArray(body.handles) ? body.handles : [];
      shopifyPrices = body.shopifyPrices ?? {};
      if (body.force) force = true;
    } else {
      const h = url.searchParams.get("handle");
      if (h) handles = [h];
    }

    if (handles.length === 0) {
      return new Response(
        JSON.stringify({ error: "No handles provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1) Cache lesen für alle Handles
    const cacheMap = new Map<string, any>();
    if (!force) {
      const { data: cached } = await supabase
        .from("product_price_cache")
        .select("*")
        .in("handle", handles);
      for (const c of cached ?? []) cacheMap.set(c.handle, c);
    }

    const results: PriceResult[] = [];

    for (const handle of handles) {
      // Cache-Hit?
      const c = cacheMap.get(handle);
      if (c) {
        const ageHrs =
          (Date.now() - new Date(c.fetched_at).getTime()) / 3_600_000;
        if (ageHrs < CACHE_TTL_HOURS) {
          results.push({
            handle: c.handle,
            brand: c.brand,
            source_url: c.source_url,
            raw_price_eur: c.raw_price_eur,
            display_price_chf: Number(c.display_price_chf),
            status: c.status,
            fetched_at: c.fetched_at,
          });
          continue;
        }
      }

      const brand = detectBrand(handle);
      if (!brand) {
        const display = fallbackPrice(shopifyPrices[handle]);
        const result: PriceResult = {
          handle,
          brand: "unknown",
          source_url: null,
          raw_price_eur: null,
          display_price_chf: display,
          status: "fallback",
          fetched_at: new Date().toISOString(),
        };
        results.push(result);
        await supabase.from("product_price_cache").upsert(
          {
            handle: result.handle,
            brand: result.brand,
            source_url: result.source_url,
            raw_price_eur: result.raw_price_eur,
            display_price_chf: result.display_price_chf,
            status: result.status,
            fetched_at: result.fetched_at,
          },
          { onConflict: "handle" },
        );
        continue;
      }

      const term = handleToSearchTerm(handle, brand);
      const site = brandSite(brand);

      let result: PriceResult;
      try {
        const found = await firecrawlSearch(term, site);
        if (!found) {
          const display = fallbackPrice(shopifyPrices[handle]);
          result = {
            handle,
            brand,
            source_url: null,
            raw_price_eur: null,
            display_price_chf: display,
            status: "not_found",
            fetched_at: new Date().toISOString(),
          };
        } else {
          const eur = extractEurPrice(found.content);
          if (eur === null) {
            const display = fallbackPrice(shopifyPrices[handle]);
            result = {
              handle,
              brand,
              source_url: found.url,
              raw_price_eur: null,
              display_price_chf: display,
              status: "fallback",
              fetched_at: new Date().toISOString(),
            };
          } else {
            // EUR → CHF 1:1 → auf .95 abrunden
            const chf = roundDownTo95(eur);
            result = {
              handle,
              brand,
              source_url: found.url,
              raw_price_eur: eur,
              display_price_chf: chf,
              status: "ok",
              fetched_at: new Date().toISOString(),
            };
          }
        }
      } catch (err) {
        console.error(`Firecrawl error for ${handle}:`, err);
        const display = fallbackPrice(shopifyPrices[handle]);
        result = {
          handle,
          brand,
          source_url: null,
          raw_price_eur: null,
          display_price_chf: display,
          status: "fallback",
          fetched_at: new Date().toISOString(),
        };
      }

      // Cache speichern
      await supabase.from("product_price_cache").upsert(
        {
          handle: result.handle,
          brand: result.brand,
          source_url: result.source_url,
          raw_price_eur: result.raw_price_eur,
          display_price_chf: result.display_price_chf,
          status: result.status,
          fetched_at: result.fetched_at,
        },
        { onConflict: "handle" },
      );

      results.push(result);
    }

    return new Response(JSON.stringify({ prices: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("product-price error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
