// Casa Moda Color Sweep
// Findet fehlende Farbvarianten zu bereits importierten Casa-Moda-Artikeln und reiht sie als sync_pending ein.
//
// Strategie:
// 1. Alle bereits synced Casa-Moda-Einträge aus product_import_log holen
// 2. Style-IDs (z.B. 14784) aus source_url extrahieren und Style-IDs sammeln
// 3. Pro Style-ID: 1 bekannte Color-URL scrapen, Geschwister-Color-Links rauspicken
// 4. Fehlende Color-URLs als sync_pending in product_import_log einfügen
//
// Trigger: POST { dry_run?: boolean = true, limit_styles?: number, only_style?: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function parseStyleColor(url: string): { styleId: string; colorId: string } | null {
  const m = url.match(/-(\d+)-(\d+)\/?$/);
  if (!m) return null;
  return { styleId: m[1], colorId: m[2] };
}

function buildColorUrl(slug: string, styleId: string, colorId: string): string {
  // Erhalte den Slug-Teil bis vor "-<styleId>-<colorId>", ersetze nichts.
  // Casa-Moda akzeptiert leicht abweichende Color-Slugs, der Pfad mit IDs ist entscheidend.
  return `https://www.casamoda.com/de/de/${slug}-${styleId}-${colorId}`;
}

function extractSlugBase(url: string): string | null {
  // z.B. "https://www.casamoda.com/de/de/polo-shirt-beige-14784-56" -> "polo-shirt-beige"
  const m = url.match(/casamoda\.com\/de\/de\/([a-z0-9\-]+)-\d+-\d+\/?$/i);
  if (!m) return null;
  // Entferne den letzten Farb-Slug-Teil, behalte nur den Produkttyp-Slug?
  // Einfacher: nimm den ganzen Slug-Teil.
  return m[1];
}

function extractSiblings(html: string, styleId: string): Array<{ colorId: string; url: string; colorName: string }> {
  // Color-Picker-Bereich: <a class="simple-link[ active]?" href="https://www.casamoda.com/de/de/<slug>-<styleId>-<colorId>" ... data-original-title="<Farbname> (...)">
  const re = new RegExp(
    `<a[^>]+class="simple-link[^"]*"[^>]*href="(https:\\/\\/www\\.casamoda\\.com\\/de\\/de\\/[a-z0-9\\-]+-${styleId}-(\\d+))"[^>]*(?:data-original-title="([^"]+)")?`,
    "gi",
  );
  const out: Array<{ colorId: string; url: string; colorName: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const colorName = (m[3] || "").replace(/\s*\(\d+\)\s*$/, "").trim();
    out.push({ url: m[1], colorId: m[2], colorName });
  }
  return out;
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
    const dryRun = body.dry_run === undefined ? true : Boolean(body.dry_run);
    const limitStyles = Number(body.limit_styles ?? 10) || 10; // default small batch
    const onlyStyle = String(body.only_style ?? "").trim();
    const offset = Math.max(0, Number(body.offset ?? 0) || 0);
    const maxRuntimeMs = Math.max(5000, Math.min(50000, Number(body.max_runtime_ms ?? 40000) || 40000));
    const startTime = Date.now();

    // 1. Alle bekannten Casa-Moda Source-URLs holen (synced + pending + syncing + sync_pending + sync_error)
    //    -> daraus Style-IDs ableiten und ein Set bekannter colorIds pro Style bauen
    const { data: rows, error: selErr } = await supabase
      .from("product_import_log")
      .select("source_url, status")
      .eq("brand", "casa-moda");
    if (selErr) throw selErr;

    type StyleInfo = { sampleUrl: string; sampleSlug: string; knownColors: Set<string> };
    const styleMap = new Map<string, StyleInfo>();

    for (const r of rows ?? []) {
      const ids = parseStyleColor(r.source_url);
      if (!ids) continue;
      if (onlyStyle && ids.styleId !== onlyStyle) continue;
      const slug = extractSlugBase(r.source_url);
      if (!slug) continue;
      let info = styleMap.get(ids.styleId);
      if (!info) {
        info = { sampleUrl: r.source_url, sampleSlug: slug, knownColors: new Set() };
        styleMap.set(ids.styleId, info);
      }
      info.knownColors.add(ids.colorId);
    }

    const styleIds = Array.from(styleMap.keys()).sort();
    const styleSlice = styleIds.slice(offset, offset + limitStyles);

    let scanned = 0;
    let stylesWithMissing = 0;
    let inserted = 0;
    let lastProcessedIndex = offset;
    let timedOut = false;
    const newRows: Array<{ source_url: string; brand: string; status: string }> = [];
    const details: Array<Record<string, unknown>> = [];

    for (let i = 0; i < styleSlice.length; i++) {
      if (Date.now() - startTime > maxRuntimeMs) {
        timedOut = true;
        break;
      }
      const styleId = styleSlice[i];
      const info = styleMap.get(styleId)!;
      scanned++;
      lastProcessedIndex = offset + i + 1;
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch(info.sampleUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
            "Accept-Language": "de-DE,de;q=0.9",
          },
          signal: ctrl.signal,
        });
        clearTimeout(t);
        if (!res.ok) {
          details.push({ styleId, error: `HTTP ${res.status}`, sampleUrl: info.sampleUrl });
          continue;
        }
        const html = await res.text();
        const siblings = extractSiblings(html, styleId);

        const missing = siblings.filter((s) => !info.knownColors.has(s.colorId));
        if (missing.length > 0) {
          stylesWithMissing++;
          for (const m of missing) {
            newRows.push({
              source_url: m.url,
              brand: "casa-moda",
              status: "sync_pending",
            });
            inserted++;
          }
          details.push({
            styleId,
            sampleUrl: info.sampleUrl,
            knownCount: info.knownColors.size,
            siblingCount: siblings.length,
            missing: missing.map((m) => ({ colorId: m.colorId, color: m.colorName, url: m.url })),
          });
        }
      } catch (e) {
        details.push({ styleId, error: e instanceof Error ? e.message : String(e) });
      }
    }

    // 4. Insert (chunked), wenn nicht dry_run
    let insertedRealCount = 0;
    if (!dryRun && newRows.length > 0) {
      // Vor dem Insert nochmal duplikate gegen DB prüfen, falls parallel was reinkam
      const urls = newRows.map((r) => r.source_url);
      const { data: existing, error: existErr } = await supabase
        .from("product_import_log")
        .select("source_url")
        .in("source_url", urls);
      if (existErr) throw existErr;
      const existSet = new Set((existing ?? []).map((e: any) => e.source_url));
      const finalRows = newRows.filter((r) => !existSet.has(r.source_url));

      // Chunked Insert (200er Pakete)
      for (let i = 0; i < finalRows.length; i += 200) {
        const chunk = finalRows.slice(i, i + 200);
        const { error: insErr } = await supabase.from("product_import_log").insert(chunk);
        if (insErr) throw insErr;
        insertedRealCount += chunk.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        styles_total: styleIds.length,
        offset_in: offset,
        next_offset: lastProcessedIndex < styleIds.length ? lastProcessedIndex : null,
        timed_out: timedOut,
        styles_scanned: scanned,
        styles_with_missing: stylesWithMissing,
        missing_color_urls_found: inserted,
        inserted_into_log: insertedRealCount,
        details: details.slice(0, 50),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[casa-moda-color-sweep] fatal:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
