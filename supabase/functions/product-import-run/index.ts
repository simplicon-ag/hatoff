// Worker: processes a small batch of pending products.
// Steps per item:
//  1. Scrape product page via Firecrawl (HTML+links+screenshot off, html only)
//  2. Extract title, description, price, compare_at_price, image URLs, sizes
//  3. If dry_run: store scraped_data, mark `scraped`
//  4. Else: download images, upload to Shopify, create product+variants, mark `created`
//
// Trigger: POST { batch_size?: number }. Returns processed count.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_DOMAIN = "style-compass-6nrqi.myshopify.com";
const SHOPIFY_ADMIN_VERSION = "2025-07";

interface ScrapedProduct {
  title: string;
  description: string;
  price_eur: number | null;
  compare_at_price_eur: number | null;
  on_sale: boolean;
  image_urls: string[];
  sizes: string[];
  product_type: string | null;
  vendor: string;
  tags: string[];
}

const EUR_TO_CHF = 0.95;

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
        waitFor: 5000,
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

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/** Extract article id and color id from product URL.
 *  https://www.casamoda.com/de/de/t-shirt-blau-14899-154 → { articleId: "14899", colorId: "154" } */
function parseProductIds(url: string): { articleId: string; colorId: string } | null {
  const m = url.match(/-(\d+)-(\d+)\/?$/);
  if (!m) return null;
  return { articleId: m[1], colorId: m[2] };
}

/** Build a clean title from the <title> tag content.
 *  Casa Moda format: "T-Shirt Blau 126340041 - CASAMODA"
 *  Venti format:     "Businesshemd Hellblau - Modern Fit 001480 - VENTI" */
function cleanTitle(rawTitle: string, brand: string): string {
  let t = decode(rawTitle).trim();
  // Strip brand suffix
  t = t.replace(/\s*-\s*(CASAMODA|VENTI)\s*$/i, "");
  // Strip trailing 6+ digit article codes
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

function extractFromHtml(html: string, brand: string, sourceUrl: string): ScrapedProduct {
  const ids = parseProductIds(sourceUrl);

  // 1) Title: prefer <h1>, then meta og:title, then <title>, then slug fallback.
  // Casa Moda's <title> is buggy ("Loyalty Wallet" everywhere), so H1 wins.
  let title = "";
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    const inner = h1Match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (inner.length > 1 && inner.length < 200) title = decode(inner);
  }
  if (!title) {
    const og = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
    if (og) title = cleanTitle(og[1], brand);
  }
  if (!title) {
    const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (t) {
      const cleaned = cleanTitle(t[1], brand);
      // Only use it if it doesn't look like a generic UI label
      if (cleaned && !/loyalty|wallet|warenkorb|cart|404/i.test(cleaned)) {
        title = cleaned;
      }
    }
  }
  if (!title) {
    // Slug fallback: "freizeithemd-kurzarm-blau" → "Freizeithemd Kurzarm Blau"
    const slug = sourceUrl.replace(/^https?:\/\/[^/]+\/de\/de\//i, "").replace(/-\d+-\d+\/?$/, "");
    title = slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  // 2) Description from meta description
  let description = "";
  const descMatch = html.match(
    /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
  );
  if (descMatch) description = decode(descMatch[1]);

  // 3) Price: prefer <div class="article-price"> blocks (definitive), else fallback to most-frequent.
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
      // Lowest = current price (sale or normal), highest = compare_at if differs
      price_eur = Math.min(...prices);
      const max = Math.max(...prices);
      if (max > price_eur + 0.5) compare_at_price_eur = max;
    }
  }

  // Fallback: frequency-based extraction from all "X,XX €" patterns
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

  // 4) Images: imgix.net product images filtered by article ID
  // Format: https://<brand>-b2c-(cloud-)?production.imgix.net/product/<articleId>/<colorId>/<articleId>-<colorId>-image-N-<hash>.jpg
  const imgUrls = new Set<string>();
  if (ids) {
    const { articleId, colorId } = ids;
    // Match images whose path contains /product/<articleId>/<colorId>/
    const imgRegex = new RegExp(
      `https://[a-z0-9.-]*imgix\\.net/product/${articleId}/${colorId}/[^"'\\s]+?-image-\\d+-[a-f0-9]+\\.(?:jpg|jpeg|png|webp)`,
      "gi",
    );
    const m = html.match(imgRegex) ?? [];
    // Dedupe by image-N (ignoring imgix transform suffix)
    const seen = new Map<string, string>();
    for (const u of m) {
      const cleanUrl = u.split("?")[0]; // strip imgix params
      const imgN = cleanUrl.match(/-image-(\d+)-/);
      const key = imgN ? imgN[1] : cleanUrl;
      if (!seen.has(key)) {
        // Use a high-res variant (no width param = full size)
        seen.set(key, cleanUrl);
      }
    }
    // Sort by image number ascending
    const sortedImgs = Array.from(seen.entries()).sort((a, b) =>
      Number(a[0]) - Number(b[0]),
    );
    for (const [, url] of sortedImgs) imgUrls.add(url);
  }

  // 5) Product type heuristic
  let product_type: string | null = null;
  const t = title.toLowerCase();
  if (/sakko/.test(t)) product_type = "Sakko";
  else if (/anzug/.test(t)) product_type = "Sakko";
  else if (/hemd/.test(t)) product_type = "Hemd";
  else if (/hose|chino|jeans|bermuda/.test(t)) product_type = "Hose";
  else if (/polo/.test(t)) product_type = "Polo";
  else if (/shirt|t-shirt/.test(t)) product_type = "Shirt";
  else if (/strick|pullover|sweater|sweat|cardigan/.test(t)) product_type = "Strick";
  else if (/jacke|mantel|parka|weste/.test(t)) product_type = "Jacke";
  else if (/krawatt|fliege|tuch|gürtel|guertel|schal|cap/.test(t)) product_type = "Accessoire";

  // 6) Sizes: use sensible defaults per product type (page sizes are JS-loaded)
  const sizes = product_type
    ? BRAND_DEFAULT_SIZES[product_type] ?? ["S", "M", "L", "XL", "XXL"]
    : ["S", "M", "L", "XL", "XXL"];

  return {
    title,
    description,
    price_eur,
    compare_at_price_eur,
    on_sale,
    image_urls: Array.from(imgUrls).slice(0, 6),
    sizes,
    product_type,
    vendor: brand === "casa-moda" ? "Casa Moda" : "Venti",
    tags: [brand, ...(product_type ? [product_type.toLowerCase()] : [])],
  };
}

