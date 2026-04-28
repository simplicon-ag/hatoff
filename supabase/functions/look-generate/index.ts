// Look Generator
// Given an anchor product handle, asks Lovable AI to compose 0–2 NEW outfit
// sets that don't duplicate existing curated_looks for that anchor.
// For each proposed set, generates a lifestyle hero image via Nano Banana,
// uploads it to the look-heroes storage bucket, and inserts as draft.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SHOPIFY_API_VERSION = "2025-07";
const SHOPIFY_DOMAIN = "style-compass-6nrqi.myshopify.com";
const SHOPIFY_TOKEN = "82d196dbe5af439ca85dd9e1689f9c50";
const SHOPIFY_URL = `https://${SHOPIFY_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRODUCT_BY_HANDLE = `
  query GetProduct($handle: String!) {
    product(handle: $handle) {
      id title handle vendor productType tags description
      images(first: 1) { edges { node { url } } }
    }
  }
`;

const PRODUCTS_LIST = `
  query GetProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      edges {
        cursor
        node {
          id title handle vendor productType tags
          priceRange { minVariantPrice { amount currencyCode } }
          images(first: 1) { edges { node { url } } }
          options { name values }
          variants(first: 1) { edges { node { availableForSale } } }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

interface ShopifyNode {
  id: string;
  title: string;
  handle: string;
  vendor: string;
  productType: string;
  tags: string[];
  priceRange?: { minVariantPrice: { amount: string; currencyCode: string } };
  images?: { edges: Array<{ node: { url: string } }> };
  options?: Array<{ name: string; values: string[] }>;
  variants?: { edges: Array<{ node: { availableForSale: boolean } }> };
}

async function shopify<T = unknown>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(SHOPIFY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": SHOPIFY_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Shopify HTTP ${res.status}`);
  const data = await res.json();
  if (data.errors) throw new Error(`Shopify error: ${JSON.stringify(data.errors)}`);
  return data.data;
}

function categorize(p: { productType?: string; tags?: string[]; title?: string }): string {
  const hay = `${p.productType ?? ""} ${(p.tags ?? []).join(" ")} ${p.title ?? ""}`.toLowerCase();
  if (/(hemd|shirt(?!.*t-?shirt)|bluse)/.test(hay)) return "hemd";
  if (/polo/.test(hay)) return "polo";
  if (/(t-?shirt|tee)/.test(hay)) return "tshirt";
  if (/(pullover|pulli|sweater|strick|cardigan)/.test(hay)) return "pullover";
  if (/(sakko|blazer|anzug)/.test(hay)) return "sakko";
  if (/(jacke|mantel|parka|coat|weste|blouson)/.test(hay)) return "jacke";
  if (/(hose|chino|jeans|bermuda|short)/.test(hay)) return "hose";
  if (/(schuh|sneaker|loafer|boot|stiefel)/.test(hay)) return "schuhe";
  if (/(g[üu]rtel|belt|socke|sock|krawatte|fliege|tie|einstecktuch|m[üu]tze|cap|hut|schal|tuch)/.test(hay)) return "accessoire";
  return "sonstige";
}

function complementaryCats(anchor: string): string[] {
  switch (anchor) {
    case "hemd": return ["hose", "sakko", "jacke", "pullover", "schuhe"];
    case "pullover": return ["hose", "hemd", "jacke", "schuhe"];
    case "sakko": return ["hose", "hemd", "schuhe"];
    case "jacke": return ["hose", "hemd", "polo", "pullover", "schuhe"];
    case "hose": return ["hemd", "polo", "pullover", "sakko", "jacke", "schuhe"];
    default: return ["hemd", "hose", "sakko", "jacke", "schuhe"];
  }
}

/** Anchor categories that trigger look generation. Polos/T-Shirts/Shorts are companions only. */
const ANCHOR_CATS = new Set(["hemd", "hose", "jacke", "pullover", "sakko"]);

async function fetchAllProducts(maxPages = 10, pageSize = 250): Promise<ShopifyNode[]> {
  const all: ShopifyNode[] = [];
  let after: string | null = null;
  type ListResp = { products: { edges: Array<{ node: ShopifyNode }>; pageInfo: { hasNextPage: boolean; endCursor: string } } };
  for (let i = 0; i < maxPages; i++) {
    const data: ListResp = await shopify<ListResp>(PRODUCTS_LIST, { first: pageSize, after });
    all.push(...data.products.edges.map((e) => e.node));
    if (!data.products.pageInfo.hasNextPage) break;
    after = data.products.pageInfo.endCursor;
  }
  return all;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

const WELT_SETTINGS: Record<string, string> = {
  business: "modern office in soft daylight, glass and warm wood, professional but relaxed",
  hemden: "stylish urban café, morning light, casual smart vibe",
  jacken: "cobblestone European street in autumn, golden hour",
  sommer: "Mediterranean terrace, bright afternoon sunlight, light shadows",
  freizeit: "minimalist urban park, natural daylight, weekend mood",
  abend: "moody evening bar interior, warm low light, refined ambience",
  "fruehling-sommer": "sun-drenched coastal promenade, warm spring breeze, light linen feel",
  "herbst-winter": "European old town in cold morning light, autumn leaves or first snow, layered warmth",
};

async function callImageModel(
  apiKey: string,
  promptText: string,
  productImageUrls: string[],
): Promise<string | null> {
  const content: Array<Record<string, unknown>> = [{ type: "text", text: promptText }];
  for (const url of productImageUrls.slice(0, 4)) {
    content.push({ type: "image_url", image_url: { url } });
  }
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-image-preview",
      messages: [{ role: "user", content }],
      modalities: ["image", "text"],
    }),
  });
  if (!res.ok) {
    console.warn("image generation failed", res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = await res.json();
  const dataUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) return null;
  return dataUrl;
}

