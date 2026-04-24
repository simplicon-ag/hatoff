# VENTI & CASAMODA Vollkatalog-Import

## Ziel
Bestehende 7 Demo-Produkte löschen und durch den **echten Vollkatalog** beider Marken ersetzen — alle Kategorien (Hemden, Polos, Pullover, Hosen, Jacken, Accessoires), inkl. Beschreibungen, Material, Pflege, Bilder, Grössen-Varianten.

## Kontext (bestätigt)
- ✅ Autorisierter Händler — rechtlich abgedeckt
- ✅ Alle Kategorien
- ✅ Reihenfolge egal / parallel
- ✅ Preisformel: **EUR × 2.8**, gerundet auf .90 (z. B. €49.95 → CHF 139.90)

## Realistische Erwartungen
- ~150–300 Produkte pro Marke = **300–600 total**
- ~1'500–3'000 Firecrawl-Calls (Map + Scrape)
- Geschätzte Laufzeit: **30–60 min**
- Bilder werden via Hersteller-CDN-URLs verlinkt (als autorisierter Händler ok); Fallback: Upload zu Shopify, falls Hotlink-Schutz

## Phase 1 — Setup
1. **Lovable Cloud aktivieren** (falls noch nicht aktiv) — für sichere Secret-Speicherung.
2. **Firecrawl-Connector verbinden** via `standard_connectors--connect` (`firecrawl`). Du wählst eine bestehende oder neue Connection im Picker.
3. Import-Skript `scripts/import-brand.ts` schreiben — wird per `code--exec` im Sandbox ausgeführt, ruft direkt Firecrawl REST v2 + `shopify--create_product` auf.

## Phase 2 — URL-Discovery (Stop-Punkt!)
4. `firecrawl map` auf `casamoda.com` und `venti.de` (mit Filter auf Produkt-URL-Patterns).
5. **Stop & Review**: Ich melde mich mit den URL-Counts pro Marke/Kategorie zurück, bevor wir Credits in den vollen Scrape stecken.

## Phase 3 — Strukturierte Extraktion
6. Pro Produkt-URL `firecrawl scrape` mit JSON-Schema:
   - title, brand, price_eur
   - description_short, description_long
   - material, care_instructions
   - fit, color
   - sizes_available[], image_urls[]
   - category, season

## Phase 4 — Demo-Cleanup & Shopify-Import
7. Alle 7 Demo-Produkte via `shopify--list_products` + `shopify--delete_product` entfernen.
8. Pro Produkt `shopify--create_product`:
   - Preisumrechnung: `chf = round(eur × 2.8 / 10) × 10 - 0.10`
   - Optionen: Grösse + ggf. Farbe
   - Varianten: alle Grössen-Kombinationen
   - Bilder: Hersteller-CDN-URLs
   - Tags: `marke:*`, `welt:*` (business/smart-casual/freizeit/sommer abgeleitet aus Kategorie), `anlass:*`
9. Live-Logging; Fehler-Toleranz mit Zusammenfassung am Ende.

## Phase 5 — Frontend-Anpassung
10. **`src/data/looks.ts`**: kuratierte Looks auf neue echte Produkt-Handles ummappen.
11. **Marken-Detailseiten** `/marke/casamoda` und `/marke/venti` mit Filtern (Kategorie/Farbe/Grösse).
12. **Shop-Seite** mit Brand- und Kategorie-Filter erweitern.
13. TypeScript-Check + QA-Stichprobe der Storefront.

## Risiken & Fallbacks
- **Firecrawl-Credits aufgebraucht** → Pause + Hinweis (`LOVABLE50` Coupon falls managed).
- **Bilder mit Hotlink-Schutz** → Fallback: Bilder via Firecrawl scrapen + zu Shopify hochladen (langsamer).
- **Anti-Bot / Rate-Limits** → Firecrawl handhabt das meist; ggf. Delays einbauen.

## Was du sehen wirst, sobald freigegeben
1. Wechsel in Default-Modus.
2. Lovable Cloud aktivieren (falls nötig).
3. Firecrawl-Connection-Picker — du wählst die Connection.
4. Map-Resultate mit URL-Counts → **Stop-Punkt für deine Bestätigung**.
5. Voller Scrape + Import läuft, Live-Log.
6. Frontend-Updates (Looks-Mapping, Marken-Seiten, Shop-Filter).
7. Final-Check und QA-Bericht.
