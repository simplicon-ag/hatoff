// Cleanup duplicates for per-color products (Casa Moda + Venti).
// Groups Shopify products by tag "art:<articleId>-<colorId>" (NOT handle, because
// Shopify auto-suffixes duplicate handles with -1/-2/...). Per group, the newest
// product is kept and the rest are deleted. The product_color_group table is
// remapped to point at the kept product id/handle.
//
// Trigger: POST { dry_run?: boolean = true, max_pages?: number = 40 }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ADMIN_VERSION = "2025-07";

function isValidShopifyToken(t: string | null | undefined): t is string {
  if (!t) return false;
  return /^shp(at|ua|ca|ss|pa)_/.test(t.trim());
}

function resolveAdminToken(): string {
  for (const [k, v] of Object.entries(Deno.env.toObject())) {
    if (!k.startsWith("SHOPIFY_ONLINE_ACCESS_TOKEN")) continue;
    const raw = v?.trim() ?? "";
    if (raw.startsWith("{")) {
      try {
        const parsed = JSON.parse(raw);
        const t = parsed.access_token ?? parsed.accessToken ?? parsed.token;
        if (isValidShopifyToken(t)) return t;
      } catch { /* ignore */ }
    } else if (isValidShopifyToken(raw)) {
      return raw;
    }
  }
  const legacy =
    Deno.env.get("SHOPIFY_ADMIN_API_TOKEN") ?? Deno.env.get("SHOPIFY_ACCESS_TOKEN");
  if (isValidShopifyToken(legacy)) return legacy!;
  return legacy ?? "";
}

type ShopifyProductLite = {
  id: number;
  handle: string;
  vendor: string;
  created_at: string;
  tags: string;
};

async function listAllProducts(domain: string, token: string, maxPages: number) {
  const all: ShopifyProductLite[] = [];
  let url: string | null =
    `https://${domain}/admin/api/${ADMIN_VERSION}/products.json?fields=id,handle,vendor,created_at,tags&limit=250`;
  let page = 0;
  while (url && page < maxPages) {
    page++;
    const r = await fetch(url, { headers: { "X-Shopify-Access-Token": token } });
    if (!r.ok) throw new Error(`Shopify list ${r.status}: ${await r.text()}`);
    const data = await r.json();
    for (const p of data.products ?? []) {
      if (!/casa|venti/i.test(p.vendor ?? "")) continue;
      all.push(p);
    }
    const link = r.headers.get("link") ?? "";
    const m = link.match(/<([^>]+)>;\s*rel="next"/);
    url = m ? m[1] : null;
  }
  return { products: all, pages: page };
}

function extractArtTag(tags: string): string | null {
  const list = (tags ?? "").split(",").map((t) => t.trim());
  for (const t of list) {
    if (/^art:\d+-\d+$/i.test(t)) return t.toLowerCase();
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run !== false;
    const maxPages = Math.max(1, Math.min(60, Number(body.max_pages ?? 40)));

    const domain = Deno.env.get("SHOPIFY_STORE_DOMAIN") ?? "style-compass-6nrqi.myshopify.com";
    const token = resolveAdminToken();
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "SHOPIFY_ADMIN_API_TOKEN missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { products, pages } = await listAllProducts(domain, token, maxPages);

    // Group by art-tag
    const byArt = new Map<string, ShopifyProductLite[]>();
    let untagged = 0;
    for (const p of products) {
      const tag = extractArtTag(p.tags);
      if (!tag) { untagged++; continue; }
      const arr = byArt.get(tag) ?? [];
      arr.push(p);
      byArt.set(tag, arr);
    }

    const dupGroups = [...byArt.entries()].filter(([, arr]) => arr.length > 1);

    type Plan = { art_tag: string; keep: ShopifyProductLite; delete: ShopifyProductLite[] };
    const plans: Plan[] = [];
    for (const [tag, arr] of dupGroups) {
      arr.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)); // newest first
      plans.push({ art_tag: tag, keep: arr[0], delete: arr.slice(1) });
    }

    let deleted = 0;
    let failed = 0;
    let remapped = 0;

    if (!dryRun) {
      for (const p of plans) {
        // Remap product_color_group: any row pointing at a deletion target → keep
        const delIds = p.delete.map((d) => String(d.id));
        const delHandles = p.delete.map((d) => d.handle);
        const { data: remap, error: remapErr } = await supabase
          .from("product_color_group")
          .update({
            shopify_product_id: String(p.keep.id),
            shopify_handle: p.keep.handle,
            updated_at: new Date().toISOString(),
          })
          .or(
            `shopify_product_id.in.(${delIds.join(",")}),shopify_handle.in.(${delHandles
              .map((h) => `"${h}"`)
              .join(",")})`,
          )
          .select("id");
        if (!remapErr && remap) remapped += remap.length;

        for (const d of p.delete) {
          const r = await fetch(
            `https://${domain}/admin/api/${ADMIN_VERSION}/products/${d.id}.json`,
            { method: "DELETE", headers: { "X-Shopify-Access-Token": token } },
          );
          if (r.ok) deleted++;
          else failed++;
          await new Promise((res) => setTimeout(res, 250));
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        pages,
        scanned: products.length,
        untagged,
        unique_art_tags: byArt.size,
        duplicate_groups: dupGroups.length,
        extras_total: plans.reduce((a, g) => a + g.delete.length, 0),
        dry_run: dryRun,
        deleted: dryRun ? 0 : deleted,
        failed: dryRun ? 0 : failed,
        remapped: dryRun ? 0 : remapped,
        sample: plans.slice(0, 10).map((p) => ({
          art_tag: p.art_tag,
          keep: { id: p.keep.id, handle: p.keep.handle, created_at: p.keep.created_at },
          delete: p.delete.map((d) => ({ id: d.id, handle: d.handle, created_at: d.created_at })),
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[brand-cleanup-duplicates] fatal:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
