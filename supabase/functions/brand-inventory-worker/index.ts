// Brand Inventory Worker
// Iterates handles from product_color_group (brand in casa-moda, venti) and calls
// product-inventory-sync per handle so size availability stays in sync with the source shop.
//
// Trigger: POST { batch_size?: number = 20, brand?: 'casa-moda'|'venti', max_age_hours?: number = 6 }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
    const batchSize = Math.max(1, Math.min(100, Number(body.batch_size ?? 20)));
    const brandFilter = String(body.brand ?? "").trim();
    const maxAgeHours = Math.max(0, Number(body.max_age_hours ?? 6));
    const cutoff = new Date(Date.now() - maxAgeHours * 3600 * 1000).toISOString();

    let q = supabase
      .from("product_color_group")
      .select("id, brand, shopify_handle, source_url, updated_at")
      .in("brand", ["casa-moda", "venti"])
      .lt("updated_at", cutoff)
      .order("updated_at", { ascending: true })
      .limit(batchSize);
    if (brandFilter === "casa-moda" || brandFilter === "venti") {
      q = q.eq("brand", brandFilter);
    }
    const { data: rows, error: selErr } = await q;
    if (selErr) throw selErr;

    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "no handles due" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let ok = 0;
    let failed = 0;
    const results: Array<Record<string, unknown>> = [];

    for (const row of rows) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/product-inventory-sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            handle: row.shopify_handle,
            source_url: row.source_url ?? undefined,
          }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || data?.success === false) {
          const errMsg = (data?.error ?? `HTTP ${res.status}`).toString().slice(0, 500);
          failed++;
          results.push({ handle: row.shopify_handle, ok: false, error: errMsg });
        } else {
          ok++;
          results.push({
            handle: row.shopify_handle,
            ok: true,
            sizes: data?.sizes ?? data?.updated ?? null,
          });
        }

        // Touch updated_at so the round-robin advances even on failures
        await supabase
          .from("product_color_group")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", row.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        failed++;
        results.push({ handle: row.shopify_handle, ok: false, error: msg });
        await supabase
          .from("product_color_group")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", row.id);
      }

      // Gentle pacing
      await new Promise((r) => setTimeout(r, 600));
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: rows.length,
        ok,
        failed,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[brand-inventory-worker] fatal:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
