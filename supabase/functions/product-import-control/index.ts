// Control endpoint for the product import job.
// Actions: start (with dry_run), stop, reset.
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

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "").toLowerCase();
    const dryRun = Boolean(body.dry_run ?? true);

    if (action === "start") {
      // Mark job as running. Reset progress counters.
      const { count: total } = await supabase
        .from("product_import_log")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "error", "scraped"]);

      await supabase
        .from("product_import_job")
        .update({
          state: "running",
          dry_run: dryRun,
          processed: 0,
          total: total ?? 0,
          created_count: 0,
          error_count: 0,
          message: dryRun ? "Trockenlauf gestartet" : "Echter Import gestartet",
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", "singleton");

      return new Response(
        JSON.stringify({ success: true, state: "running", dry_run: dryRun }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "stop") {
      await supabase
        .from("product_import_job")
        .update({
          state: "stopping",
          message: "Stop angefordert — wartet auf aktuellen Batch",
          updated_at: new Date().toISOString(),
        })
        .eq("id", "singleton");

      return new Response(
        JSON.stringify({ success: true, state: "stopping" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "reset") {
      const { count: total } = await supabase
        .from("product_import_log")
        .select("id", { count: "exact", head: true });

      await supabase
        .from("product_import_log")
        .update({
          status: "pending",
          scraped_data: null,
          error_message: null,
          shopify_product_id: null,
          updated_at: new Date().toISOString(),
        })
        .in("status", ["scraping", "scraped", "creating", "error"]);

      await supabase
        .from("product_import_job")
        .update({
          state: "idle",
          processed: 0,
          created_count: 0,
          error_count: 0,
          total: total ?? 0,
          message: "Zurückgesetzt — bereit zum Neustart",
          started_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", "singleton");

      return new Response(JSON.stringify({ success: true, state: "idle" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: false, error: "unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
