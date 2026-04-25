// Diagnostic: probes which Shopify token works against Admin API.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_DOMAIN = "style-compass-6nrqi.myshopify.com";
const SHOPIFY_ADMIN_VERSION = "2025-07";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const candidates: { name: string; value: string | undefined }[] = [];
  for (const [k, v] of Object.entries(Deno.env.toObject())) {
    if (
      k.startsWith("SHOPIFY_") &&
      (k.includes("ONLINE_ACCESS") ||
        k.includes("ADMIN") ||
        k === "SHOPIFY_ACCESS_TOKEN")
    ) {
      candidates.push({ name: k, value: v });
    }
  }

  const results: any[] = [];
  for (const c of candidates) {
    if (!c.value) {
      results.push({ name: c.name, status: "missing" });
      continue;
    }
    // Try to extract token from JSON wrapper if present
    let token = c.value;
    let parsedFrom = "raw";
    if (c.value.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(c.value);
        token =
          parsed.access_token ??
          parsed.accessToken ??
          parsed.token ??
          c.value;
        parsedFrom = "json:" + Object.keys(parsed).join(",");
      } catch {
        parsedFrom = "json-parse-failed";
      }
    }
    try {
      const r = await fetch(
        `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_ADMIN_VERSION}/shop.json`,
        { headers: { "X-Shopify-Access-Token": token } },
      );
      results.push({
        name: c.name,
        parsedFrom,
        prefix: token.slice(0, 6),
        length: token.length,
        status: r.status,
      });
    } catch (e) {
      results.push({ name: c.name, error: String(e) });
    }
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
