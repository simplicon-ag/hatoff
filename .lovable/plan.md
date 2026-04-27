## Entscheidungen
1. **Looks** → alle auf `status='draft'` setzen (Backup behalten, nicht mehr öffentlich)
2. **Look-Strategie** → Hybrid: Basis-Sortiment (Hemden, Hosen, Pullover, Sakkos, Polos, T-Shirts) zuerst importieren, dann Looks generieren, dann Rest
3. **Neue Produkte** → Wöchentlicher Auto-Scan via Cron + manueller "Neue prüfen"-Button im Admin

---

## Umsetzung in Reihenfolge

### Schritt 1 — Looks auf Draft (sofort, ~1 Min)
- Insert/Update Statement: `UPDATE curated_looks SET status='draft', published_at=NULL`
- Frontend (`/looks`, `useCuratedLooks`): bleibt unverändert, lädt nur `status='published'` → Looks-Seite ist sofort leer
- Backup bleibt vollständig erhalten in der DB

### Schritt 2 — Du löschst Produkte im Shopify Admin
Manuell, 0 Credits. Sag mir Bescheid wenn fertig.

### Schritt 3 — Draft-Import-Edge-Function erweitern
Bestehende `product-import-by-url` Edge Function um Parameter erweitern:
- `status: 'draft'` (statt `active`)
- `category_tag: string` (zusätzlicher Tag neben Brand)
- `exclude_sale: true` (Sale/Outlet-URLs filtern)

→ Du gibst mir pro Kategorie eine Listing-URL + Tag, ich rufe die Function auf, Produkte landen als Draft.

### Schritt 4 — Phase-1-Import (Basis-Sortiment)
Wir gehen Kategorie für Kategorie durch (Reihenfolge nach deiner Vorgabe):
- Venti Hemden, Casa Moda Hemden
- Hosen, Pullover, Sakkos, Polos, T-Shirts
- Pro Kategorie: Discovery-Liste zeigen → du bestätigst → Draft-Import → du prüfst in Shopify Admin → aktivierst

### Schritt 5 — Erste Looks generieren
Sobald Basis-Sortiment aktiv ist, generieren wir ~5-10 erste Looks (existierender Generator `look-generate`). Diese landen wieder als `published` in `curated_looks`. Du prüfst und kannst Drafts deiner alten Looks bei Bedarf reaktivieren.

### Schritt 6 — Phase 2 (Rest-Sortiment)
Restliche Kategorien (Accessoires, Spezialartikel, Saison-Kram) als Draft importieren, du aktivierst.

### Schritt 7 — Auto-Scan System (am Ende, wenn Sortiment steht)

**a) Edge Function `product-discover-new`**
- Iteriert alle Brand-Listing-URLs (in einer neuen Tabelle `brand_listing_urls` konfiguriert)
- Extrahiert alle Produkt-URLs per Regex
- Diff gegen Shopify-Handles → speichert neue URLs in neue Tabelle `pending_product_imports` (status: `pending`, `imported`, `rejected`)

**b) Cron Job (pg_cron)**
- Läuft 1× pro Woche (z.B. Montag 6 Uhr)
- Ruft `product-discover-new` auf
- Importiert neue Produkte automatisch als Draft via bestehender Function

**c) Admin-UI Erweiterung in `/admin/import`**
- Neuer Tab "Neue Produkte"
- Zeigt alle `pending_product_imports` mit Status `pending`
- Button "Jetzt scannen" → triggert manuell `product-discover-new`
- Liste der Drafts mit Direkt-Link zu Shopify Admin
- Notification-Badge im Admin-Header wenn neue pending Drafts vorhanden

---

## Was ich JETZT mache (sobald du OK gibst)

**Phase 0 — sofort umsetzbar ohne dass du noch etwas tun musst:**
1. Looks auf Draft setzen (1 SQL-Statement)
2. `product-import-by-url` um `status` und `category_tag` Parameter erweitern
3. Sale-Filter in Discovery aktivieren

**Dann warte ich auf:**
- Deine Bestätigung dass alle Produkte im Shopify Admin gelöscht sind
- Erste Kategorie-URL + Tag

**Schritt 7 (Auto-Scan + Admin-UI) bauen wir am Ende**, nicht jetzt — sonst optimieren wir Infrastruktur für ein Sortiment das noch nicht existiert.

---

## Technische Details (nur falls relevant)

- `curated_looks` Update via `INSERT`-Tool (Daten-Operation, keine Schema-Änderung)
- `product-import-by-url` Erweiterung: Parameter-Schema rückwärtskompatibel (defaults: `status='active'`, `category_tag=null`, `exclude_sale=false`)
- Neue Tabellen für Schritt 7: `brand_listing_urls` (brand, url, category_tag), `pending_product_imports` (source_url, brand, status, discovered_at, imported_at) — werden später per Migration erstellt
- Cron via `pg_cron` + `pg_net` Extensions, Auth via Anon-Key (Function ist intern aufgerufen)
- Frontend `useCuratedLooks` filtert bereits `status='published'` → keine Code-Änderung nötig für Looks-Cleanup
