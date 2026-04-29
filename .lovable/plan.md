## Casa Moda + Venti: Reimport sauber zu Ende bringen

### Schritt 1 — Backlog requeuen (DB)
Eine Insert-Migration setzt:
- 558 `pending` → `sync_pending`
- 339 Fehler `shopify product not found` → `sync_pending`, `update_mode=false`
- 22 Fehler `no shopify_product_id` → `sync_pending`, `update_mode=false`
- 27 hängende `syncing` (älter als 10 min) → `sync_pending`
- 13 `no colours scraped` bleiben als Fehler (Liste wird ausgegeben)

### Schritt 2 — Worker beschleunigen
- Bestehenden Cron-Job `brand-import-worker` neu schedulen: **alle 30 s, Batch 8**
- Geschätzte Restzeit: ~1 Stunde für ~946 Items

### Schritt 3 — Cleanup-Skript fixen
`supabase/functions/brand-cleanup-duplicates/index.ts` umbauen:
- Gruppierung nicht mehr nach `handle`, sondern nach Tag `art:<articleId>-<colorId>` (wegen Shopify `-1`/`-2`-Suffixen)
- Pro Gruppe: neuestes Produkt behalten, ältere löschen
- `product_color_group` automatisch auf behaltene Shopify-ID umschreiben
- Dry-Run-Default beibehalten

### Schritt 4 — Cleanup ausführen
- Erst Dry-Run aufrufen, Resultat zeigen
- Nach deinem Go: Live-Lauf

### Schritt 5 — Endkontrolle
SQL-Report:
- Anzahl synced/Fehler pro Brand
- Anzahl Shopify-Produkte pro `parent_article_id` (sollte = Anzahl Farben)
- Liste der toten Quell-URLs (`no colours scraped`)

### Technische Details
- Schritt 1 + 2 über Supabase-Insert-Tool (UPDATE-Statements + cron.schedule)
- Schritt 3 als Edge-Function-Edit
- Schritt 4 + 5 über `supabase--curl_edge_functions` und `supabase--read_query`
- Cron-Job-Name: bestehender wird mit gleichem Namen neu registriert (überschreibt Schedule)
