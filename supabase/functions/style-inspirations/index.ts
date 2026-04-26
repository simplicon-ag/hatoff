// Edge Function: style-inspirations
// Generates 3 outfit-context images for a given product using Nano Banana (image-to-image).
// Caches results in style_inspiration_cache + storage bucket "style-inspirations".

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Slot = "office" | "weekend" | "evening";

const SLOT_PROMPTS: Record<Slot, string> = {
  office:
    "Editorial fashion photo of a confident man wearing the EXACT same shirt shown in the reference image (keep color, pattern, fabric and collar identical). Style it for a modern office: paired with a tailored blazer and refined trousers. Clean studio or minimal architectural background, soft natural light, full upper body composition, magazine quality, 4:5 portrait.",
  weekend:
    "Editorial lifestyle photo of a relaxed man wearing the EXACT same shirt shown in the reference image (keep color, pattern, fabric and collar identical). Casual weekend styling: open over a t-shirt or with chinos and clean sneakers, outdoor café or city street, golden hour daylight, full upper body composition, magazine quality, 4:5 portrait.",
  evening:
    "Editorial evening photo of an elegant man wearing the EXACT same shirt shown in the reference image (keep color, pattern, fabric and collar identical). Dressed up for dinner: paired with dark trousers and a refined jacket, moody restaurant or bar interior, warm cinematic lighting, full upper body composition, magazine quality, 4:5 portrait.",
};

const SLOTS: Slot[] = ["office", "weekend", "evening"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productHandle, sourceImageUrl } = await req.json();

    if (!productHandle || typeof productHandle !== "string") {
      return json({ error: "productHandle required" }, 400);
    }
    if (!sourceImageUrl || typeof sourceImageUrl !== "string") {
      return json({ error: "sourceImageUrl required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Check cache for all 3 slots
    const { data: cached } = await supabase
      .from("style_inspiration_cache")
      .select("slot,image_url")
      .eq("product_handle", productHandle);

    const cacheMap = new Map<string, string>();
    (cached ?? []).forEach((row: any) => cacheMap.set(row.slot, row.image_url));

    // If all 3 cached → return immediately
    if (SLOTS.every((s) => cacheMap.has(s))) {
      return json({
        images: SLOTS.map((s) => ({ slot: s, url: cacheMap.get(s)! })),
        cached: true,
      });
    }

    if (!lovableKey) {
      return json({ error: "LOVABLE_API_KEY not configured" }, 500);
    }

    // 2. Generate missing slots in parallel
    const missing = SLOTS.filter((s) => !cacheMap.has(s));
    console.log(`Generating ${missing.length} slots for ${productHandle}`);

    const results = await Promise.all(
      missing.map((slot) =>
        generateAndStore({
          slot,
          productHandle,
          sourceImageUrl,
          supabase,
          lovableKey,
        }).catch((err) => {
          console.error(`Slot ${slot} failed:`, err);
          return null;
        }),
      ),
    );

    results.forEach((r, i) => {
      if (r) cacheMap.set(missing[i], r);
    });

    return json({
      images: SLOTS.filter((s) => cacheMap.has(s)).map((s) => ({
        slot: s,
        url: cacheMap.get(s)!,
      })),
      cached: false,
    });
  } catch (err) {
    console.error("style-inspirations error:", err);
    return json(
      { error: err instanceof Error ? err.message : "unknown" },
      500,
    );
  }
});

async function generateAndStore(opts: {
  slot: Slot;
  productHandle: string;
  sourceImageUrl: string;
  supabase: ReturnType<typeof createClient>;
  lovableKey: string;
}): Promise<string | null> {
  const { slot, productHandle, sourceImageUrl, supabase, lovableKey } = opts;

  // Call Lovable AI Gateway with image-to-image
  const aiRes = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: SLOT_PROMPTS[slot] },
              {
                type: "image_url",
                image_url: { url: sourceImageUrl },
              },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    },
  );

  if (!aiRes.ok) {
    const text = await aiRes.text();
    throw new Error(`AI gateway ${aiRes.status}: ${text.slice(0, 300)}`);
  }

  const data = await aiRes.json();
  const dataUrl: string | undefined =
    data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

  if (!dataUrl || !dataUrl.startsWith("data:image/")) {
    throw new Error("No image returned from AI gateway");
  }

  // Decode base64 → bytes
  const [meta, b64] = dataUrl.split(",");
  const mime = meta.match(/data:(image\/\w+)/)?.[1] ?? "image/png";
  const ext = mime.split("/")[1] ?? "png";
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  const path = `${productHandle}/${slot}.${ext}`;

  // Upload to storage
  const { error: upErr } = await supabase.storage
    .from("style-inspirations")
    .upload(path, bytes, { contentType: mime, upsert: true });

  if (upErr) throw new Error(`Storage upload: ${upErr.message}`);

  const { data: pub } = supabase.storage
    .from("style-inspirations")
    .getPublicUrl(path);

  const publicUrl = pub.publicUrl;

  // Persist in cache table
  const { error: dbErr } = await supabase
    .from("style_inspiration_cache")
    .upsert(
      {
        product_handle: productHandle,
        slot,
        image_url: publicUrl,
        source_image_url: sourceImageUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "product_handle,slot" },
    );

  if (dbErr) throw new Error(`DB upsert: ${dbErr.message}`);

  return publicUrl;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
