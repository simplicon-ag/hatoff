// Discovers all Casa Moda + Venti product URLs and inserts them as `pending`
// rows in product_import_log — but ONLY for handles not already in Shopify.
//
// Trigger: POST with no body. Returns counts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

const CASAMODA_PRODUCT_RE =
  /https:\/\/www\.casamoda\.com\/de\/de\/[a-z0-9-]+\-\d+\-\d+/gi;
const VENTI_PRODUCT_RE =
  /https:\/\/www\.venti\.com\/de\/de\/[a-z0-9-]+\-\d+\-\d+/gi;

// Wide net of category slugs — we want EVERYTHING, not just seasonal.
const CASAMODA_SLUGS = [
  "neuheiten",
  "neue-styles",
  "neue-bestseller",
  "highlights-der-saison",
  "hemden",
  "shirts",
  "shirts-neu",
  "freizeithemden-neu",
  "polos-shirts",
  "hosen",
  "chino",
  "jeans",
  "hosen-shorts-bermudas",
  "strick-sweat",
  "strick-sweat-neu",
  "accessoires",
  "accessoires-neu",
  "outdoor",
  "outdoor-neu",
  "jacken-westen",
  "pullover",
  "sweat",
  "business",
  "casual",
  "sale",
];

const VENTI_SLUGS = [
  "neue-styles",
  "monatshemd",
  "modern-fit-hemden-neu",
  "body-fit-hemden-neu",
  "comfort-fit-hemden-neu",
  "hemden-modern-fit",
  "hemde-body-fit",
  "hemden-comfort-fit",
  "hemden-jerseyflex",
  "hemden-buegelfrei",
  "hemden-extra-lang",
  "hemden-gala-hemden",
  "hemdjacke",
  "neu-hemdjacke",
  "polos-shirts",
  "basics",
  "accessoires",
  "accessoires-neu",
  "accessoires-krawatten",
  "accessoires-fliegen",
  "accessoires-einstecktuecher",
  "sakkos-westen",
  "sakkos-westen-neu",
  "sakkos",
  "anzuege",
  "anzughosen",
  "anzugwesten",
  "strick",
  "pullover",
  "business-hemden",
  "casual-hemden",
  "freizeithemden",
  "sale",
];

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

function extractUrls(text: string, pattern: RegExp): string[] {
  const matches = text.match(pattern) ?? [];
  const set = new Set<string>();
  for (const m of matches) set.add(m.split(/[?#]/)[0].toLowerCase());
  return Array.from(set);
}

function urlToHandle(url: string): string {
  // https://www.casamoda.com/de/de/some-product-name-12345-67 → some-product-name
  // We strip the trailing "-NNNNN-NN" article number.
  const path = url.replace(/^https?:\/\/[^/]+\/de\/de\//i, "");
  return path.replace(/-\d+-\d+\/?$/, "");
}

async function discoverBrandUrls(
  brand: string,
  baseUrl: string,
  slugs: string[],
  pattern: RegExp,
): Promise<string[]> {
  const all = new Set<string>();
  for (const slug of slugs) {
    const url =
      brand === "casa-moda"
        ? `${baseUrl}/de/de/article_collection/${slug}.json?page=1&size=500`
        : `${baseUrl}/de/de/${slug}`;
    const body = await directFetch(url);
    if (!body) continue;
    let text = body;
    if (brand === "casa-moda") {
      try {
        const json = JSON.parse(body);
        text = String(json?.product_list ?? body);
      } catch {
        /* keep raw */
      }
    }
    for (const u of extractUrls(text, pattern)) all.add(u);
  }
  return Array.from(all);
}

async function fetchAllShopifyHandles(): Promise<Set<string>> {
  // Use Storefront API since we can read it without admin credentials and
  // it's enough to know which handles already exist.
  const STOREFRONT_URL =
    "https://style-compass-6nrqi.myshopify.com/api/2025-07/graphql.json";
  const TOKEN = "82d196dbe5af439ca85dd9e1689f9c50";
  const query = `
    query GetHandles($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        edges { cursor node { handle } }
        pageInfo { hasNextPage endCursor }
      }
    }
  `;
  const handles = new Set<string>();
  let cursor: string | null = null;
  for (let i = 0; i < 20; i++) {
    const res = await fetch(STOREFRONT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": TOKEN,
      },
      body: JSON.stringify({
        query,
        variables: { first: 250, after: cursor },
      }),
    });
    const data = await res.json();
    const edges = data?.data?.products?.edges ?? [];
    for (const e of edges) handles.add(String(e.node.handle).toLowerCase());
    if (!data?.data?.products?.pageInfo?.hasNextPage) break;
    cursor = data.data.products.pageInfo.endCursor;
  }
  return handles;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    console.log("[discover] fetching Casa Moda URLs...");
    const cmUrls = await discoverBrandUrls(
      "casa-moda",
      "https://www.casamoda.com",
      CASAMODA_SLUGS,
      CASAMODA_PRODUCT_RE,
    );
    console.log(`[discover] Casa Moda: ${cmUrls.length} URLs`);

    console.log("[discover] fetching Venti URLs...");
    const vtUrls = await discoverBrandUrls(
      "venti",
      "https://www.venti.com",
      VENTI_SLUGS,
      VENTI_PRODUCT_RE,
    );
    console.log(`[discover] Venti: ${vtUrls.length} URLs`);

    console.log("[discover] fetching existing Shopify handles...");
    const existing = await fetchAllShopifyHandles();
    console.log(`[discover] Shopify already has ${existing.size} handles`);

    const candidates: { brand: string; source_url: string; handle: string }[] =
      [];

    for (const url of cmUrls) {
      const handle = urlToHandle(url);
      if (existing.has(handle)) continue;
      candidates.push({ brand: "casa-moda", source_url: url, handle });
    }
    for (const url of vtUrls) {
      const handle = urlToHandle(url);
      if (existing.has(handle)) continue;
      candidates.push({ brand: "venti", source_url: url, handle });
    }

    console.log(`[discover] ${candidates.length} new product candidates`);

    // Wipe previous pending/error rows and re-insert fresh discovery.
    // Keep created/skipped rows so we have a permanent log.
    await supabase
      .from("product_import_log")
      .delete()
      .in("status", ["pending", "error", "scraping", "scraped", "creating"]);

    // Filter out URLs that are already logged (e.g. previously created)
    const { data: alreadyLogged } = await supabase
      .from("product_import_log")
      .select("source_url");
    const loggedSet = new Set(
      (alreadyLogged ?? []).map((r) => String(r.source_url)),
    );

    const toInsert = candidates
      .filter((c) => !loggedSet.has(c.source_url))
      .map((c) => ({ ...c, status: "pending" as const }));

    // Insert in chunks
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += 200) {
      const chunk = toInsert.slice(i, i + 200);
      const { error } = await supabase
        .from("product_import_log")
        .insert(chunk);
      if (error) {
        console.error("[discover] insert error:", error.message);
        continue;
      }
      inserted += chunk.length;
    }

    // Update job total
    const { count: pendingTotal } = await supabase
      .from("product_import_log")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    await supabase
      .from("product_import_job")
      .update({
        total: pendingTotal ?? 0,
        message: `Entdeckt: ${inserted} neue Produkte`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "singleton");

    return new Response(
      JSON.stringify({
        success: true,
        casamoda_urls: cmUrls.length,
        venti_urls: vtUrls.length,
        shopify_existing: existing.size,
        new_candidates: candidates.length,
        inserted,
        pending_total: pendingTotal ?? 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[discover] fatal:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
