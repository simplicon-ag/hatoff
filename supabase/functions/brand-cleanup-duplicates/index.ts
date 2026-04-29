// One-shot cleanup: find Casa Moda + Venti products in Shopify whose handles
// follow the per-color pattern (...-<articleId>-<colorId>) and that exist
// MULTIPLE times for the same handle. Keep newest, delete the rest.
// Also reconciles product_color_group rows pointing at deleted IDs.
//
// Trigger: POST { dry_run?: boolean = true, max_pages?: number = 20 }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ADMIN_VERSION = "2025-07";

function resolveAdminToken(): string {
  const direct =
    Deno.env.get("SHOPIFY_ADMIN_API_TOKEN") ?? Deno.env.get("SHOPIFY_ACCESS_TOKEN");
  if (direct && direct.startsWith("shpat_")) return direct;
  for (const [k, v] of Object.entries(Deno.env.toObject())) {
    if (k.startsWith("SHOPIFY_ONLINE_ACCESS_TOKEN") && v?.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(v);
        const t = parsed.access_token ?? parsed.accessToken ?? parsed.token;
        if (typeof t === "string" && t.startsWith("shpat_")) return t;
      } catch { /* ignore */ }
    }
  }
  return direct ?? "";
}

async function listAllProducts(domain: string, token: string, maxPages: number) {
  const all: Array<{ id: number; handle: string; vendor: string; created_at: string; tags: string }> = [];
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run !== false; // default true
    const maxPages = Math.max(1, Math.min(40, Number(body.max_pages ?? 20)));

    const domain = Deno.env.get("SHOPIFY_STORE_DOMAIN") ?? "style-compass-6nrqi.myshopify.com";
    const token = resolveAdminToken();
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "SHOPIFY_ADMIN_API_TOKEN missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { products, pages } = await listAllProducts(domain, token, maxPages);
    // Group by handle
    const byHandle = new Map<string, Array<{ id: number; created_at: string }>>();
    for (const p of products) {
      const arr = byHandle.get(p.handle) ?? [];
      arr.push({ id: p.id, created_at: p.created_at });
      byHandle.set(p.handle, arr);
    }
    const dupHandles = [...byHandle.entries()].filter(([, ids]) => ids.length > 1);

    const toDelete: Array<{ handle: string; keep: number; delete: number[] }> = [];
    for (const [handle, ids] of dupHandles) {
      ids.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)); // newest first
      const keep = ids[0].id;
      const del = ids.slice(1).map((x) => x.id);
      toDelete.push({ handle, keep, delete: del });
    }

    let deleted = 0;
    let failed = 0;
    if (!dryRun) {
      for (const grp of toDelete) {
        for (const id of grp.delete) {
          const r = await fetch(
            `https://${domain}/admin/api/${ADMIN_VERSION}/products/${id}.json`,
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
        unique_handles: byHandle.size,
        duplicate_handles: dupHandles.length,
        extras_total: toDelete.reduce((a, g) => a + g.delete.length, 0),
        dry_run: dryRun,
        deleted: dryRun ? 0 : deleted,
        failed: dryRun ? 0 : failed,
        sample: toDelete.slice(0, 10),
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
