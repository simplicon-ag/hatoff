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

/** Parse the brand URL into its semantic parts.
 *  Both Casa Moda and Venti use:  /de/de/<slug>-<articleId>-<colorId>
 *  e.g.  /de/de/businesshemd-3760-474  →  slug="businesshemd", art="3760", color="474"
 *  We strip the colour suffix from the slug so colour names like "blau", "beige"
 *  don't end up in the canonical handle. */
function parseProductUrl(url: string): { slugBase: string; articleId: string; colorId: string } | null {
  const path = url.replace(/^https?:\/\/[^/]+\/de\/de\//i, "").replace(/\/$/, "").toLowerCase();
  const m = path.match(/^([a-z0-9-]+?)-(\d{3,6})-(\d{2,5})$/);
  if (!m) return null;
  // Strip trailing colour-name token from the slug. The articleId is what
  // really groups variants — slug is just for display, but we need a
  // colour-neutral handle so all colours of the same article share one
  // Shopify product.
  const COLOR_BASES = [
    "blau","marine","navy","rot","weiss","weiß","ecru","creme","champagner",
    "schwarz","anthrazit","grau","silber","beige","sand","khaki","camel",
    "braun","cognac","gruen","grün","oliv","olive","mint","gelb","senf",
    "ocker","orange","rost","rosa","pink","altrosa","lila","violett",
    "tuerkis","türkis","petrol","weinrot",
  ];
  const PREFIXES = ["hell","mittel","dunkel","tief","alt","graues"];
  // Single-token colour words = prefix+base combos + plain bases + standalone modifiers
  const COLOR_WORDS = new Set<string>([
    ...COLOR_BASES,
    ...PREFIXES.flatMap((p) => COLOR_BASES.map((b) => p + b)),
    "champagner-beige", // handled separately as 2-token
    "hell","mittel","dunkel","tief","alt", // bare modifiers (consumed in 2nd pass)
  ]);
  let slugBase = m[1];
  // Strip up to 2 trailing colour words ("graues-mittelblau", "champagner-beige")
  for (let i = 0; i < 2; i++) {
    const parts = slugBase.split("-");
    if (parts.length > 1 && COLOR_WORDS.has(parts[parts.length - 1])) {
      parts.pop();
      slugBase = parts.join("-");
    } else break;
  }
  return { slugBase, articleId: m[2], colorId: m[3] };
}

function buildBaseHandle(brand: string, slugBase: string, articleId: string): string {
  // Colour-neutral handle: "casa-moda-businesshemd-3760"
  return `${brand}-${slugBase}-${articleId}`.toLowerCase();
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

async function fetchSitemapText(url: string): Promise<string | null> {
  // Handles plain XML and gzipped (.xml.gz) sitemaps. Casa Moda + Venti
  // ship their real sitemaps gzipped under /export/sitemap/...
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/xml,text/xml,*/*;q=0.8",
        "Accept-Encoding": "gzip",
      },
    });
    if (!res.ok || !res.body) return null;
    const isGz = url.toLowerCase().endsWith(".gz");
    if (isGz) {
      const stream = res.body.pipeThrough(new DecompressionStream("gzip"));
      return await new Response(stream).text();
    }
    return await res.text();
  } catch (e) {
    console.warn(`[discover] sitemap fetch failed for ${url}:`, e);
    return null;
  }
}

async function resolveSitemapRoots(siteRoot: string, fallback: string): Promise<string[]> {
  // Try robots.txt first — both brands list their real sitemap there.
  const roots = new Set<string>();
  try {
    const robots = await directFetch(`${siteRoot}/robots.txt`);
    if (robots) {
      for (const line of robots.split(/\r?\n/)) {
        const m = line.match(/^\s*Sitemap:\s*(\S+)/i);
        if (m) roots.add(m[1].trim());
      }
    }
  } catch (e) {
    console.warn(`[discover] robots.txt failed for ${siteRoot}:`, e);
  }
  if (roots.size === 0) roots.add(fallback);
  return Array.from(roots);
}

async function fetchSitemapUrls(brand: string, siteRoot: string, fallbackSitemap: string, pattern: RegExp): Promise<string[]> {
  // Walks robots.txt → sitemap-index → child sitemaps (gz aware) and
  // collects every product URL matching the brand pattern.
  const all = new Set<string>();
  try {
    const roots = await resolveSitemapRoots(siteRoot, fallbackSitemap);
    console.log(`[discover] ${brand} sitemap roots:`, roots);

    const visited = new Set<string>();
    const queue: string[] = [...roots];

    while (queue.length > 0 && visited.size < 50) {
      const sm = queue.shift()!;
      if (visited.has(sm)) continue;
      visited.add(sm);

      const body = await fetchSitemapText(sm);
      if (!body) continue;

      // If this is a sitemap-index, enqueue its children
      const childMatches = body.match(/<loc>\s*([^<\s]+\.xml(?:\.gz)?)\s*<\/loc>/gi) ?? [];
      const children = childMatches
        .map((m) => m.replace(/<\/?loc>/gi, "").trim())
        .filter((u) => u.includes("/sitemap"));
      if (children.length > 0) {
        for (const c of children) queue.push(c);
      }

      // Also pull product URLs out of THIS document directly (works for both
      // sitemap-index docs that accidentally contain product locs and for leaf sitemaps)
      for (const u of extractUrls(body, pattern)) all.add(u);
    }
  } catch (e) {
    console.warn(`[discover] sitemap walk failed for ${brand}:`, e);
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

    const body = await req.json().catch(() => ({}));
    // include_existing=true → bestehende Shopify-Handles werden NICHT übersprungen,
    // sondern als update_mode=true einsortiert (Worker macht Update statt Create).
    const includeExisting = Boolean(body.include_existing ?? false);

    console.log("[discover] fetching Casa Moda URLs (categories + sitemap)...");
    const [cmCats, cmSitemap] = await Promise.all([
      discoverBrandUrls("casa-moda", "https://www.casamoda.com", CASAMODA_SLUGS, CASAMODA_PRODUCT_RE),
      fetchSitemapUrls(
        "casa-moda",
        "https://www.casamoda.com",
        "https://www.casamoda.com/export/sitemap/sitemap_index.xml",
        CASAMODA_PRODUCT_RE,
      ),
    ]);
    const cmUrls = Array.from(new Set([...cmCats, ...cmSitemap]));
    console.log(`[discover] Casa Moda: ${cmUrls.length} URLs (cats=${cmCats.length}, sitemap=${cmSitemap.length})`);

    console.log("[discover] fetching Venti URLs (categories + sitemap)...");
    const [vtCats, vtSitemap] = await Promise.all([
      discoverBrandUrls("venti", "https://www.venti.com", VENTI_SLUGS, VENTI_PRODUCT_RE),
      fetchSitemapUrls(
        "venti",
        "https://www.venti.com",
        "https://www.venti.com/export/sitemap/sitemap_index.xml",
        VENTI_PRODUCT_RE,
      ),
    ]);
    const vtUrls = Array.from(new Set([...vtCats, ...vtSitemap]));
    console.log(`[discover] Venti: ${vtUrls.length} URLs (cats=${vtCats.length}, sitemap=${vtSitemap.length})`);

    console.log("[discover] fetching existing Shopify handles...");
    const existing = await fetchAllShopifyHandles();
    console.log(`[discover] Shopify already has ${existing.size} handles`);

    type Group = {
      brand: string;
      handle: string;
      slugBase: string;
      articleId: string;
      color_urls: Array<{ url: string; colorId: string }>;
      update_mode: boolean;
    };
    const groups = new Map<string, Group>();

    function addUrl(brand: string, url: string) {
      const parsed = parseProductUrl(url);
      if (!parsed) return;
      const handle = buildBaseHandle(brand, parsed.slugBase, parsed.articleId);
      const isExisting = existing.has(handle);
      if (isExisting && !includeExisting) return;
      let g = groups.get(handle);
      if (!g) {
        g = {
          brand,
          handle,
          slugBase: parsed.slugBase,
          articleId: parsed.articleId,
          color_urls: [],
          update_mode: isExisting,
        };
        groups.set(handle, g);
      }
      if (!g.color_urls.find((c) => c.colorId === parsed.colorId)) {
        g.color_urls.push({ url, colorId: parsed.colorId });
      }
    }

    for (const url of cmUrls) addUrl("casa-moda", url);
    for (const url of vtUrls) addUrl("venti", url);

    const newCount = Array.from(groups.values()).filter((g) => !g.update_mode).length;
    const updateCount = Array.from(groups.values()).filter((g) => g.update_mode).length;
    console.log(
      `[discover] ${groups.size} grouped products (new=${newCount}, update=${updateCount}, from ${cmUrls.length + vtUrls.length} URLs)`,
    );

    // Fresh discovery is source of truth — wipe previous log
    await supabase.from("product_import_log").delete().not("id", "is", null);

    const toInsert = Array.from(groups.values()).map((g) => ({
      brand: g.brand,
      source_url: g.color_urls[0].url,
      handle: g.handle,
      status: "pending" as const,
      update_mode: g.update_mode,
      scraped_data: {
        color_urls: g.color_urls,
        article_id: g.articleId,
        slug_base: g.slugBase,
      },
    }));

    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += 200) {
      const chunk = toInsert.slice(i, i + 200);
      const { error } = await supabase.from("product_import_log").insert(chunk);
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
        message: `Entdeckt: ${inserted} Produkte (${newCount} neu, ${updateCount} Update)`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "singleton");

    return new Response(
      JSON.stringify({
        success: true,
        casamoda_urls: cmUrls.length,
        venti_urls: vtUrls.length,
        shopify_existing: existing.size,
        groups: groups.size,
        new_count: newCount,
        update_count: updateCount,
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