async function uploadImageToShopify(
  productId: string,
  imageUrl: string,
  adminToken: string,
): Promise<boolean> {
  // Shopify accepts an external src — we don't need to download/re-upload.
  // The "robust" mode: Shopify fetches the image from the source URL once
  // and stores it in their CDN forever.
  try {
    const res = await fetch(
      `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_ADMIN_VERSION}/products/${productId}/images.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": adminToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image: { src: imageUrl } }),
      },
    );
    if (!res.ok) {
      console.error(`[worker] image upload ${res.status}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[worker] image upload error:", err);
    return false;
  }
}

async function createShopifyProduct(
  data: ScrapedProduct,
  handle: string,
  adminToken: string,
): Promise<{ id: string } | null> {
  const priceChf = data.price_eur ? (data.price_eur * EUR_TO_CHF).toFixed(2) : "0.00";
  const compareAt = data.compare_at_price_eur
    ? (data.compare_at_price_eur * EUR_TO_CHF).toFixed(2)
    : null;

  const sizes = data.sizes.length > 0 ? data.sizes : ["One Size"];

  const body = {
    product: {
      title: data.title || handle,
      body_html: data.description,
      vendor: data.vendor,
      product_type: data.product_type ?? "Bekleidung",
      tags: data.tags.join(","),
      handle,
      status: "active",
      options: [{ name: "Grösse", values: sizes }],
      variants: sizes.map((s) => ({
        option1: s,
        price: priceChf,
        compare_at_price: compareAt,
        inventory_management: null, // don't track inventory
        inventory_policy: "continue",
      })),
    },
  };

  const res = await fetch(
    `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_ADMIN_VERSION}/products.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": adminToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const errText = await res.text();
    console.error(`[worker] create product ${res.status}: ${errText}`);
    throw new Error(`Shopify ${res.status}: ${errText.slice(0, 300)}`);
  }
  const json = await res.json();
  return { id: String(json.product.id) };
}

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
    const batchSize = Math.min(Number(body.batch_size ?? 8), 15);

    // Check job state
    const { data: job } = await supabase
      .from("product_import_job")
      .select("*")
      .eq("id", "singleton")
      .single();

    if (!job) {
      return new Response(
        JSON.stringify({ success: false, error: "no job row" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (job.state === "stopping" || job.state === "stopped" || job.state === "idle") {
      await supabase
        .from("product_import_job")
        .update({
          state: "stopped",
          message: "Gestoppt",
          updated_at: new Date().toISOString(),
        })
        .eq("id", "singleton");
      return new Response(
        JSON.stringify({ success: true, state: "stopped", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const dryRun = Boolean(job.dry_run);
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY") ?? "";
    const adminTokenPrimary = Deno.env.get("SHOPIFY_ADMIN_API_TOKEN");
    const adminTokenFallback = Deno.env.get("SHOPIFY_ACCESS_TOKEN");
    const adminToken = adminTokenPrimary ?? adminTokenFallback ?? "";
    const tokenSource = adminTokenPrimary
      ? "SHOPIFY_ADMIN_API_TOKEN"
      : adminTokenFallback
        ? "SHOPIFY_ACCESS_TOKEN (fallback)"
        : "none";

    if (!dryRun) {
      if (!adminToken) {
        await supabase
          .from("product_import_job")
          .update({
            state: "error",
            message:
              "SHOPIFY_ADMIN_API_TOKEN nicht konfiguriert — bitte Secret setzen.",
            updated_at: new Date().toISOString(),
          })
          .eq("id", "singleton");
        return new Response(
          JSON.stringify({ success: false, error: "no admin token" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Fail-fast auth probe — verify token works before processing batch
      console.log(`[worker] using token from ${tokenSource}`);
      const probe = await fetch(
        `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_ADMIN_VERSION}/shop.json`,
        { headers: { "X-Shopify-Access-Token": adminToken } },
      );
      if (probe.status === 401 || probe.status === 403) {
        const body = await probe.text().catch(() => "");
        console.error(`[worker] auth probe failed ${probe.status}: ${body}`);
        await supabase
          .from("product_import_job")
          .update({
            state: "error",
            message: `Shopify-Token ungültig (${probe.status}) — bitte SHOPIFY_ADMIN_API_TOKEN aktualisieren. Quelle: ${tokenSource}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", "singleton");
        return new Response(
          JSON.stringify({
            success: false,
            error: `shopify auth ${probe.status}`,
            token_source: tokenSource,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Pull a batch of pending items
    const { data: items, error: fetchErr } = await supabase
      .from("product_import_log")
      .select("id, brand, source_url, handle")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (fetchErr) throw fetchErr;

    if (!items || items.length === 0) {
      // Done!
      await supabase
        .from("product_import_job")
        .update({
          state: "done",
          message: "Alle Produkte verarbeitet",
          updated_at: new Date().toISOString(),
        })
        .eq("id", "singleton");
      return new Response(
        JSON.stringify({ success: true, state: "done", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let processed = 0;
    let createdCount = 0;
    let errorCount = 0;

    for (const item of items) {
      processed++;

      try {
        // Mark as scraping
        await supabase
          .from("product_import_log")
          .update({
            status: "scraping",
            dry_run: dryRun,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        const html = await firecrawlScrape(item.source_url, firecrawlKey);
        if (!html) {
          await supabase
            .from("product_import_log")
            .update({
              status: "error",
              error_message: "Firecrawl returned no HTML",
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);
          errorCount++;
          continue;
        }

        const scraped = extractFromHtml(html, item.brand, item.source_url);
        if (!scraped.title || scraped.price_eur === null) {
          await supabase
            .from("product_import_log")
            .update({
              status: "error",
              error_message: `Konnte Titel/Preis nicht extrahieren (title="${scraped.title}", price=${scraped.price_eur})`,
              scraped_data: scraped,
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);
          errorCount++;
          continue;
        }

        if (dryRun) {
          await supabase
            .from("product_import_log")
            .update({
              status: "scraped",
              scraped_data: scraped,
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);
          createdCount++;
          continue;
        }

        // Real run: create product, then attach images
        await supabase
          .from("product_import_log")
          .update({
            status: "creating",
            scraped_data: scraped,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        const created = await createShopifyProduct(
          scraped,
          item.handle,
          adminToken,
        );
        if (!created) throw new Error("create returned null");

        // Attach images sequentially (Shopify rate-limits to ~2/sec)
        for (const imgUrl of scraped.image_urls) {
          await uploadImageToShopify(created.id, imgUrl, adminToken);
          await new Promise((r) => setTimeout(r, 600));
        }

        await supabase
          .from("product_import_log")
          .update({
            status: "created",
            shopify_product_id: created.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        createdCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await supabase
          .from("product_import_log")
          .update({
            status: "error",
            error_message: msg.slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        errorCount++;
      }
    }

    // Update job counters
    await supabase
      .from("product_import_job")
      .update({
        processed: (job.processed ?? 0) + processed,
        created_count: (job.created_count ?? 0) + createdCount,
        error_count: (job.error_count ?? 0) + errorCount,
        message: `Batch fertig: ${createdCount} ok, ${errorCount} Fehler`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "singleton");

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        created: createdCount,
        errors: errorCount,
        state: "running",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[worker] fatal:", msg);
    await supabase
      .from("product_import_job")
      .update({
        message: `Worker-Fehler: ${msg.slice(0, 200)}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "singleton");
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
