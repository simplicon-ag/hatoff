// Per-Color Import Worker
// Picks N rows from product_import_log with status='sync_pending' and brand in (casa-moda, venti),
// calls product-import-by-url with { single_color: true, force: true } for each,
// then upserts into product_color_group so siblings of the same article can be linked.
//
// Trigger: POST { batch_size?: number = 5, brand?: 'casa-moda'|'venti', status?: 'active'|'draft' = 'draft' }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function parseProductIds(url: string): { articleId: string; colorId: string } | null {
  const m = url.match(/-(\d+)-(\d+)\/?$/);
  if (!m) return null;
  return { articleId: m[1], colorId: m[2] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const startTime = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = Math.max(1, Math.min(20, Number(body.batch_size ?? 5)));
    const brandFilter = String(body.brand ?? "").trim();
    const productStatus = String(body.status ?? "draft").toLowerCase() === "active" ? "active" : "draft";
    const categoryTag = String(body.category_tag ?? "").trim();
    // Wall-clock budget per worker invocation. Edge functions are killed around 150s,
    // and a single product import takes ~30-70s. We stop claiming new work
    // before we run out of time so nothing stays stuck on 'syncing'.
    const maxRuntimeMs = Math.max(20000, Math.min(120000, Number(body.max_runtime_ms ?? 90000)));
    const perItemBudgetMs = 75000; // safety margin per product
    const timeLeft = () => maxRuntimeMs - (Date.now() - startTime);

    // Atomically claim a batch (prevents race conditions across parallel workers)
    const { data: rows, error: selErr } = await supabase.rpc(
      "claim_pending_import_rows",
      {
        _batch_size: batchSize,
        _brand: brandFilter === "casa-moda" || brandFilter === "venti" ? brandFilter : null,
      },
    );
    if (selErr) throw selErr;

    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "no pending items" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let ok = 0;
    let failed = 0;
    let skipped = 0;
    const results: Array<Record<string, unknown>> = [];

    for (const row of rows) {
      // Stop if we don't have time for another product. Release the claim
      // back to sync_pending so the next worker invocation can pick it up.
      if (timeLeft() < perItemBudgetMs) {
        await supabase
          .from("product_import_log")
          .update({ status: "sync_pending", updated_at: new Date().toISOString() })
          .eq("id", row.id);
        skipped++;
        results.push({ id: row.id, ok: false, skipped: true, reason: "time-budget" });
        continue;
      }
      const ids = parseProductIds(row.source_url);
      if (!ids) {
        await supabase
          .from("product_import_log")
          .update({
            status: "sync_error",
            error_message: "URL-Format ungültig (kein -<articleId>-<colorId>)",
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        failed++;
        results.push({ id: row.id, ok: false, error: "url-parse" });
        continue;
      }

      try {
        const importRes = await fetch(`${supabaseUrl}/functions/v1/product-import-by-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            url: row.source_url,
            single_color: true,
            force: true,
            status: productStatus,
            ...(categoryTag ? { category_tag: categoryTag } : {}),
          }),
        });
        const data = await importRes.json().catch(() => ({}));

        if (!importRes.ok || !data?.success) {
          const errMsg = (data?.error ?? `HTTP ${importRes.status}`).toString().slice(0, 500);
          await supabase
            .from("product_import_log")
            .update({
              status: "sync_error",
              error_message: errMsg,
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          failed++;
          results.push({ id: row.id, ok: false, error: errMsg });
          continue;
        }

        const handle = String(data.handle ?? "");
        const productId = String(data.shopify_product_id ?? "");
        const colorName = Array.isArray(data.colors) && data.colors.length > 0
          ? String(data.colors[0])
          : `Farbe ${ids.colorId}`;

        // Upsert into product_color_group (sibling mapping)
        await supabase
          .from("product_color_group")
          .upsert(
            {
              parent_article_id: ids.articleId,
              brand: row.brand,
              color: colorName,
              shopify_handle: handle,
              shopify_product_id: productId,
              source_url: row.source_url,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "shopify_handle" },
          );

        await supabase
          .from("product_import_log")
          .update({
            status: "synced",
            handle,
            shopify_product_id: productId,
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        ok++;
        results.push({
          id: row.id,
          ok: true,
          handle,
          color: colorName,
          article_id: ids.articleId,
          action: data.action,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await supabase
          .from("product_import_log")
          .update({
            status: "sync_error",
            error_message: msg.slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        failed++;
        results.push({ id: row.id, ok: false, error: msg });
      }

      // Small pause between products
      await new Promise((r) => setTimeout(r, 800));
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: rows.length,
        ok,
        failed,
        skipped,
        runtime_ms: Date.now() - startTime,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[brand-import-worker] fatal:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
