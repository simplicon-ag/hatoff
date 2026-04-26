## Ziel

Ein einziger Button "**Alles holen & importieren**" im Admin scannt komplette `casamoda.com` + `venti.com` Kataloge, scraped jedes Produkt mit dem verbesserten Akkordeon-Scraper (Beschreibung/Material/Pflege), und legt es in Shopify an oder aktualisiert es. Live-Fortschritt sichtbar, jederzeit stoppbar.

---

## Was schon existiert (wird wiederverwendet)

- ✅ `product-import-discover` — sammelt URLs aus 60+ Kategorie-Slugs beider Brands, gruppiert sie nach Artikelnummer, schreibt `pending`-Rows in `product_import_log`
- ✅ `product-import-control` — start / stop / reset / purge
- ✅ `product-import-run` — Worker-Batch (Scrape → Shopify)
- ✅ `product-import-by-url` — Einzelimport mit dem **guten** Scraper (Akkordeon-Klick, Fit, NEU-Badge, Features)
- ✅ Tabellen `product_import_log`, `product_import_job`
- ✅ Admin-UI mit Live-Job-Status (Polling auf `product_import_job`)

## Was fehlt / geändert wird

### 1. Discover erweitern um echtes **Sitemap-Crawling**
Datei: `supabase/functions/product-import-discover/index.ts`

- Zusätzlich zu den hartcodierten Kategorie-Slugs auch `sitemap.xml` von beiden Brands lesen (`https://www.casamoda.com/sitemap.xml`, `https://www.venti.com/sitemap.xml`) — fängt auch Produkte ab, die in keiner Kategorie-Liste auftauchen
- Optional `?include_existing=true` Parameter: bestehende Shopify-Handles werden NICHT übersprungen, sondern als `status='pending'` mit `update_mode=true` markiert → Worker macht Update statt Create

### 2. Worker auf den **guten Scraper** umstellen
Datei: `supabase/functions/product-import-run/index.ts`

- Scraper-Logik aus `product-import-by-url` extrahieren (Akkordeon-JS-Click, Fit-Detection, NEU-Badge, Features-Bullets, korrektes Material/Pflege-Parsing) und in den Batch-Worker einbauen
- Pro Group (Artikel + alle Farben aus `scraped_data.color_urls`) parallel scrapen, dann **ein** Shopify-Produkt mit Color-Optionen anlegen — wie im by-url-Flow
- **Update-Modus**: wenn Handle in Shopify existiert → `PUT /products/{id}.json` statt `POST` (Bilder/Beschreibung/Preis ersetzen, Varianten beibehalten)
- Batch-Size auf 3 reduzieren (Akkordeon-Scrape dauert ~15s/Farbe, 3 Produkte × 2 Farben = ~90s, passt unter Edge-Function-Timeout)

### 3. Selbst-laufender Worker (Cron)
Damit "Ein Klick startet alles" wirklich von alleine bis zum Ende läuft:

- **pg_cron** + **pg_net** aktivieren (sind in der Lovable-Cloud verfügbar)
- Cron-Job: alle 60 Sekunden `product-import-run` mit `batch_size=3` aufrufen, **wenn** `product_import_job.state = 'running'`
- Worker setzt `state='done'` sobald keine `pending` Rows mehr da sind → Cron macht nix mehr
- Stop-Button setzt `state='stopping'` → Worker beendet aktuellen Batch und setzt `state='stopped'`

### 4. Admin-UI vereinfachen
Datei: `src/pages/AdminImport.tsx`

Neue Hero-Card ganz oben:

```
┌─────────────────────────────────────────────────┐
│ 🚀 Voll-Import: alles holen                     │
│                                                  │
│ Scannt casamoda.com + venti.com komplett,       │
│ legt neue Produkte an, aktualisiert bestehende. │
│ Dauer: ~2-4 Stunden für ~800 Produkte.          │
│                                                  │
│ ☑ Bestehende Produkte aktualisieren             │
│                                                  │
│ [▶ Voll-Import starten]  [⏸ Stoppen]            │
│                                                  │
│ ▓▓▓▓▓▓░░░░░░░░░ 312 / 847 Produkte              │
│ Aktuell: Casa Moda Businesshemd 3760 (Beige)    │
└─────────────────────────────────────────────────┘
```

- Ein-Klick-Button löst hintereinander aus: `discover` → `control:start` → Cron läuft an
- Live-Liste der letzten 10 verarbeiteten Produkte mit Status (✓ erstellt / ↻ aktualisiert / ✗ Fehler + Grund)
- Bestehende Sektionen (Einzel-URL, Job-Status, Purge) bleiben darunter erhalten

### 5. Datenbank-Migration

```sql
-- Cron + HTTP für selbst-laufenden Worker
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Update-Modus Flag pro Log-Row
alter table product_import_log
  add column if not exists update_mode boolean not null default false;

-- Cron-Job: jede Minute Worker triggern wenn Job läuft
select cron.schedule(
  'product-import-tick',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://xccffclxvdmwfgydebqx.supabase.co/functions/v1/product-import-run',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>"}'::jsonb,
    body := '{"batch_size":3,"only_if_running":true}'::jsonb
  );
  $$
);
```

---

## Ehrliche Trade-offs / Risiken

| Punkt | Realität |
|---|---|
| **Firecrawl-Credits** | Voll-Crawl ~800 Produkte × 2 Farben Ø = ~1600 Scrapes. Bei Standard-Plan → ggf. Credits aufstocken. |
| **Beschreibung/Material** | Akkordeon-Klick funktioniert in ~70-90% der Fälle. Den Rest siehst du in Shopify als leeres Feld und pflegst nach. |
| **Dauer** | Bei 60s Cron-Tick × 3 Produkte/Tick = 60 Produkte/h. 800 Produkte = ~13h. Wenn du schneller willst → batch_size hoch oder Cron auf 30s. |
| **Update-Modus** | Aktualisiert Bilder/Preis/Beschreibung. Manuell hinzugefügte Tags/Badges in Shopify bleiben erhalten (wir touchen `tags` nur additiv). |

---

## Reihenfolge der Umsetzung

1. Migration: `pg_cron`, `pg_net`, `update_mode`-Spalte, Cron-Job
2. `product-import-discover` um Sitemap + `include_existing` erweitern
3. Scraper-Logik aus `by-url` in `product-import-run` mergen + Update-Modus
4. `product-import-run` um `only_if_running`-Guard erweitern (Cron-Safety)
5. `AdminImport.tsx` Hero-Card oben, Live-Liste der letzten 10 Items
6. End-to-End-Test mit ~5 Produkten, dann Voll-Crawl freigeben

Nach Approval setze ich das in Default-Mode um.
