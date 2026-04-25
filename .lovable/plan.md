## Problem

Aktuell laufen **20 von 51 verarbeiteten Produkten in 429-Rate-Limit-Errors**. Shopify erlaubt nur **2 API-Calls/Sekunde**, der Worker schickt aber 10–20 parallel:

- 6 Produkte parallel pro Worker-Tick
- Pro Produkt: 1× Create + bis zu 5× Bild-Upload = 6+ Calls
- Frontend triggert alle 8s einen neuen Tick, auch wenn der vorherige noch läuft → Worker überlappen

Zusätzlich: 1 Eintrag mit 422 `handle has already been taken` (Duplikat), 3 Einträge hängen in `creating` (Worker abgebrochen mitten drin).

## Lösung

### 1. `supabase/functions/product-import-run/index.ts` — Rate-Limit-konforme Verarbeitung

**a) Sequenziell statt parallel**
- Batch-Size auf **2 Produkte pro Tick** reduzieren (statt 6)
- Produkte **nacheinander** verarbeiten (kein `Promise.all`)
- Zwischen jedem Shopify-Call **600ms warten** (= ~1.5 Calls/sec, sicher unter Limit von 2/sec)

**b) Automatischer Retry bei 429**
- Wrapper-Funktion `shopifyFetch()` einbauen die:
  - Bei 429-Response den `Retry-After` Header liest (oder fallback 2s)
  - Bis zu **3× automatisch retryt** mit exponentieller Pause (2s → 4s → 8s)
  - Erst danach den Eintrag als `error` markiert
- Bilder einzeln nacheinander hochladen (nicht parallel), je 600ms Pause

**c) Duplikat-Handling (422 `handle has already been taken`)**
- Bei diesem Fehler: Status auf `skipped` setzen statt `error` (Produkt existiert schon in Shopify, ist also OK)
- Optional: per `GET /products.json?handle=xyz` die existierende Product-ID holen und im Log speichern

**d) Lock gegen überlappende Worker**
- Vor Verarbeitung im `product_import_job`-Singleton-Row prüfen ob `state='running'` UND letzter `updated_at` < 30s alt → wenn ja: dieser Tick exitet sofort (ein anderer Worker arbeitet schon)
- Eigenes `updated_at` regelmässig aktualisieren als „Heartbeat"

### 2. `src/pages/AdminImport.tsx` — Tick-Intervall anpassen

- Auto-Tick von **8s → 20s** erhöhen (passt zur sequenziellen Verarbeitung: 2 Produkte × ~5s = 10s, plus Puffer)
- Batch-Size im Frontend von 6 auf 2 ändern

### 3. Cleanup-Migration — hängende Einträge & alte Errors zurücksetzen

Eine SQL-Migration die:
- 3 Einträge in `creating` zurück auf `pending` setzt
- Die 20 `error`-Einträge mit 429-Fehler zurück auf `pending` setzt (waren keine echten Datenfehler)
- Job-Counters (`error_count`, `processed`) entsprechend dekrementiert

## Erwartetes Ergebnis

- Keine 429-Errors mehr
- Stabile Verarbeitung mit ~2 Produkten/20s = ~360 Produkte/Stunde
- 951 pending + 23 zurückgesetzte = **974 Produkte** werden in ~3 Stunden sauber importiert
- Duplikate werden korrekt als `skipped` markiert statt als Error gezählt

## Was NICHT angefasst wird

- Auth-Logik (`resolveAdminToken`) — funktioniert bereits korrekt
- Scraping-Logik (Firecrawl) — keine Probleme
- Discover-Funktion — keine Änderung nötig
- Die 31 bereits erfolgreich erstellten Shopify-Produkte bleiben unberührt
