// Control endpoint for the product import job.
// Actions: start (with dry_run), stop, reset, purge.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_DOMAIN = "style-compass-6nrqi.myshopify.com";
const SHOPIFY_ADMIN_VERSION = "2025-07";
const SHOPIFY_MIN_GAP_MS = 650;
let lastShopifyCallAt = 0;

async function shopifyFetch(
  url: string,
  init: RequestInit & { adminToken: string },
  attempt = 1,
): Promise<Response> {
  const since = Date.now() - lastShopifyCallAt;
  if (since < SHOPIFY_MIN_GAP_MS) {
    await new Promise((r) => setTimeout(r, SHOPIFY_MIN_GAP_MS - since));
  }
  lastShopifyCallAt = Date.now();
  const { adminToken, headers, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: { ...(headers ?? {}), "X-Shopify-Access-Token": adminToken },
  });
  if (res.status === 429 && attempt <= 4) {
    const retryAfter = parseFloat(res.headers.get("Retry-After") ?? "2");
    const waitMs = Math.max(retryAfter * 1000, 2000 * attempt);
    await res.text().catch(() => "");
    await new Promise((r) => setTimeout(r, waitMs));
    return shopifyFetch(url, init, attempt + 1);
  }
  return res;
}

function resolveAdminToken(): string {
  const direct =
    Deno.env.get("SHOPIFY_ADMIN_API_TOKEN") ??
    Deno.env.get("SHOPIFY_ACCESS_TOKEN");
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
