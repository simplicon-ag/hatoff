// One-shot cleanup: deletes all Shopify products that were created by the
// product-import worker (identified via product_import_log.shopify_product_id).
// Uses the same rate-limited shopifyFetch logic as the worker.
//
// Body: { confirm: true }  — required to actually delete.
// Returns: { deleted, failed, total }
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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    if (body.confirm !== true) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Pass { confirm: true } to actually delete products.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const adminToken = resolveAdminToken();
    if (!adminToken) {
      return new Response(
        JSON.stringify({ success: false, error: "no admin token" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Pull all log rows that have a Shopify product ID
    const { data: rows, error } = await supabase
      .from("product_import_log")
      .select("id, shopify_product_id, handle")
      .not("shopify_product_id", "is", null);

    if (error) throw error;

    let deleted = 0;
    let failed = 0;
    const failures: string[] = [];

    // Dedupe — multiple log rows can point to the same Shopify product
    const ids = Array.from(
      new Set((rows ?? []).map((r) => r.shopify_product_id).filter(Boolean)),
    );
    const total = ids.length;

    for (const productId of ids) {
      try {
        const res = await shopifyFetch(
          `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_ADMIN_VERSION}/products/${productId}.json`,
          { method: "DELETE", adminToken },
        );
        if (res.ok || res.status === 404) {
          deleted++;
        } else {
          failed++;
          const txt = await res.text().catch(() => "");
          failures.push(`${productId}: ${res.status} ${txt.slice(0, 100)}`);
        }
      } catch (err) {
        failed++;
        failures.push(`${productId}: ${(err as Error).message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total,
        deleted,
        failed,
        failures: failures.slice(0, 20),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
