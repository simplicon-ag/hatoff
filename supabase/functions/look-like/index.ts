// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Use service role as salt — never leaves the server.
const SALT = SERVICE_ROLE.slice(0, 32);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

// Best-effort in-memory rate limit
const lastHit = new Map<string, number>();
function rateLimited(ip: string) {
  const now = Date.now();
  const prev = lastHit.get(ip) ?? 0;
  if (now - prev < 800) return true;
  lastHit.set(ip, now);
  // simple cleanup
  if (lastHit.size > 5000) {
    for (const [k, v] of lastHit) if (now - v > 60_000) lastHit.delete(k);
  }
  return false;
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    "0.0.0.0"
  );
}

async function getUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const client = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data } = await client.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

async function getCount(slug: string): Promise<number> {
  const { data, error } = await admin.rpc("get_look_like_count", { _slug: slug });
  if (error) throw error;
  return Number(data ?? 0);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const slug = typeof body.slug === "string" ? body.slug.trim() : "";
    const action = body.action === "toggle" ? "toggle" : "status";

    if (!slug || slug.length > 200) {
      return new Response(JSON.stringify({ error: "invalid_slug" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip = getIp(req);
    const ip_hash = await sha256(`${ip}|${SALT}`);

    if (action === "status") {
      const [{ data: existing }, count] = await Promise.all([
        admin
          .from("look_likes")
          .select("id")
          .eq("look_slug", slug)
          .eq("ip_hash", ip_hash)
          .maybeSingle(),
        getCount(slug),
      ]);
      return new Response(
        JSON.stringify({ liked: !!existing, count }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // toggle
    if (rateLimited(ip)) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existing } = await admin
      .from("look_likes")
      .select("id")
      .eq("look_slug", slug)
      .eq("ip_hash", ip_hash)
      .maybeSingle();

    if (existing) {
      await admin.from("look_likes").delete().eq("id", existing.id);
      const count = await getCount(slug);
      return new Response(
        JSON.stringify({ liked: false, count }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userId = await getUserId(req);
    const { error: insertError } = await admin
      .from("look_likes")
      .insert({ look_slug: slug, ip_hash, user_id: userId });

    if (insertError && !/duplicate key/i.test(insertError.message)) {
      throw insertError;
    }

    const count = await getCount(slug);
    return new Response(
      JSON.stringify({ liked: true, count }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("look-like error", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message ?? "unknown" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
