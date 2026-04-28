## Ziel

Aktuell wurde jedes Produkt einmalig importiert mit den Farben/Größen, die zum Zeitpunkt des Imports verfügbar waren — **und alle Farben teilen sich denselben Größensatz**. Das stimmt nicht mit der Realität überein: bei Casa Moda / Venti hat z. B. das gleiche Hemd in „weiss" oft 38–46 verfügbar, in „rot" aber nur 40–44.

Ein **nächtlicher Inventar-Sync** soll das geradeziehen:

- **fehlende Farben** zum Hemd dazukommen,
- **Größen werden pro Farbe individuell** auf den echten Stand der Marken-Webseite gebracht,
- nicht mehr verfügbare (Farbe × Größe)-Kombinationen werden auf `inventory = 0` gesetzt (statt gelöscht — Bestellhistorie & Links bleiben),
- **Preise** und **Sale-Status** werden mitgezogen,
- **Bilder werden NIE angefasst** (deine Vorgabe).

---

## Wichtigster Punkt: Größen pro Farbe statt global

Heute hat ein Shopify-Produkt z. B. die Optionen:
```
Größe:  38, 39, 40, 41, 42, 43, 44, 45, 46
Farbe:  weiss, hellblau, rot
```
Was zu **9 × 3 = 27 Varianten** führt — alle als „verfügbar" markiert, auch wenn rot in 38 nie produziert wurde.

Nach dem Sync existieren weiterhin alle 27 Varianten (damit Shopify-Optionen sauber bleiben), aber jede einzelne hat den **echten Bestand pro Farbe**:

```
weiss/38   → inventory 1   (verfügbar)
weiss/39   → inventory 1
…
rot/38     → inventory 0   (im Picker ausgegraut)
rot/39     → inventory 0
rot/40     → inventory 1   (verfügbar)
rot/41     → inventory 1
rot/42     → inventory 1
rot/43     → inventory 0
…
```

So sieht der Kunde im Frontend bei Auswahl der Farbe **rot** automatisch nur noch 40-42 als wählbar — exakt wie auf der Original-Seite. `ProductDetail.tsx` macht das bereits korrekt über `availableForSale` aus der Storefront-API; es braucht **keine Frontend-Änderung**.

---

## Technische Umsetzung

### 1. Neue Edge Function: `product-inventory-sync`

```text
für jedes Shopify-Produkt mit vendor in (Venti, Casa Moda):
  1. lese product_import_log.scraped_data → article_id + alle color_urls
  2. firecrawl scrape pro color_url:
     → liefert { color, sizes_in_stock[], price_eur, on_sale }
     → image_urls werden IGNORIERT
  3. baue Soll-Matrix: Map<color, Set<size>>
  4. lese Ist-Varianten aus Shopify
  5. diff:
     - neue Farbe (noch nicht in Shopify-Optionen)
       → option-value „Farbe" erweitern
       → für jede globale Größe Variante anlegen, davon nur die echten Größen mit inventory=1, Rest mit inventory=0
     - bestehende Variante (color, size):
       · in Soll-Matrix vorhanden → inventory_quantity = 1
       · NICHT in Soll-Matrix     → inventory_quantity = 0
     - neue Größe global (hat irgendeine Farbe diese Größe?)
       → Größen-Option erweitern, neue Varianten für alle Farben anlegen, einzeln nach Soll-Matrix befüllen
     - Preis/compare_at_price aktualisieren wenn geändert
  6. log in product_import_log (status='synced', changed_count, details)
```

Verwendete Shopify-Endpoints:
- `productOptionsCreate` / `productOptionsUpdate` (neue Farben/Größen)
- `productVariantsBulkCreate` (neue color×size Kombis)
- `productVariantsBulkUpdate` (Preisänderungen)
- `inventorySetOnHandQuantities` (Bestand pro Variante auf 0 oder 1)

**Bewusst NICHT verwendet:** `productCreateMedia`, `productUpdate` mit `media`/`images` → Bilder bleiben unverändert.

### 2. Batching & Schonung

- pro Aufruf max. **20 Produkte** (Timeout / Firecrawl-Rate-Limits)
- 2-3 s Pause zwischen Produkten
- Status-Tracking in `product_import_job` (`state='syncing'`, processed/total) — gleiches Muster wie der Initial-Import

### 3. Nightly Trigger via pg_cron

```sql
-- Start jede Nacht 02:15 UTC (~ 03:15 CH)
select cron.schedule('inventory-sync-nightly', '15 2 * * *',
  $$ select net.http_post(
       url := '…/functions/v1/product-inventory-sync',
       headers := '{"Content-Type":"application/json","apikey":"<anon>"}'::jsonb,
       body := '{"mode":"start"}'::jsonb); $$);

-- Tick alle 2 min, arbeitet weiter solange state='syncing'
select cron.schedule('inventory-sync-tick', '*/2 * * * *',
  $$ select net.http_post(
       url := '…/functions/v1/product-inventory-sync',
       headers := '{"Content-Type":"application/json","apikey":"<anon>"}'::jsonb,
       body := '{"mode":"tick"}'::jsonb); $$);
```

Voller Lauf über ~520 Handles ≈ 60-90 min, morgens fertig.

### 4. Admin-UI Erweiterung (`/admin/import`)

Neuer Block **„Inventar-Sync"**:
- Button **„Jetzt manuell starten"**
- Live-Status: `syncing 142 / 520 — Casa Moda Hemd Modern Fit …`
- Hinweis: *„Bilder werden nicht verändert"*
- Letzter erfolgreicher Lauf + Diff-Statistik (neue Farben / neue Größen / out-of-stock gesetzt / Preisänderungen)

### 5. Frontend

Keine Änderung nötig — der Größen-Picker auf `/product/[handle]` filtert bereits nach `availableForSale` pro selektierter Farbe.

---

## Offene Fragen

1. **Alte (Farbe × Größe)-Kombi nicht mehr da**:
   - (a) **inventory = 0** setzen, Variante bleibt sichtbar aber ausgegraut, **oder**
   - (b) Variante komplett löschen?

   → Empfehlung **(a)** — kommt die Größe zurück, geht sie automatisch wieder auf 1; keine kaputten Links.

2. **Frequenz**: nächtlich um 03:15 CH ok, oder lieber 2× pro Tag (mittags + nachts)?

Sag „los" + Antwort auf die zwei Punkte, dann baue ich es.