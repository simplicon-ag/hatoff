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
        waitFor: 3000,
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

function extractFromHtml(html: string, brand: string): ScrapedProduct {
  // Title
  let title = "";
  const titleMatch =
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
    html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
  if (titleMatch) {
    title = decode(titleMatch[1].replace(/<[^>]+>/g, "").trim());
  }

  // Description (og:description as a safe baseline)
  let description = "";
  const descMatch =
    html.match(
      /<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i,
    ) ||
    html.match(
      /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
    );
  if (descMatch) description = decode(descMatch[1]);

  // Price extraction (Casa Moda + Venti both render "EUR 89,95" or "89,95 €")
  let price_eur: number | null = null;
  let compare_at_price_eur: number | null = null;

  const priceMatches = html.match(/(\d{1,4}[,.]\d{2})\s*(?:€|EUR)/gi) ?? [];
  if (priceMatches.length > 0) {
    const nums = priceMatches
      .map((m) => parseFloat(m.replace(/[€EUR\s]/gi, "").replace(",", ".")))
      .filter((n) => !isNaN(n) && n > 5 && n < 1000);
    if (nums.length > 0) {
      price_eur = Math.min(...nums);
      const max = Math.max(...nums);
      if (max > price_eur + 0.5) compare_at_price_eur = max;
    }
  }
  const on_sale = compare_at_price_eur !== null;

  // Image URLs — grab all product images from the page
  const imgUrls = new Set<string>();
  // og:image is always reliable
  const ogImg = html.match(
    /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
  );
  if (ogImg) imgUrls.add(ogImg[1]);

  const imgRegex =
    brand === "casa-moda"
      ? /https:\/\/(?:www\.)?casamoda\.com\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)/gi
      : /https:\/\/(?:www\.)?venti\.com\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)/gi;
  const m = html.match(imgRegex) ?? [];
  for (const u of m) {
    // Filter out obvious junk (icons, sprites)
    if (/icon|sprite|logo|favicon/i.test(u)) continue;
    imgUrls.add(u.split("?")[0]);
  }

  // Sizes: typical labels S, M, L, XL, XXL, 38, 39, ... 48, etc.
  const sizes = new Set<string>();
  const sizeBlock = html.match(
    /(?:Gr(?:ö|oe)sse|Size)[^<]*<[\s\S]{0,3000}?<\/(?:ul|div|select)/i,
  );
  if (sizeBlock) {
    const numericSizes = sizeBlock[0].match(/\b(3[6-9]|4[0-9]|5[0-6])\b/g) ?? [];
    for (const s of numericSizes) sizes.add(s);
    const letterSizes =
      sizeBlock[0].match(/\b(XS|S|M|L|XL|XXL|XXXL|3XL|4XL)\b/g) ?? [];
    for (const s of letterSizes) sizes.add(s);
  }

  // Product type heuristic from URL handle / title
  let product_type: string | null = null;
  const t = title.toLowerCase();
  if (/hemd/.test(t)) product_type = "Hemd";
  else if (/hose|chino|jeans/.test(t)) product_type = "Hose";
  else if (/polo/.test(t)) product_type = "Polo";
  else if (/shirt|t-shirt/.test(t)) product_type = "Shirt";
  else if (/strick|pullover|sweater/.test(t)) product_type = "Strick";
  else if (/jacke|mantel|sakko/.test(t)) product_type = "Jacke";
  else if (/krawatt|fliege|tuch|gürtel|guertel/.test(t)) product_type = "Accessoire";

  return {
    title,
    description,
    price_eur,
    compare_at_price_eur,
    on_sale,
    image_urls: Array.from(imgUrls).slice(0, 6),
    sizes: Array.from(sizes),
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
    const adminToken =
      Deno.env.get("SHOPIFY_ADMIN_API_TOKEN") ??
      Deno.env.get("SHOPIFY_ACCESS_TOKEN") ??
      "";

    if (!dryRun && !adminToken) {
      throw new Error("SHOPIFY_ADMIN_API_TOKEN nicht konfiguriert");
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

        const scraped = extractFromHtml(html, item.brand);
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