async function generateHeroImage(
  apiKey: string,
  productImageUrls: string[],
  welt: string,
  lookTitle: string,
  lookSubtitle: string,
): Promise<string | null> {
  const setting = WELT_SETTINGS[welt] ?? WELT_SETTINGS.freizeit;
  const promptText = `High-end editorial menswear lifestyle photograph for "${lookTitle}" — ${lookSubtitle}.
Subject: ONE confident, well-groomed European man, age 35-45, natural and approachable expression, realistic skin and hair, photorealistic — NOT a model pose, NOT AI-perfect.
Wardrobe: he wears EXACTLY the garments from the reference images — same colours, same cut, same materials, same patterns. Do not invent or alter pieces.
Setting: ${setting}.
Composition: full-body or 3/4 view, cinematic depth of field, natural directional light, GQ / Monocle magazine quality, candid editorial feel.
Strictly no text, no logos overlay, no watermark, no collage, no duplicate persons.`;
  return callImageModel(apiKey, promptText, productImageUrls);
}

async function generateFlatlayImage(
  apiKey: string,
  productImageUrls: string[],
  lookTitle: string,
): Promise<string | null> {
  const promptText = `Premium menswear flatlay product composition for "${lookTitle}".
Arrange EXACTLY the garments from the reference images on a soft warm-neutral linen or stone background, top-down view.
Garments must match references precisely (colour, cut, material). Tasteful overlap, generous negative space, soft natural daylight, subtle shadows.
Editorial e-commerce styling — no person, no accessories that aren't in the references, no text, no logos overlay, no watermark.`;
  return callImageModel(apiKey, promptText, productImageUrls);
}

