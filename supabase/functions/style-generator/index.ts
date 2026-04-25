// AI Style Generator
// Given an anchor product handle + occasion, asks Lovable AI to compose
// a 2–4 piece outfit from the live Shopify catalog.

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
  description?: string;
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

/** Coarse category from productType + tags + title */
function categorize(p: { productType?: string; tags?: string[]; title?: string }): string {
  const hay = `${p.productType ?? ""} ${(p.tags ?? []).join(" ")} ${p.title ?? ""}`.toLowerCase();
  if (/(hemd|shirt(?!.*t-?shirt)|bluse)/.test(hay)) return "hemd";
  if (/polo/.test(hay)) return "polo";
  if (/(t-?shirt|tee)/.test(hay)) return "tshirt";
  if (/(pullover|pulli|sweater|strick|cardigan)/.test(hay)) return "pullover";
  if (/(sakko|blazer|anzug)/.test(hay)) return "sakko";
  if (/(jacke|mantel|parka|coat|weste)/.test(hay)) return "jacke";
  if (/(hose|chino|jeans|bermuda|short)/.test(hay)) return "hose";
  if (/(schuh|sneaker|loafer|boot|stiefel)/.test(hay)) return "schuhe";
  // Accessoires (Gürtel, Socken, Krawatten, Mützen, Schals, Tücher) explizit
  // ausschliessen — sie werden nicht in generierte Looks aufgenommen.
  if (/(g[üu]rtel|belt|socke|sock|krawatte|fliege|tie|einstecktuch|m[üu]tze|cap|hut|schal|tuch)/.test(hay)) return "accessoire";
  return "sonstige";
}

/** Which categories complement an anchor category for a complete outfit.
 *  "accessoire" wird bewusst nirgends zurückgegeben. */
function complementaryCats(anchor: string): string[] {
  switch (anchor) {
    case "hemd":
    case "polo":
    case "tshirt":
      return ["hose", "sakko", "jacke", "schuhe"];
    case "pullover":
      return ["hose", "hemd", "jacke", "schuhe"];
    case "sakko":
      return ["hose", "hemd", "schuhe"];
    case "jacke":
      return ["hose", "hemd", "polo", "pullover", "schuhe"];
    case "hose":
      return ["hemd", "polo", "pullover", "sakko", "jacke", "schuhe"];
    case "schuhe":
      return ["hose", "hemd", "sakko", "jacke"];
    default:
      return ["hemd", "hose", "sakko", "jacke", "schuhe"];
  }
}

async function fetchAllProducts(maxPages = 10, pageSize = 250): Promise<ShopifyNode[]> {
  const all: ShopifyNode[] = [];
  let after: string | null = null;
  type ListResp = {
    products: {
      edges: Array<{ node: ShopifyNode }>;
      pageInfo: { hasNextPage: boolean; endCursor: string };
    };
  };
  for (let i = 0; i < maxPages; i++) {
    const data: ListResp = await shopify<ListResp>(PRODUCTS_LIST, { first: pageSize, after });
    all.push(...data.products.edges.map((e: { node: ShopifyNode }) => e.node));
    if (!data.products.pageInfo.hasNextPage) break;
    after = data.products.pageInfo.endCursor;
  }
  return all;
}

