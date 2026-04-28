// Look Admin actions: publish / reject / delete / update / regenerate-hero / list
// One function with action-based dispatch.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SHOPIFY_API_VERSION = "2025-07";
const SHOPIFY_DOMAIN = "style-compass-6nrqi.myshopify.com";
const SHOPIFY_TOKEN = "82d196dbe5af439ca85dd9e1689f9c50";
const SHOPIFY_URL = `https://${SHOPIFY_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`;

const PRODUCTS_BY_HANDLES = `
  query GetByHandles($handles: [String!]!) {
    nodes: products(first: 20, query: "") { edges { node { handle } } }
  }
`;

const PRODUCT_HANDLE_QUERY = `
  query Q($handle: String!) {
    product(handle: $handle) { handle title images(first: 1) { edges { node { url } } } }
  }
`;

const WELT_SETTINGS: Record<string, string> = {
  business: "modern office in soft daylight, glass and warm wood, professional but relaxed",
  hemden: "stylish urban café, morning light, casual smart vibe",
  jacken: "cobblestone European street in autumn, golden hour",
  sommer: "Mediterranean terrace, bright afternoon sunlight",
  freizeit: "minimalist urban park, natural daylight, weekend mood",
  abend: "moody evening bar interior, warm low light, refined ambience",
  "fruehling-sommer": "sun-drenched coastal promenade, warm spring breeze",
  "herbst-winter": "European old town in cold morning light, layered warmth",
};

async function shopifyProduct(handle: string): Promise<{ url: string | null }> {
  try {
    const res = await fetch(SHOPIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": SHOPIFY_TOKEN },
      body: JSON.stringify({ query: PRODUCT_HANDLE_QUERY, variables: { handle } }),
    });
    const data = await res.json();
    return { url: data?.data?.product?.images?.edges?.[0]?.node?.url ?? null };
  } catch { return { url: null }; }
}

async function generateHero(
  apiKey: string, urls: string[], welt: string, title: string, subtitle: string,
): Promise<string | null> {
  const setting = WELT_SETTINGS[welt] ?? WELT_SETTINGS.freizeit;
  const promptText = `High-end editorial menswear lifestyle photograph for "${title}" — ${subtitle}.

ABSOLUTE PRIORITY — GARMENT FIDELITY:
Reproduce every visible garment from the reference images PIXEL-FAITHFULLY.
- Same colour (hue, saturation, brightness) — if a piece is light blue linen, it MUST appear light blue linen, never white, never cotton, never navy.
- Same collar style, cuff style, button placement, pocket style.
- Same fabric texture (linen vs poplin vs denim vs wool — visibly distinct).
- Same pattern (solid, striped, checked) — copy stripes/checks exactly.
- Same cut and length (slim vs regular, short vs long sleeves, chinos vs jeans vs dress trousers).
Treat the reference images as a HARD CONSTRAINT. The model and setting are decoration; the wardrobe is the hero.

Subject: ONE confident, well-groomed European man, age 35-45, natural realistic skin and hair, candid editorial expression — NOT an AI-perfect render.
Setting: ${setting}.
Composition: full-body or 3/4 view, cinematic depth of field, natural directional light, GQ / Monocle quality.
Strictly no text, no logos overlay, no watermark, no collage, no duplicate persons, no extra garments not present in references.`;
  const content: Array<Record<string, unknown>> = [{ type: "text", text: promptText }];
  for (const u of urls.slice(0, 4)) content.push({ type: "image_url", image_url: { url: u } });
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-image-preview",
      messages: [{ role: "user", content }],
      modalities: ["image", "text"],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const dataUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  return typeof dataUrl === "string" && dataUrl.startsWith("data:image/") ? dataUrl : null;
}

async function uploadDataUrl(
  supabase: ReturnType<typeof createClient>, dataUrl: string, path: string,
): Promise<string | null> {
  const m = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!m) return null;
  const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  const ext = m[1].split("/")[1] ?? "png";
  const fullPath = `${path}.${ext}`;
  const { error } = await supabase.storage.from("look-heroes").upload(fullPath, bytes, {
    contentType: m[1], upsert: true,
  });
  if (error) return null;
  return supabase.storage.from("look-heroes").getPublicUrl(fullPath).data.publicUrl;
}

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action } = body as { action: string };
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    if (action === "list") {
      const { status } = body as { status?: string };
      const q = supabase.from("curated_looks").select("*").order("created_at", { ascending: false });
      const { data, error } = status ? await q.eq("status", status) : await q;
      if (error) throw error;
      return new Response(JSON.stringify({ looks: data ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "publish") {
      const { id } = body as { id: string };
      const { error } = await supabase.from("curated_looks")
        .update({ status: "published", published_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "unpublish") {
      const { id } = body as { id: string };
      const { error } = await supabase.from("curated_looks")
        .update({ status: "draft", published_at: null }).eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "reject" || action === "delete") {
      const { id } = body as { id: string };
      const { error } = await supabase.from("curated_looks").delete().eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update") {
      const { id, patch } = body as { id: string; patch: Record<string, unknown> };
      const allowed = ["title", "subtitle", "welt", "anlaesse", "story", "highlights", "product_handles"];
      const filtered: Record<string, unknown> = {};
      for (const k of allowed) if (k in patch) filtered[k] = patch[k];
      const { error } = await supabase.from("curated_looks").update(filtered).eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "regenerate_hero") {
      const { id } = body as { id: string };
      const { data: look, error } = await supabase.from("curated_looks").select("*").eq("id", id).single();
      if (error) throw error;
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
      const urls: string[] = [];
      for (const h of look.product_handles) {
        const p = await shopifyProduct(h);
        if (p.url) urls.push(p.url);
      }
      const dataUrl = await generateHero(LOVABLE_API_KEY, urls, look.welt ?? "freizeit", look.title, look.subtitle ?? "");
      if (!dataUrl) {
        return new Response(JSON.stringify({ error: "Hero generation failed" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const heroUrl = await uploadDataUrl(supabase, dataUrl, `looks/${look.slug}-${Date.now()}`);
      const { error: upErr } = await supabase.from("curated_looks")
        .update({ hero_image_url: heroUrl }).eq("id", id);
      if (upErr) throw upErr;
      return new Response(JSON.stringify({ ok: true, hero_image_url: heroUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create_manual") {
      const { look } = body as { look: { title: string; subtitle?: string; welt?: string; anlaesse?: string[]; product_handles: string[]; story?: string; highlights?: string[] } };
      if (!look?.title || !Array.isArray(look.product_handles) || look.product_handles.length < 2) {
        return new Response(JSON.stringify({ error: "title and at least 2 product_handles required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let slug = slugify(look.title);
      const { data: existSlug } = await supabase.from("curated_looks").select("slug").eq("slug", slug).maybeSingle();
      if (existSlug) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
      const { data: inserted, error } = await supabase.from("curated_looks").insert({
        slug,
        title: look.title,
        subtitle: look.subtitle ?? null,
        welt: look.welt ?? null,
        anlaesse: look.anlaesse ?? [],
        product_handles: look.product_handles,
        anchor_handle: look.product_handles[0],
        story: look.story ?? null,
        highlights: look.highlights ?? [],
        status: "draft",
      }).select("id, slug").single();
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, look: inserted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("look-admin error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
