// Size Guide edge function — fetches and caches brand size tables via Firecrawl
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SOURCES: Record<string, string> = {
  venti: "https://www.venti.com/de/de/groessentabellen",
  "casa-moda": "https://www.casamoda.com/de/de/groessentabellen",
};

const CACHE_TTL_HOURS = 24 * 7; // refetch weekly

type SizeRow = { label: string; values: (string | null)[] };
type SizeTable = {
  fit: string;
  category: string; // e.g. "Hemden", "Anzughosen", "Sakkos"
  sizeLabels: string[]; // column headers (sizes)
  rows: SizeRow[]; // measurement rows
};

interface ParsedGuide {
  brand: string;
  source_url: string;
  fetched_at: string;
  tables: SizeTable[];
}

/**
 * Parse the markdown blob into structured tables.
 * The page layout is: ## <Category>\n### <Fit>\n| Größe | ... |\n| --- | ... |\n| ...rows |
 */
function parseGuide(markdown: string, brand: string): SizeTable[] {
  const tables: SizeTable[] = [];
  const lines = markdown.split("\n");

  // CASA MODA's größentabellen page is shirts-only (says so on the page).
  // Their only H2 is "_größentabellen" which we'd otherwise discard.
  const defaultCategory = brand === "casa-moda" ? "Hemden" : "Allgemein";
  let currentCategory = defaultCategory;
  let currentFit = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // ## Category — capture words like "Hemden", "Anzughosen", "Sakkos", "Anzugwesten"
    const h2 = line.match(/^##\s+([^#].+)$/);
    if (h2) {
      const raw = h2[1]
        .replace(/\\/g, "")           // strip escape backslashes from markdown
        .replace(/größentabellen/gi, "")
        .replace(/[_\-\s]+/g, " ")    // collapse underscores/dashes/whitespace
        .trim();
      // If nothing meaningful is left (e.g. CASA MODA's "_größentabellen"), use default
      currentCategory = raw.length > 1 ? raw : defaultCategory;
      continue;
    }

    // ### Fit — capture "Body Fit", "Modern Fit", "Comfort Fit", "Casual Fit", "Normale Größen", etc.
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      currentFit = h3[1].trim();
      continue;
    }

    // Header table row starts with "| Größe"
    if (/^\|\s*Größe\s*\|/i.test(line)) {
      // header line
      const headerCells = line
        .split("|")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
      // First cell is "Größe", rest are size labels
      const sizeLabels = headerCells.slice(1).map((c) =>
        c.replace(/<br\s*\/?>/gi, " · ").trim(),
      );

      // Skip the separator line "| --- | --- |"
      let j = i + 1;
      if (j < lines.length && /^\|\s*-+/.test(lines[j].trim())) j++;

      const rows: SizeRow[] = [];
      while (j < lines.length && /^\|/.test(lines[j].trim())) {
        const cells = lines[j]
          .split("|")
          .map((c) => c.trim())
          .filter((c, idx, arr) => !(idx === 0 && c === "") && !(idx === arr.length - 1 && c === ""));
        const label = cells[0];
        const values = cells.slice(1).map((v) => (v === "" ? null : v));
        if (label && values.length > 0) rows.push({ label, values });
        j++;
      }

      if (rows.length > 0) {
        tables.push({
          fit: currentFit || "Standard",
          category: currentCategory,
          sizeLabels,
          rows,
        });
      }
      i = j - 1;
    }
  }

  return tables;
}

async function fetchWithFirecrawl(url: string): Promise<string> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY not configured");

  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(`Firecrawl error [${res.status}]: ${JSON.stringify(data).slice(0, 300)}`);
  }
  const md = data?.data?.markdown ?? data?.markdown;
  if (!md) throw new Error("No markdown returned from Firecrawl");
  return md as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const brandParam = url.searchParams.get("brand");
    const force = url.searchParams.get("force") === "1";

    const brands = brandParam
      ? [brandParam.toLowerCase()]
      : Object.keys(SOURCES);

    // Validate
    for (const b of brands) {
      if (!SOURCES[b]) {
        return new Response(
          JSON.stringify({ error: `Unknown brand: ${b}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const guides: ParsedGuide[] = [];
    for (const brand of brands) {
      const sourceUrl = SOURCES[brand];

      // Try cache
      let content: string | null = null;
      let fetchedAt: string | null = null;
      if (!force) {
        const { data: cached } = await supabase
          .from("size_guide_cache")
          .select("content, fetched_at")
          .eq("brand", brand)
          .maybeSingle();

        if (cached) {
          const ageHrs =
            (Date.now() - new Date(cached.fetched_at).getTime()) / 3_600_000;
          if (ageHrs < CACHE_TTL_HOURS) {
            content = cached.content;
            fetchedAt = cached.fetched_at;
          }
        }
      }

      if (!content) {
        content = await fetchWithFirecrawl(sourceUrl);
        fetchedAt = new Date().toISOString();
        await supabase
          .from("size_guide_cache")
          .upsert(
            { brand, source_url: sourceUrl, content, fetched_at: fetchedAt },
            { onConflict: "brand" },
          );
      }

      const tables = parseGuide(content, brand);
      guides.push({
        brand,
        source_url: sourceUrl,
        fetched_at: fetchedAt!,
        tables,
      });
    }

    return new Response(JSON.stringify({ guides }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("size-guide error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
