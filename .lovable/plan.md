## Ziel
**Looks-first** bleibt das Herzstück. Im Shop ergänzen wir die volle Produkt-Range beider Marken, und die Startseite bekommt zwei neue dynamische Sections **"Neu eingetroffen"** und **"Sale-Highlights"**.

## Ausgangslage (gerade gemessen)
- Shopify hat **243 Produkte** total — alle bereits via `fetchAllProducts()` abrufbar
- `product_price_cache`: 595 Einträge (Casa-Moda + Venti zusammen, inkl. Varianten)
- Davon **114 ok**, **147 mismatch** (gesperrt), **333 fallback** (Shopify-Preis), 1 not_found
- Saison-Mappings: nur 115 Produkte → der Rest wird im Shop sowieso schon gezeigt

## Plan

### 1. Mehr Kategorien scrapen (Saison-Coverage erhöhen)
In `supabase/functions/season-sync/index.ts` die `SOURCES`-Map ergänzen:
- **Casa Moda zusätzlich**: `pullover`, `sweat`, `accessoires`, `business`, `casual`, `sale`
- **Venti zusätzlich**: `business-hemden`, `casual-hemden`, `sale`, `pullover`, `strick` (für FS auch), `freizeithemden`

Die saisonalen Hard-Excludes (Bermudas raus aus H/W etc.) greifen weiterhin automatisch. Ergebnis: deutlich mehr Produkte landen in den richtigen Saisons → die Looks-Seite + Saison-Seiten zeigen mehr Auswahl.

Danach: einmal `season-sync` manuell triggern, damit die neuen Kategorien sofort wirksam sind.

### 2. Neue Frontseiten-Section: **"Neu eingetroffen"**
Neue Section auf `src/pages/Index.tsx` zwischen "Featured Looks" und "Brand Strip":
- Lädt die 8 neuesten Shopify-Produkte (Query `created_at:>2025-01-01`, sortiert via Shopify-Default neueste-zuerst)
- 4-spaltiges Grid (auf mobile 2-spaltig), gleiche `ProductCard`-Komponente wie bisher
- Header: "Frisch im Sortiment" + Link "Alle neuen Stücke →" (führt zu `/shop?sort=neu`)

### 3. Neue Frontseiten-Section: **"Sale-Highlights"**
Neue Section vor dem Magazin-Teaser:
- Lädt aus `product_price_cache` alle Einträge mit `on_sale = true` und `status != 'mismatch'` (sortiert nach grösster prozentualer Ersparnis)
- Holt für die Top 4 Handles die Shopify-Daten via `fetchProductsByHandles()`
- Sale-Badge (rot) auf jeder Karte mit "-XX %"
- Header: "🔥 Aktuelle Deals" + Link "Alle Sale-Stücke →" (führt zu `/sale`)

### 4. Sale-Seite: bestehende Sale.tsx aufwerten
Die bereits vorhandene `src/pages/Sale.tsx` füllen wir mit echtem Inhalt:
- Lädt **alle** `on_sale=true` & `status != 'mismatch'`-Handles aus dem Cache
- Holt Shopify-Daten und zeigt sie mit Standard-Filtern (Marke, Grösse) — Layout wie `Shop.tsx`
- Sortiert default nach grösster Ersparnis
- Link "Sale" in der `SiteHeader`-Nav prominent (rote Akzentfarbe), damit's auffällt

### 5. Cleanup / kleine Verbesserungen
- Im Shop (`src/pages/Shop.tsx`): Sortier-Option **"Neueste zuerst"** ergänzen (nutzt Shopify's `query` Parameter)
- Sicherstellen, dass `useLivePrice` für die neuen Sections funktioniert (sollte automatisch der Fall sein, da `ProductCard` bereits den Hook nutzt)

## Was wir NICHT machen (bewusst)
- **Looks-Struktur unverändert** — Looks-first bleibt
- **Brand-Tiles, Hero-Switcher, Lookbook-Karussell** verschoben auf später (kann ich gerne als nächstes anbieten)
- **Cron manuell triggern**: nicht nötig, der Plan beinhaltet ohnehin einen einmaligen `season-sync`-Run für die neuen Kategorien

## Erwartetes Ergebnis
- Saison-Mappings wachsen von ~115 auf voraussichtlich **180–220** Produkte
- Startseite hat **2 neue dynamische Sections**, die sich täglich automatisch aktualisieren (Cron läuft 03:00 UTC)
- Sale-Rubrik ist nutzbar und zeigt alle ~30–80 reduzierten Produkte
- Shop bleibt wie er ist, nur mit neuer Sortier-Option