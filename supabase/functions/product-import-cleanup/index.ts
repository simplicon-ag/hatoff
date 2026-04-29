// One-shot cleanup: deletes ALL Shopify products from the configured vendors
// (CASA MODA + VENTI) by paginating through the Admin GraphQL API.
//
// Body:
//   { confirm: true, vendors?: string[], max?: number }
//   - confirm: required to actually delete
//   - vendors: optional, defaults to ["CASA MODA", "VENTI"]
//   - max:     optional safety cap per invocation (default 200 — call repeatedly)
//
// Returns: { success, scanned, deleted, failed, remaining_estimate, failures }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_DOMAIN = "style-compass-6nrqi.myshopify.com";
const SHOPIFY_ADMIN_VERSION = "2025-07";
const SHOPIFY_MIN_GAP_MS = 600;
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
    headers: {
      ...(headers ?? {}),
      "X-Shopify-Access-Token": adminToken,
      "Content-Type": "application/json",
    },
  });

  if (res.status === 429 && attempt <= 5) {
    const retryAfter = parseFloat(res.headers.get("Retry-After") ?? "2");
    const waitMs = Math.max(retryAfter * 1000, 2000 * attempt);
    await res.text().catch(() => "");
    await new Promise((r) => setTimeout(r, waitMs));
    return shopifyFetch(url, init, attempt + 1);
  }
  return res;
}

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

async function gqlSearch(
  adminToken: string,
  query: string,
  cursor: string | null,
): Promise<{
  ids: string[];
  cursor: string | null;
  hasNext: boolean;
}> {
  const body = {
    query: `
      query ($q: String!, $cursor: String) {
        products(first: 50, query: $q, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          edges { node { id } }
        }
      }
    `,
    variables: { q: query, cursor },
  };
  const res = await shopifyFetch(
    `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_ADMIN_VERSION}/graphql.json`,
    { method: "POST", body: JSON.stringify(body), adminToken },
  );
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  const products = json.data?.products;
  return {
    ids: (products?.edges ?? []).map((e: { node: { id: string } }) =>
      e.node.id.replace("gid://shopify/Product/", "")
    ),
    cursor: products?.pageInfo?.endCursor ?? null,
    hasNext: products?.pageInfo?.hasNextPage ?? false,
  };
}

async function deleteProduct(
  adminToken: string,
  productId: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await shopifyFetch(
    `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_ADMIN_VERSION}/products/${productId}.json`,
    { method: "DELETE", adminToken },
  );
  if (res.ok || res.status === 404) {
    await res.text().catch(() => "");
    return { ok: true };
  }
  const txt = await res.text().catch(() => "");
  return { ok: false, error: `${res.status} ${txt.slice(0, 120)}` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    const vendors: string[] = Array.isArray(body.vendors) && body.vendors.length > 0
      ? body.vendors
      : ["CASA MODA", "VENTI"];
    const maxPerRun: number = typeof body.max === "number" ? body.max : 200;

    let scanned = 0;
    let deleted = 0;
    let failed = 0;
    const failures: string[] = [];
    let stoppedEarly = false;

    for (const vendor of vendors) {
      const query = `vendor:"${vendor}"`;
      let cursor: string | null = null;

      // Loop pages until exhausted or budget hit
      // We always re-query from the start (no cursor) after deletes,
      // because deleted products vanish from the result set.
      while (true) {
        const page = await gqlSearch(adminToken, query, cursor);
        scanned += page.ids.length;
        if (page.ids.length === 0) break;

        for (const id of page.ids) {
          if (deleted + failed >= maxPerRun) {
            stoppedEarly = true;
            break;
          }
          const result = await deleteProduct(adminToken, id);
          if (result.ok) deleted++;
          else {
            failed++;
            failures.push(`${id}: ${result.error}`);
          }
        }

        if (stoppedEarly) break;
        // After deleting, restart pagination from the beginning so we don't
        // skip products (cursor would point past now-deleted entries).
        cursor = null;

        // If page was full but nothing left, the next iteration's gqlSearch
        // will return 0 and we exit. If a page came back smaller than 50,
        // we're at the tail.
        if (!page.hasNext) {
          // Re-query once more to confirm empty (since we deleted)
          const confirm = await gqlSearch(adminToken, query, null);
          if (confirm.ids.length === 0) break;
        }
      }
      if (stoppedEarly) break;
    }

    // Estimate remaining across vendors
    let remaining = 0;
    for (const vendor of vendors) {
      const probe = await gqlSearch(adminToken, `vendor:"${vendor}"`, null);
      remaining += probe.ids.length + (probe.hasNext ? 50 : 0); // rough lower bound
    }

    return new Response(
      JSON.stringify({
        success: true,
        vendors,
        scanned,
        deleted,
        failed,
        stopped_early: stoppedEarly,
        remaining_estimate: remaining,
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
