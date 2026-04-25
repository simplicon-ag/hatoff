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
  original_price_eur: number | null;
  original_price_chf: number | null;
  on_sale: boolean;
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
 * Parsed EUR-Preise aus Markdown/Text der Produktseite und erkennt Sale.
 * Gibt { current, original } zurück:
 *  - `current`: aktueller (ggf. reduzierter) Preis = HÄUFIGSTER Preis
 *  - `original`: UVP wenn Sale erkannt, sonst null
 *
 * Sale-Heuristik:
 *  1) Markdown nach explizitem Sale-Muster scannen: "statt X €", "UVP X €",
 *     durchgestrichene Preise (`~~X €~~`), oder zwei Preise direkt nebeneinander.
 *  2) Sonst: häufigster Preis = current. Falls ein deutlich höherer Preis
 *     (>10%) ebenfalls vorkommt, gilt er als UVP.
 */
function extractEurPrices(
  text: string,
): { current: number; original: number | null } | null {
  const priceRe = /(\d{1,4})[.,](\d{2})\s*€/g;
  const all: number[] = [];
  const counts = new Map<number, number>();
  let m;
  while ((m = priceRe.exec(text)) !== null) {
    const whole = parseInt(m[1], 10);
    const decimals = parseInt(m[2], 10);
    if (whole >= 5 && whole < 2000) {
      const price = whole + decimals / 100;
      all.push(price);
      counts.set(price, (counts.get(price) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return null;

  // 1) Explizite Sale-Marker suchen (UVP / statt / durchgestrichen)
  let explicitOriginal: number | null = null;
  let explicitCurrent: number | null = null;

  // Pattern: "~~129,99 €~~ 54,99 €" (durchgestrichen + neuer Preis)
  const struckRe = /~~\s*(\d{1,4})[.,](\d{2})\s*€\s*~~[^\d]{0,40}(\d{1,4})[.,](\d{2})\s*€/g;
  const sm = struckRe.exec(text);
  if (sm) {
    const orig = parseInt(sm[1], 10) + parseInt(sm[2], 10) / 100;
    const curr = parseInt(sm[3], 10) + parseInt(sm[4], 10) / 100;
    if (orig > curr) {
      explicitOriginal = orig;
      explicitCurrent = curr;
    }
  }

  // Pattern: "statt 129,99 €" oder "UVP 129,99 €"
  if (explicitOriginal === null) {
    const stattRe = /(?:statt|UVP|ehemals)\s*(\d{1,4})[.,](\d{2})\s*€/gi;
    const st = stattRe.exec(text);
    if (st) {
      explicitOriginal = parseInt(st[1], 10) + parseInt(st[2], 10) / 100;
    }
  }

  // Häufigster Preis (Modus) für aktuellen Preis
  const sorted = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0] - b[0];
  });
  const current = explicitCurrent ?? sorted[0][0];

  // Original-Preis bestimmen
  let original: number | null = explicitOriginal;
  if (original === null) {
    // Fallback: höchster Preis im Dokument, falls deutlich >10% über aktuellem
    const maxPrice = Math.max(...all);
    if (maxPrice > current * 1.1) {
      original = maxPrice;
    }
  }

  return { current, original };
}

/** Rundet ABWÄRTS auf nächste .95-Grenze (89.99 → 89.95, 90.10 → 89.95). */
function roundDownTo95(amount: number): number {
  const floor = Math.floor(amount);
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

async function firecrawlSearchUrl(
  query: string,
  site: string,
): Promise<string | null> {
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
      limit: 5,
      // Kein scrapeOptions — wir wollen nur die URL, nicht den Snippet-Inhalt
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Firecrawl search [${res.status}]: ${JSON.stringify(data).slice(0, 300)}`,
    );
  }

  const results =
    data?.data?.web ?? data?.web ?? data?.data ?? data?.results ?? [];
  // Bevorzuge URLs, die nach Produktseite aussehen (enthalten Bindestriche und Ziffern)
  for (const r of results) {
    const url = r?.url ?? r?.link;
    if (!url) continue;
    // Filter offensichtliche Nicht-Produktseiten weg
    if (/groessentabellen|wishlist|cart|warenkorb|kategorie/i.test(url)) continue;
    return url;
  }
  // Fallback: erste URL
  return results[0]?.url ?? results[0]?.link ?? null;
}

async function firecrawlScrape(url: string): Promise<string | null> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY not configured");

  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
    }),
  });

  const data = await res.json();
  if (!res.ok) return null;
  return data?.data?.markdown ?? data?.markdown ?? null;
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

      // Mismatch-Einträge: vom Audit als falsch markiert. Cache-Wert NICHT
      // ausliefern (sonst kämen falsche Sale-Preise in die UI) und auch
      // NICHT überschreiben (sonst geht die Mismatch-Markierung verloren).
      // Stattdessen: stiller Shopify-Fallback ohne Sale-Badge.
      if (c && c.status === "mismatch") {
        const display = fallbackPrice(shopifyPrices[handle]);
        results.push({
          handle,
          brand: c.brand,
          source_url: null,
          raw_price_eur: null,
          display_price_chf: display,
          original_price_eur: null,
          original_price_chf: null,
          on_sale: false,
          status: "fallback",
          fetched_at: new Date().toISOString(),
        });
        continue;
      }

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
            original_price_eur: c.original_price_eur ?? null,
            original_price_chf:
              c.original_price_chf != null ? Number(c.original_price_chf) : null,
            on_sale: !!c.on_sale,
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
          original_price_eur: null,
          original_price_chf: null,
          on_sale: false,
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
            original_price_eur: result.original_price_eur,
            original_price_chf: result.original_price_chf,
            on_sale: result.on_sale,
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
        const foundUrl = await firecrawlSearchUrl(term, site);
        if (!foundUrl) {
          const display = fallbackPrice(shopifyPrices[handle]);
          result = {
            handle,
            brand,
            source_url: null,
            raw_price_eur: null,
            display_price_chf: display,
            original_price_eur: null,
            original_price_chf: null,
            on_sale: false,
            status: "not_found",
            fetched_at: new Date().toISOString(),
          };
        } else {
          // Eigene Anfrage zur vollen Produktseite — Snippets sind oft irreführend
          const md = await firecrawlScrape(foundUrl);
          const parsed = md ? extractEurPrices(md) : null;
          if (!parsed) {
            const display = fallbackPrice(shopifyPrices[handle]);
            result = {
              handle,
              brand,
              source_url: foundUrl,
              raw_price_eur: null,
              display_price_chf: display,
              original_price_eur: null,
              original_price_chf: null,
              on_sale: false,
              status: "fallback",
              fetched_at: new Date().toISOString(),
            };
          } else {
            // EUR → CHF 1:1 → auf .95 abrunden
            const chf = roundDownTo95(parsed.current);
            const origChf =
              parsed.original !== null ? roundDownTo95(parsed.original) : null;
            const onSale = origChf !== null && origChf > chf;
            result = {
              handle,
              brand,
              source_url: foundUrl,
              raw_price_eur: parsed.current,
              display_price_chf: chf,
              original_price_eur: parsed.original,
              original_price_chf: origChf,
              on_sale: onSale,
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
          original_price_eur: null,
          original_price_chf: null,
          on_sale: false,
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
          original_price_eur: result.original_price_eur,
          original_price_chf: result.original_price_chf,
          on_sale: result.on_sale,
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
