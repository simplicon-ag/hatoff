// Täglicher Orchestrator: refresht alle Preise im product_price_cache,
// die älter als 24h sind und NICHT als 'mismatch' markiert wurden.
// Wird per pg_cron einmal täglich aufgerufen.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 10;
const PAUSE_MS = 1500;
const REFRESH_AFTER_HOURS = 24;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const cutoff = new Date(
      Date.now() - REFRESH_AFTER_HOURS * 3_600_000,
    ).toISOString();

    // Stale, aber nicht mismatched
    const { data: rows, error } = await supabase
      .from("product_price_cache")
      .select("handle, fetched_at, status")
      .lt("fetched_at", cutoff)
      .neq("status", "mismatch")
      .limit(2000);

    if (error) throw error;

    const handles = (rows ?? []).map((r) => r.handle);
    console.log(`[refresh] ${handles.length} handles to refresh`);

    let okCount = 0;
    let failCount = 0;

    for (let i = 0; i < handles.length; i += BATCH_SIZE) {
      const batch = handles.slice(i, i + BATCH_SIZE);
      try {
        const res = await fetch(
          `${supabaseUrl}/functions/v1/product-price?force=1`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ handles: batch, force: true }),
          },
        );
        if (res.ok) {
          okCount += batch.length;
        } else {
          failCount += batch.length;
          console.error(
            `[refresh] batch ${i / BATCH_SIZE} failed: ${res.status}`,
          );
        }
      } catch (e) {
        failCount += batch.length;
        console.error(`[refresh] batch ${i / BATCH_SIZE} error:`, e);
      }
      if (i + BATCH_SIZE < handles.length) {
        await new Promise((r) => setTimeout(r, PAUSE_MS));
      }
    }

    const summary = {
      total: handles.length,
      refreshed: okCount,
      failed: failCount,
      ran_at: new Date().toISOString(),
    };
    console.log(`[refresh] done`, summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("product-price-refresh error:", err);
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
