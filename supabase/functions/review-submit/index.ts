// Edge Function: review-submit
// Validiert eine Bewertung, prüft via Shopify Admin API ob der User das Produkt
// tatsächlich gekauft hat (Verified Purchase) und speichert das Ergebnis.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ReviewPayload {
  product_handle: string;
  rating: number;
  title: string;
  body: string;
  size_purchased?: string | null;
  size_fit?: "small" | "true" | "large" | null;
  would_recommend?: boolean;
  reviewer_name: string;
}

function badRequest(msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SHOPIFY_DOMAIN = Deno.env.get("SHOPIFY_STORE_PERMANENT_DOMAIN") ?? "";
    const SHOPIFY_ADMIN_TOKEN = Deno.env.get("SHOPIFY_ADMIN_API_TOKEN") ?? "";

    // Auth: User aus JWT lesen
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Sitzung ungültig" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    // Body lesen + validieren
    const body = (await req.json()) as ReviewPayload;
    if (!body.product_handle || typeof body.product_handle !== "string") {
      return badRequest("product_handle fehlt");
    }
    if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) {
      return badRequest("rating muss zwischen 1 und 5 liegen");
    }
    if (!body.title || body.title.length < 3 || body.title.length > 80) {
      return badRequest("Titel muss 3–80 Zeichen lang sein");
    }
    if (!body.body || body.body.length < 30 || body.body.length > 1000) {
      return badRequest("Bewertungstext muss 30–1000 Zeichen lang sein");
    }
    if (!body.reviewer_name || body.reviewer_name.length < 2 || body.reviewer_name.length > 60) {
      return badRequest("Name muss 2–60 Zeichen lang sein");
    }
    if (body.size_fit && !["small", "true", "large"].includes(body.size_fit)) {
      return badRequest("Ungültige Passform-Angabe");
    }

    // Sanitize: Plain Text only (keine Tags)
    const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "").trim();
    const cleanTitle = stripHtml(body.title);
    const cleanBody = stripHtml(body.body);
    const cleanName = stripHtml(body.reviewer_name);

    // Verified Purchase via Shopify Admin API prüfen
    let verified = false;
    let orderId: string | null = null;
    const userEmail = user.email;

    if (userEmail && SHOPIFY_DOMAIN && SHOPIFY_ADMIN_TOKEN) {
      try {
        const url = `https://${SHOPIFY_DOMAIN}/admin/api/2025-07/orders.json?email=${encodeURIComponent(userEmail)}&status=any&limit=50&fields=id,line_items`;
        const shopifyRes = await fetch(url, {
          headers: {
            "X-Shopify-Access-Token": SHOPIFY_ADMIN_TOKEN,
            "Content-Type": "application/json",
          },
        });
        if (shopifyRes.ok) {
          const json = await shopifyRes.json();
          const orders = json.orders ?? [];
          outer: for (const order of orders) {
            for (const li of order.line_items ?? []) {
              // line_items haben ein product_handle wenn es das Produkt noch gibt;
              // Fallback: title-Match auf product_handle (selten nötig)
              const handle = (li.product_handle ?? li.handle ?? "")
                .toString()
                .toLowerCase();
              if (handle === body.product_handle.toLowerCase()) {
                verified = true;
                orderId = String(order.id);
                break outer;
              }
            }
          }
        } else {
          console.warn("[review-submit] Shopify orders fetch failed:", shopifyRes.status);
        }
      } catch (e) {
        console.error("[review-submit] Shopify error", e);
      }
    }

    if (!verified) {
      return new Response(
        JSON.stringify({
          error:
            "Wir konnten keinen passenden Kauf für dieses Produkt finden. Bewertungen können nur von verifizierten Käufer:innen abgegeben werden.",
          code: "NOT_VERIFIED",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Insert mit Service Role (umgeht RLS, setzt Verified-Felder)
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: inserted, error: insErr } = await adminClient
      .from("product_reviews")
      .upsert(
        {
          user_id: user.id,
          product_handle: body.product_handle,
          reviewer_name: cleanName,
          rating: body.rating,
          title: cleanTitle,
          body: cleanBody,
          size_purchased: body.size_purchased ?? null,
          size_fit: body.size_fit ?? null,
          would_recommend: body.would_recommend ?? true,
          verified_purchase: true,
          shopify_order_id: orderId,
          status: "published",
        },
        { onConflict: "user_id,product_handle" },
      )
      .select()
      .single();

    if (insErr) {
      console.error("[review-submit] insert error", insErr);
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ review: inserted }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[review-submit] unhandled", e);
    return new Response(JSON.stringify({ error: "Serverfehler" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
