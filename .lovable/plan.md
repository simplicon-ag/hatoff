# Vollständiger Produkt-Crawl von Casa Moda + Venti

## Problem

Aktuell findet der Import nur ~18 Hosen, obwohl Casa Moda 72 Artikel hat. Ursache:

- Die Discover-Funktion ruft pro Kategorie-Slug `…/article_collection/<slug>.json?page=1&size=500` auf.
- Casa Moda **ignoriert `size=500`** und liefert nur ~13 Artikel pro Seite. Die Pagination wird nicht durchlaufen, deshalb bleibt es bei 1 Seite.
- Der bestehende Sitemap-Fallback ruft `/sitemap.xml` auf — Casa Moda liefert dort aber eine 404-HTML-Seite. Die echte Sitemap liegt unter `/export/sitemap/sitemap_index.xml` und verweist auf eine **gzip-komprimierte** XML-Datei, die der aktuelle Code nicht entpackt.

## Verifizierte Datenlage

Aus den echten (gzipped) Sitemaps verfügbar:

- Casa Moda: **1709 Farb-URLs → 1046 unique Produkte** (Hosen-relevant: ~100 URLs)
- Venti: **868 Farb-URLs → 512 unique Produkte**

## Lösung

`supabase/functions/product-import-discover/index.ts` umstellen, sodass die Sitemap **die primäre Quelle** ist (Kategorie-JSONs nur noch als Backup für ganz neue Produkte, die noch nicht in der Sitemap sind):

1. **`fetchSitemapUrls`** erweitern:
   - Aus `robots.txt` die Sitemap-URL lesen (Fallback: `/export/sitemap/sitemap_index.xml`).
   - Sitemap-Index entpacken, jeden Child-Sitemap-Eintrag laden.
   - Wenn die URL auf `.gz` endet, Antwort als `gzip` dekomprimieren (Deno: `DecompressionStream("gzip")`).
   - Produkt-URLs per Regex extrahieren.
2. **Sitemap-URLs zuerst**, danach die JSON-Kategorien als Ergänzung mergen.
3. Fortschrittslogs ergänzen, damit man im Edge-Function-Log sieht, wie viele URLs aus Sitemap vs. Kategorien kommen.

Der Rest der Pipeline (Gruppierung nach Artikel-ID, Farb-Varianten als `color_urls`, Insert in `product_import_log`, Worker) bleibt unverändert — er bekommt einfach mehr Eingangs-URLs.

## Bedienung

Nach dem Deploy in **Admin → Import**:
1. „Produkte entdecken" klicken (sollte jetzt ~1500 Casa-Moda + ~870 Venti URLs finden).
2. „Import starten" — der Worker läuft die Liste durch. Bestehende Handles werden übersprungen (oder auf `update_mode` gesetzt, wenn `include_existing` aktiv ist).

## Technische Details

Datei: `supabase/functions/product-import-discover/index.ts`

```text
robots.txt → Sitemap-URL extrahieren
   ↓
sitemap_index.xml → Liste der Child-Sitemaps
   ↓
für jede Child-Sitemap (oft .xml.gz):
   fetch + (falls .gz) DecompressionStream("gzip")
   → Regex extrahiert Produkt-URLs
   ↓
URLs aus Sitemap + Kategorie-JSON deduplizieren
   ↓
parseProductUrl + buildBaseHandle (unverändert)
   ↓
Insert in product_import_log
```

Gzip-Decoding in Deno:
```ts
const res = await fetch(url, { headers: { "User-Agent": UA } });
const stream = res.body!.pipeThrough(new DecompressionStream("gzip"));
const text = await new Response(stream).text();
```

Erwartung nach dem Lauf: Bei der nächsten Discover-Runde sollten ~1500+ neue/bestehende Casa-Moda-URLs und ~870 Venti-URLs gruppiert werden — danach läuft der bestehende Import-Worker ganz normal über die Liste und legt die fehlenden Produkte (inkl. aller Farben + Grössen-Varianten) in Shopify an.