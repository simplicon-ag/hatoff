## Ziel

Beide Marken (**Casa Moda** und **Venti**) nach demselben Schema importieren: Pro `articleId` ein einziges Shopify-Produkt mit **Farbe** + **Grösse** als Varianten. Danach KI-Looks generieren, in denen der Kunde auf der Look-Detail-Seite die Farbe pro Artikel wechseln kann.

URL-Schema ist bei beiden Marken identisch:
- Casa Moda: `https://www.casamoda.com/de/de/<slug>-<articleId>-<colorId>`
- Venti: `https://www.venti.com/de/de/<slug>-<articleId>-<colorId>`

→ **eine** Gruppierungs-Logik reicht für beide Marken.

Aktueller Stand der `pending`-Queue:
| Marke | URLs | → gruppiert nach articleId |
|---|---|---|
| Casa Moda | 409 | **121 Produkte** |
| Venti | 544 | **184 Produkte** |
| Total | 953 | **305 Produkte** |

---

## 1. Worker stoppen & DB aufräumen

- `product-import-control` mit `action: "stop"` aufrufen, damit der laufende Import gestoppt wird (sonst läuft er parallel mit alter Logik weiter).
- Migration: alle aktuellen `pending`/`error`/`creating`/`scraped`-Einträge löschen (sind gleich wieder da nach Re-Discovery, nur dann gruppiert).
- Job-Counters auf 0 zurücksetzen.

## 2. `supabase/functions/product-import-discover/index.ts` — Gruppierungs-Logik

Für **beide Marken identisch**:

a) `urlToHandle(url)` ersetzen durch zwei Helfer:
```ts
function parseProductUrl(url: string): { articleId: string; colorId: string; slugBase: string } | null {
  // Greift bei beiden Marken: ".../slug-12345-678"
  const m = url.match(/\/de\/de\/([a-z0-9-]+?)-(\d{4,5})-(\d{2,4})\/?$/i);
  if (!m) return null;
  return { slugBase: m[1].toLowerCase(), articleId: m[2], colorId: m[3] };
}

function buildBaseHandle(brand: string, slugBase: string, articleId: string): string {
  // Farb-neutral: "casa-moda-businesshemd-3760"
  return `${brand}-${slugBase}-${articleId}`.toLowerCase();
}
```

b) Nach dem Sammeln aller URLs → in eine `Map<baseHandle, { brand, articleId, slugBase, color_urls: Array<{ url, colorId }> }>` gruppieren.

c) Pro Gruppe **eine** Zeile in `product_import_log` einfügen:
- `brand`, `source_url` = erste Farb-URL (Repräsentant)
- `handle` = `baseHandle` (z.B. `venti-businesshemd-3760`)
- `scraped_data` = `{ "color_urls": [{url, colorId}, ...] }` (mehrere Farb-URLs gespeichert)
- `status` = `pending`

d) Existing-Handles-Check in Shopify gegen den **neuen baseHandle** prüfen (sonst werden die alten gemischten Handles fälschlich als „existiert schon" erkannt — sind aber sowieso alle gepurged).

## 3. `supabase/functions/product-import-run/index.ts` — Multi-Color-Verarbeitung

Pro `pending`-Eintrag:

a) Aus `scraped_data.color_urls` alle Farb-URLs auslesen.

b) **Pro Farbe sequentiell** Firecrawl-Scrape (mit `600ms` Pause zwischen Calls — bestehender Rate-Limit bleibt).

c) Aus jedem Scrape extrahieren:
- Farbname (z.B. „Hellblau", „Mittelblau") aus Produkttitel oder Markup
- Verfügbare Grössen (S/M/L/XL/…)
- Bilder dieser Farbvariante
- Preis (sollte pro Farbe gleich sein, falls nicht → niedrigster nehmen)

d) Beschreibung, Vendor, Tags **einmal** aus erster Farbe übernehmen.

e) **Ein** Shopify-Produkt anlegen mit:
- `title` = Basis-Titel ohne Farbe (z.B. „Businesshemd Body Fit")
- `options` = `[{ name: "Grösse", values: [...] }, { name: "Farbe", values: [...] }]`
- `variants` = Kreuzprodukt aus Grössen × Farben mit jeweiligem Preis & SKU
- `images` = alle Farb-Bilder, beim Upload via Position der jeweiligen Variante zugeordnet

f) Bei 422 `handle has already been taken` → wie bisher als `skipped` markieren.

g) `shopify_product_id` zurück in den Log-Eintrag schreiben + `scraped_data.variants_summary` mit Mapping `colorName → variantIds[]` für späteres Look-Rendering.

## 4. `src/pages/AdminImport.tsx` — minimale Anpassung

- Tick-Intervall bleibt 20s, Batch-Size bleibt 2 — pro Eintrag werden jetzt aber mehr Calls gemacht (1 Scrape × N Farben + 1 Create + N Bilder). Für 305 Einträge × ~25s = **~2h Gesamtdauer** (ähnlich wie vorher).
- Nur Anzeige-Text anpassen: „X von Y Produkten" statt „Farb-URLs".

## 5. KI-Look-Generierung mit Farbwahl

`supabase/functions/style-generator/index.ts`:
- Beim Vorschlagen von Look-Kombinationen liest die Funktion die Shopify-Produkte inkl. ihrer **Farb-Optionen**.
- Output-Schema erweitern um `recommended_colors: string[]` pro Item (z.B. `["Hellblau", "Beige"]`).
- Prompt-Anpassung: Modell soll pro vorgeschlagenem Produkt 1–3 zur Look-Stimmung passende Farben empfehlen.

`src/pages/LookDetail.tsx` + `src/components/LookCard.tsx`:
- Pro Look-Item: Farb-Swatch-Picker rendern (kleine Kreise mit Farbnamen).
- State: ausgewählte Farbe pro Item → bestimmt welche `variantId` beim „In den Warenkorb"-Klick benutzt wird.
- Standard-Farbe = erste Empfehlung der KI.
- Bild im Look passt sich der gewählten Farbe an (über `variants_summary`-Mapping).

## 6. Reihenfolge der Ausführung

1. Worker stoppen.
2. Logs leeren + Counters zurücksetzen (Migration).
3. Discover- und Run-Function deployen (neue Logik).
4. `discover` aufrufen → erzeugt ~305 gruppierte `pending`-Zeilen.
5. `start` + `tick` aufrufen → Worker importiert mit Varianten.
6. Style-Generator + Frontend für Farbwahl ausrollen (kann parallel zum laufenden Import passieren).

## Was NICHT angefasst wird

- Auth, Cart-API, Storefront-Token-Logik
- Firecrawl-Scraping-Aufrufe selbst (nur die Schleife drumherum ändert sich)
- Preis-Cache, Saison-Sync, Size-Guide
- Die bereits gepurgte Shopify-Datenbank ist leer — keine Altlasten.

## Erwartetes Endergebnis

- **305 saubere Shopify-Produkte** (121 Casa Moda + 184 Venti) statt 953 verwirrender Einzeleinträge.
- Pro Produkt wählt der Kunde Farbe + Grösse direkt auf der PDP.
- KI-generierte Looks zeigen Farb-Swatches, Kunde kann Farbschema im Look anpassen, bevor er in den Warenkorb legt.
- Importzeit: ~2 Stunden, keine 429-Errors (Rate-Limit-Logik bleibt bestehen).