async function uploadDataUrl(
  supabase: ReturnType<typeof createClient>,
  dataUrl: string,
  path: string,
): Promise<string | null> {
  const m = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!m) return null;
  const contentType = m[1];
  const b64 = m[2];
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const ext = contentType.split("/")[1] ?? "png";
  const fullPath = `${path}.${ext}`;
  const { error } = await supabase.storage.from("look-heroes").upload(fullPath, bytes, {
    contentType,
    upsert: true,
  });
  if (error) {
    console.warn("upload failed", error.message);
    return null;
  }
  const { data } = supabase.storage.from("look-heroes").getPublicUrl(fullPath);
  return data.publicUrl;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { productHandle, force, maxExisting, mode } = await req.json();
    if (!productHandle || typeof productHandle !== "string") {
      return new Response(JSON.stringify({ error: "productHandle required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // mode: "diverse" → propose exactly 4 looks across explicit axes (anlass A, anlass B, season, color contrast)
    const isDiverse = mode === "diverse";
    // Default: skip when 2+ looks exist (4+ for diverse). Caller may override with maxExisting.
    const defaultLimit = isDiverse ? 4 : 2;
    const limit = typeof maxExisting === "number" && maxExisting >= 0 ? maxExisting : defaultLimit;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Fetch anchor product
    const anchorData = await shopify<{ product: ShopifyNode | null }>(PRODUCT_BY_HANDLE, {
      handle: productHandle,
    });
    if (!anchorData.product) {
      return new Response(JSON.stringify({ error: "Product not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const anchor = anchorData.product;
    const anchorCat = categorize(anchor);

    // Note: anchor-category filter removed — every product can seed a look.

    // 2. Existing looks containing this anchor (smart-dedupe)
    const { data: existingLooks } = await supabase
      .from("curated_looks")
      .select("slug, title, product_handles, status")
      .contains("product_handles", [anchor.handle]);

    const existingForAnchor = existingLooks ?? [];
    if (!force && existingForAnchor.length >= limit) {
      return new Response(
        JSON.stringify({ skipped: true, reason: `already has ${limit}+ looks`, created: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Catalog
    const all = await fetchAllProducts();
    const wantedCats = complementaryCats(anchorCat);
    const candidates = all
      .filter((p) => p.handle !== anchor.handle)
      .filter((p) => p.variants?.edges?.[0]?.node?.availableForSale !== false)
      .map((p) => ({ ...p, cat: categorize(p) }))
      .filter((p) => wantedCats.includes(p.cat));

    const byCat: Record<string, typeof candidates> = {};
    for (const p of candidates) (byCat[p.cat] ??= []).push(p);
    const PER_CAT = 20;
    const compactCatalog: typeof candidates = [];
    for (const cat of wantedCats) compactCatalog.push(...(byCat[cat] ?? []).slice(0, PER_CAT));

    if (compactCatalog.length < 1) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "no companion products available", created: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4. AI prompt: propose 0-2 NEW looks
    const catalogForPrompt = compactCatalog.map((p) => ({
      handle: p.handle,
      title: p.title,
      vendor: p.vendor,
      category: p.cat,
      colors: (p.options ?? []).find((o) => /farbe|color/i.test(o.name))?.values ?? [],
    }));

    const anchorForPrompt = {
      handle: anchor.handle,
      title: anchor.title,
      vendor: anchor.vendor,
      productType: anchor.productType,
      category: anchorCat,
      tags: (anchor.tags ?? []).slice(0, 8),
    };

    const existingForPrompt = existingForAnchor.map((l) => ({
      title: l.title,
      handles: l.product_handles,
    }));

    const baseRules = `Du bist Senior-Stylist der HATOFF Boutique (Schweiz, gehobenes Herrenmodesegment).
Du erhältst ein Anker-Produkt, einen Katalog möglicher Begleitstücke und eine Liste bereits existierender Looks zu diesem Anker.

Pro Look (2-4 Stücke inkl. Anker):
- slug: kurzer URL-Slug (kleinbuchstaben, bindestriche)
- title: 2-4 Wörter, redaktionell, nicht werblich (z.B. "Smart Casual am Café")
- subtitle: ein knapper, atmosphärischer Satz
- welt: EINE von [business, hemden, jacken, sommer, freizeit, abend, fruehling-sommer, herbst-winter]
- anlaesse: 1-3 Tags aus [buero, alltag, ausgang, reisen, sommer, abend, besondere-anlaesse, wochenende]
- product_handles: Anker-Handle ZUERST, dann 1-3 Begleiter (NUR Handles aus dem Katalog)
- story: 2-3 Sätze, wie ein Magazin-Editorial, persönlich
- highlights: genau 3 kurze Bullet-Argumente (max 60 Zeichen)

Regeln:
- KEINE Accessoires (Gürtel, Schal, Krawatte, Mütze, Cap, Socken)
- Vermeide Stücke aus derselben Hauptkategorie wie der Anker
- MARKEN-MIX ist ausdrücklich erwünscht: Kombiniere bevorzugt Stücke verschiedener Marken (z.B. Venti-Hemd + Casa-Moda-Hose + Pierre-Cardin-Sakko)`;

    const systemPrompt = isDiverse
      ? `${baseRules}

Du erstellst GENAU 4 Looks, die sich klar voneinander unterscheiden. Jeder Look folgt einer eigenen Achse:
1. **Look 1 — Formell/Business**: Anlass-Achse "buero" oder "besondere-anlaesse". Welt: business / abend / hemden. Klassische, dezente Farbpalette.
2. **Look 2 — Casual/Wochenende**: Anlass-Achse "wochenende" oder "alltag". Welt: freizeit / hemden. Entspannte, lässige Kombi.
3. **Look 3 — Saisonal**: Wähle entweder "fruehling-sommer" (helle, leichte Stoffe, Leinen, Pastell) ODER "herbst-winter" (Layering, Strick, erdige Töne, dunklere Palette) — abhängig davon, was zum Anker stilistisch besser passt. Welt entsprechend.
4. **Look 4 — Farbkontrast**: Mutigere, unerwartetere Farbkombination als Look 1-3 (z.B. Olive + Rost, Bordeaux + Camel, Senf + Navy). Welt frei wählbar, aber stilistisch raffiniert.

Die 4 Looks MÜSSEN sich in Anlass, Saison UND Farbpalette unterscheiden. Vermeide ähnliche Hero-Stimmungen.
Wenn der Katalog für eine Achse keine sinnvolle Kombi hergibt, wähle die nächstbeste Achse — aber liefere immer 4 Looks.`
      : `${baseRules}

Schlage 0 bis 2 NEUE Looks vor — nur dann, wenn die Kombinationen sich SIGNIFIKANT von den bereits existierenden unterscheiden (anderer Anlass, andere Saison, andere Stilrichtung). Lieber 0 als ein redundanter Look.
- Farbharmonie: klassische Kombinationen bevorzugen
- Wenn keine signifikant neuen Kombinationen möglich sind: leeres looks-Array zurückgeben`;

    const userPrompt = `ANKER-PRODUKT:
${JSON.stringify(anchorForPrompt, null, 2)}

KATALOG (nur diese Handles erlaubt):
${JSON.stringify(catalogForPrompt, null, 2)}

BEREITS EXISTIERENDE LOOKS MIT DIESEM ANKER:
${existingForAnchor.length > 0 ? JSON.stringify(existingForPrompt, null, 2) : "(keine)"}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "propose_looks",
              description: isDiverse ? "Liefert genau 4 diverse Look-Vorschläge." : "Liefert 0 bis 2 neue Look-Vorschläge.",
              parameters: {
                type: "object",
                properties: {
                  looks: {
                    type: "array",
                    minItems: isDiverse ? 4 : 0,
                    maxItems: isDiverse ? 4 : 2,
                    items: {
                      type: "object",
                      properties: {
                        slug: { type: "string" },
                        title: { type: "string" },
                        subtitle: { type: "string" },
                        welt: { type: "string", enum: ["business", "hemden", "jacken", "sommer", "freizeit", "abend", "fruehling-sommer", "herbst-winter"] },
                        anlaesse: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
                        product_handles: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
                        story: { type: "string" },
                        highlights: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 },
                      },
                      required: ["slug", "title", "subtitle", "welt", "anlaesse", "product_handles", "story", "highlights"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["looks"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "propose_looks" } },
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiRes.ok) {
      console.error("AI gateway error", aiRes.status, await aiRes.text());
      return new Response(JSON.stringify({ error: "AI gateway failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.warn("no tool call in AI response");
      return new Response(JSON.stringify({ created: 0, reason: "no proposal" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let parsed: { looks: Array<{ slug: string; title: string; subtitle: string; welt: string; anlaesse: string[]; product_handles: string[]; story: string; highlights: string[] }> };
    try { parsed = JSON.parse(toolCall.function.arguments); }
    catch { return new Response(JSON.stringify({ error: "Invalid AI output" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

    const allowed = new Set(compactCatalog.map((p) => p.handle));
    allowed.add(anchor.handle);
    const validProposals = (parsed.looks ?? []).filter((l) => {
      const allValid = l.product_handles.every((h) => allowed.has(h));
      const hasAnchor = l.product_handles.includes(anchor.handle);
      return allValid && hasAnchor && l.product_handles.length >= 2;
    });

    if (validProposals.length === 0) {
      return new Response(JSON.stringify({ created: 0, reason: "no valid proposals" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. For each proposal: generate hero, insert as draft
    const created: Array<{ slug: string; id: string }> = [];
    for (const proposal of validProposals) {
      // Ensure slug unique
      let slug = slugify(proposal.slug || proposal.title);
      const { data: existSlug } = await supabase
        .from("curated_looks").select("slug").eq("slug", slug).maybeSingle();
      if (existSlug) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

      // Avoid creating duplicate-handle-set looks
      const sortedKey = [...proposal.product_handles].sort().join("|");
      const dup = (existingForAnchor as Array<{ product_handles: string[] }>).find(
        (l) => [...l.product_handles].sort().join("|") === sortedKey,
      );
      if (dup) {
        console.log("skipping duplicate handle set");
        continue;
      }

      // Collect product images for hero generation
      const heroSourceUrls: string[] = [];
      const anchorImg = anchor.images?.edges?.[0]?.node.url;
      if (anchorImg) heroSourceUrls.push(anchorImg);
      for (const h of proposal.product_handles) {
        if (h === anchor.handle) continue;
        const p = compactCatalog.find((c) => c.handle === h);
        const url = p?.images?.edges?.[0]?.node.url;
        if (url) heroSourceUrls.push(url);
      }

      let heroUrl: string | null = null;
      try {
        const dataUrl = await generateHeroImage(LOVABLE_API_KEY, heroSourceUrls, proposal.welt, proposal.title, proposal.subtitle);
        if (dataUrl) {
          heroUrl = await uploadDataUrl(supabase, dataUrl, `looks/${slug}-${Date.now()}`);
        }
      } catch (e) {
        console.warn("hero generation error", e);
      }

      const { data: inserted, error: insertError } = await supabase
        .from("curated_looks")
        .insert({
          slug,
          title: proposal.title,
          subtitle: proposal.subtitle,
          welt: proposal.welt,
          anlaesse: proposal.anlaesse,
          product_handles: proposal.product_handles,
          anchor_handle: anchor.handle,
          story: proposal.story,
          highlights: proposal.highlights,
          hero_image_url: heroUrl,
          status: "draft",
        })
        .select("id, slug")
        .single();

      if (insertError) {
        console.warn("insert failed", insertError.message);
        continue;
      }
      if (inserted) created.push({ slug: inserted.slug, id: inserted.id });
    }

    return new Response(
      JSON.stringify({ created: created.length, looks: created }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("look-generate error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
