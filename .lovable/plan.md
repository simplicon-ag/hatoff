## Ziel
Du löschst alle aktuellen Produkte im Shopify Admin. Danach importieren wir **kategorie für kategorie**, indem du mir jeweils eine Listing-URL gibst. Alle neuen Produkte werden zuerst als **Draft** angelegt, damit du sie prüfen kannst, bevor sie live gehen.

## Workflow pro Kategorie

### 1. Du gibst mir eine Listing-URL
Beispiel: `https://www.venti.de/de/herren/hemden/business-hemden/`
oder: `https://www.casamoda.com/de/herren/hemden/`

Sag mir dazu kurz:
- **Brand-Tag** (z.B. `Venti`, `Casa Moda`) — falls nicht aus URL erkennbar
- **Shopify Collection / Tag** den ich setzen soll (z.B. `hemden`, `business`, `neuheiten`)

### 2. Discovery (0 AI-Token, 0 Firecrawl-Credits)
- `fetch` der Listing-Seite
- Regex-Extraktion aller Produkt-Detail-URLs
- Sale/Outlet-URLs werden gefiltert (Slug-Pattern: `/sale/`, `/outlet/`, `?reduziert`)
- Dedup gegen bereits in Shopify vorhandene Handles → ich zeige dir die Liste der gefundenen URLs zur Bestätigung

### 3. Detail-Crawl (0 AI-Token)
Pro Produkt-URL: 1× `fetch`, dann Cheerio/Regex extrahiert:
- **Title**
- **Beschreibung** (HTML, sauber)
- **Bilder** (alle aus Galerie)
- **Grössen** als Variant-Optionen
- **Farben** als Variant-Optionen (falls Mehrfarb)
- **Preis EUR → CHF** (über `product_price_cache` falls vorhanden, sonst frisch + Aufschlag)
- **Metafelder** (Standard-Set):
  - `custom.material`
  - `custom.fit`
  - `custom.pflege`
  - `custom.herkunft`
  - `custom.saison`

### 4. Anlage als Draft in Shopify
- `shopify--create_product` mit `status: "draft"`
- Vendor = Brand
- Tags = Brand + Kategorie-Tag den du angibst (kein `sale`)
- Alle Bilder, Varianten, Preise, Metafelder gesetzt

### 5. Report nach jeder Kategorie
```text
Kategorie: hemden (Venti)
Gefundene URLs:    24
Bereits im Store:   3 (übersprungen)
Neu als Draft:     21
Fehlgeschlagen:     0

Drafts in Shopify Admin:
https://admin.shopify.com/.../products?status=draft
```

Du prüfst die Drafts, schaltest sie auf `Active` wenn ok, und wir gehen zur nächsten Kategorie.

## Was ich brauche jetzt

1. **Bestätigung** dass du im Shopify Admin alle aktuellen Produkte löschst (manuell, 0 Credits)
2. **Sag mir Bescheid wenn fertig**
3. **Erste Kategorie-URL** mit der wir starten

## Technische Notizen
- Edge Function `product-import-by-url` existiert bereits und kann erweitert werden, oder wir bauen eine neue, schlankere `category-draft-import` Function. Ich würde die bestehende Function mit einem `status: 'draft'` und `category_tag` Parameter erweitern — weniger Code, weniger Build-Credits.
- Cache (`product_price_cache`, `brand_season_products`) wird wiederverwendet wo möglich.
- Kein AI, kein Firecrawl-LLM-Modus, nur deterministische Extraktion.
