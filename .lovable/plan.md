## Ziel
Beide Scraper laufen automatisch **täglich**, damit Preise und Saison-Listen immer frisch sind — ohne manuelles Anstossen.

## Was läuft heute?
- **`product-price`**: Holt Live-Preise von casamoda.com / venti.com (Cache 7 Tage). Wird heute nur **on-demand** beim Seitenaufruf getriggert.
- **`season-sync`**: Aggregiert pro Saison die Produktlisten der Marken-Kategorieseiten. Wird heute **manuell** aufgerufen.
- **Extensions `pg_cron` / `pg_net`**: aktuell **nicht aktiviert** (Check ergab leeres Resultat).

## Plan

### 1. Extensions aktivieren (Migration)
- `create extension if not exists pg_cron;`
- `create extension if not exists pg_net;`

### 2. Drei tägliche Cron-Jobs einrichten (SQL via DB-Insert, kein Migration-File — enthält Anon-Key)

| Job | Zeit (UTC) | Funktion | Body |
|---|---|---|---|
| `season-sync-fs` | 02:00 | `season-sync` | `{"season":"fs-2026"}` |
| `season-sync-hw` | 02:15 | `season-sync` | `{"season":"hw-2026"}` |
| `product-price-refresh` | 03:00 | neuer Endpoint `product-price-refresh` | (kein Body) |

Zeiten gestaffelt, damit Firecrawl-Quota nicht in einem Burst aufgebraucht wird.

### 3. Neuer Edge-Endpoint `product-price-refresh`
Da `product-price` aktuell **Handles als Input** erwartet, bauche ich eine neue kleine Funktion, die:
- alle Handles aus `product_price_cache` lädt, deren `fetched_at` älter als **24 h** ist **und** Status nicht `mismatch` ist (Mismatches bleiben gesperrt — wie vom letzten Schritt vereinbart),
- diese Handles in Batches (z.B. 20er) an die bestehende `product-price`-Funktion mit `force=1` weiterreicht,
- pro Batch eine kurze Pause einlegt (Rate-Limit-Schutz für Firecrawl),
- ein kurzes Resultat-JSON loggt (verarbeitet/erfolgreich/Fehler).

Vorteil: bestehende Logik in `product-price` bleibt unverändert, neue Funktion ist nur ein Orchestrator.

### 4. Verifikation
- Nach Setup: `select * from cron.job;` — die 3 Jobs müssen erscheinen.
- Optional: Einen Job manuell triggern (`select cron.schedule(...)` → `select net.http_post(...)`) um Erfolg zu prüfen, ohne 24 h zu warten.

## Offene Detail-Frage
**Sind 24 h Refresh-Intervall OK** oder soll ich auf z.B. **48 h / 7 Tage** gehen? Firecrawl hat Credits-Limits — bei ~170 Casa-Moda-Produkten + Venti-Produkten täglich kann das ins Geld gehen.

Falls du knausrig sein willst: Variante "nur **Sale-Produkte täglich**, Rest wöchentlich" wäre auch sauber umsetzbar — sag Bescheid.