const OCCASION_GUIDANCE: Record<string, string> = {
  business:
    "Geschäftlich, klassisch, gepflegt: Hemd + Sakko/Anzug, dunkle Hose, Lederschuhe. Vermeide laute Farben, Shorts, Sportkleidung.",
  "smart-casual":
    "Smart Casual: gepflegt aber entspannt. Polo oder Hemd, Chino, Sakko optional, edle Sneaker oder Loafer.",
  casual:
    "Casual Alltag: T-Shirt, Polo oder Hemd, Chino oder Jeans, Sneaker, leichte Jacke optional.",
  freizeit:
    "Freizeit: bequem und sportlich. T-Shirt/Polo, kurze oder lange Sporthose/Chino/Jeans, Sneaker, Cap oder Cardigan.",
  abend:
    "Abend / Event: dunkle Töne, Hemd + Sakko, schmale Hose, Lederschuhe. Eleganter Touch.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { productHandle, occasion } = await req.json();
    if (!productHandle || typeof productHandle !== "string") {
      return new Response(JSON.stringify({ error: "productHandle required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const occ = String(occasion ?? "casual").toLowerCase();
    const guidance = OCCASION_GUIDANCE[occ] ?? OCCASION_GUIDANCE.casual;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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
    const wantedCats = complementaryCats(anchorCat);

    // 2. Fetch full catalog and pre-filter
    const all = await fetchAllProducts();
    const candidates = all
      .filter((p) => p.handle !== anchor.handle)
      .filter((p) => p.variants?.edges?.[0]?.node?.availableForSale !== false)
      .map((p) => ({ ...p, cat: categorize(p) }))
      .filter((p) => wantedCats.includes(p.cat));

    // Cap catalog to keep prompt manageable. Distribute across categories.
    const byCat: Record<string, typeof candidates> = {};
    for (const p of candidates) {
      (byCat[p.cat] ??= []).push(p);
    }
    const PER_CAT = 25;
    const compactCatalog: typeof candidates = [];
    for (const cat of wantedCats) {
      const items = (byCat[cat] ?? []).slice(0, PER_CAT);
      compactCatalog.push(...items);
    }

    // 3. Build AI prompt
    const catalogForPrompt = compactCatalog.map((p) => ({
      handle: p.handle,
      title: p.title,
      vendor: p.vendor,
      category: p.cat,
      tags: (p.tags ?? []).slice(0, 6),
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

    const systemPrompt = `Du bist ein erfahrener Schweizer Herrenstil-Berater für die HATOFF Boutique.
Du erhältst ein Anker-Produkt und einen Produktkatalog.
Wähle 2 bis 4 Stücke aus dem Katalog (NUR vorhandene Handles!), die mit dem Anker-Produkt zusammen einen kohärenten, modernen ${occ.toUpperCase()}-Look ergeben.

Anlass-Vorgabe: ${guidance}

Regeln:
- Wähle keine Stücke aus derselben Hauptkategorie wie der Anker (z.B. nicht zwei Hemden, nicht zwei Hosen).
- KEINE Accessoires (Gürtel, Krawatte, Schal, Mütze, Cap, Socken, Einstecktuch) — fokussiere auf Hauptkleidungsstücke.
- Achte auf Farbharmonie: vermeide harte Farbkonflikte; nutze klassische Kombinationen (Marine + Beige, Grau + Weiss, Khaki + Ecru, etc.).
- Pro gewähltem Stück: empfehle 1–3 Farben aus dem "colors"-Array des Katalog-Eintrags, die zur Look-Stimmung passen. Nur Farbnamen verwenden, die im "colors"-Feld vorkommen.
- Vermeide es, dass mehrere Stücke alle in EINER Marke sind, ausser es passt klar besser.
- Bevorzuge gut bewertete, vielseitige Klassiker.
- Formuliere die Begründung in Deutsch, 2 kurze Sätze, persönlich-freundlich, nicht werblich.`;

    const userPrompt = `ANKER-PRODUKT:
${JSON.stringify(anchorForPrompt, null, 2)}

KATALOG (nur diese Handles sind erlaubt):
${JSON.stringify(catalogForPrompt, null, 2)}

Stelle den ${occ.toUpperCase()}-Look zusammen.`;

    // 4. Call Lovable AI with tool calling for structured output
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
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
              name: "compose_outfit",
              description: "Liefert den zusammengestellten Look.",
              parameters: {
                type: "object",
                properties: {
                  rationale: {
                    type: "string",
                    description: "2 Sätze auf Deutsch, warum dieser Look stimmt.",
                  },
                    items: {
                      type: "array",
                      minItems: 2,
                      maxItems: 4,
                      items: {
                        type: "object",
                        properties: {
                          handle: { type: "string", description: "Produkt-Handle aus dem Katalog." },
                          role: {
                            type: "string",
                            description: "Rolle im Outfit, z.B. Hose, Sakko, Schuhe, Pullover. KEINE Accessoires (Gürtel, Schal, Krawatte, Mütze, Socken).",
                          },
                          recommended_colors: {
                            type: "array",
                            description: "1–3 Farben aus dem 'colors'-Array des Katalog-Eintrags, die zum Look passen. Leer lassen wenn das Produkt keine Farbvarianten hat.",
                            items: { type: "string" },
                            minItems: 0,
                            maxItems: 3,
                          },
                        },
                        required: ["handle", "role"],
                        additionalProperties: false,
                      },
                    },
                },
                required: ["rationale", "items"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "compose_outfit" } },
      }),
    });

    if (aiRes.status === 429) {
      return new Response(
        JSON.stringify({ error: "Zu viele Anfragen. Bitte einen Moment warten." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (aiRes.status === 402) {
      return new Response(
        JSON.stringify({ error: "AI-Guthaben aufgebraucht. Bitte im Workspace aufstocken." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, txt);
      return new Response(JSON.stringify({ error: "AI gateway failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error("No tool call in AI response", JSON.stringify(aiJson));
      return new Response(JSON.stringify({ error: "Kein gültiger Stilvorschlag erhalten." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const args = JSON.parse(toolCall.function.arguments) as {
      rationale: string;
      items: Array<{ handle: string; role: string }>;
    };

    // 5. Validate handles against catalog
    const allowed = new Set(compactCatalog.map((p) => p.handle));
    const validItems = args.items.filter((i) => allowed.has(i.handle));
    if (validItems.length < 2) {
      return new Response(
        JSON.stringify({ error: "AI lieferte keine gültige Auswahl. Bitte erneut versuchen." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 6. Return enriched product info for the UI to render directly
    const enriched = validItems.map((it) => {
      const p = compactCatalog.find((c) => c.handle === it.handle)!;
      return {
        handle: p.handle,
        title: p.title,
        vendor: p.vendor,
        role: it.role,
        image: p.images?.edges?.[0]?.node.url ?? null,
        priceAmount: p.priceRange?.minVariantPrice.amount ?? null,
        currency: p.priceRange?.minVariantPrice.currencyCode ?? "CHF",
      };
    });

    return new Response(
      JSON.stringify({
        rationale: args.rationale,
        anchor: { handle: anchor.handle, title: anchor.title },
        items: enriched,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("style-generator error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
