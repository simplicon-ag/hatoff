## Ziel
Sale-Artikel raus, fehlende Produkte rein, geänderte aktualisieren — **mit minimalem Credit/Token-Verbrauch**.

## Wo ich Token spare
- **Kein Firecrawl auf Listing-Seiten** — die Marken-Sites liefern Produkt-URLs direkt via JSON (Casa Moda) bzw. plain HTML (Venti). Ich nutze ein einfaches Edge-Function-Skript mit `fetch`, kein Firecrawl, keine AI.
- **Kein Firecrawl-JSON-Schema-Modus** (der nutzt LLM intern und ist teuer). Stattdessen pro Detailseite: 1× HTML mit `fetch`, dann **deterministische Regex/Cheerio-Extraktion** (Title, Bilder, Grössen, Material, Beschreibung) — kostet 0 AI-Token.
- **Cache nutzen**: alles was bereits in `brand_season_products` und `product_price_cache` liegt, wird wiederverwendet, nicht neu gefetcht.
- **Diff-basiert**: Update nur wenn sich wirklich was geändert hat (Preis, Bilder, Title) — sonst skip.
- **AI als optionaler Fallback** nur für Felder, die per Regex nicht extrahierbar sind (z.B. uneinheitliche Material-Texte) — und nur falls du das überhaupt willst.

## Workflow

### Schritt 1 — Sale-Cleanup (0 AI-Token)
Lösche alle 850 Sale-Produkte via `shopify--delete_product` in Batches.
→ Kostet keine AI-Token, nur Shopify-API-Calls.

### Schritt 2 — Live-Discovery (0 AI-Token)
Direkter `fetch` der Listing-Endpoints beider Marken (Casa Moda JSON + Venti HTML), URL-Extraktion per Regex. Sale/Outlet-Slugs ausgeschlossen.
→ Resultat: deduplizierte Liste aller aktuell verkauften Handles.

### Schritt 3 — Diff gegen Store (0 AI-Token)
- `list_products` paginiert → bestehende Handles
- Vergleich Live vs. Store:
  - **Neu im Live** → anlegen
  - **Im Store + Live** → nur Detail-Crawl wenn Preis im Cache veraltet (>7 Tage)
  - **Im Store, nicht Live** → Liste für deine manuelle Prüfung

### Schritt 4 — Detail-Crawl nur wo nötig (0 AI-Token)
Pro neuem Produkt: 1× `fetch` auf Detail-URL, Cheerio/Regex-Extraktion:
- Title, Beschreibung, Bilder, Grössen → aus HTML/JSON-LD
- Preis → bereits in `product_price_cache` (CHF)
- Material/Fit/Pflege → aus Produkttext per Regex

Fallback bei nicht extrahierbaren Feldern: Feld leer lassen, du kannst es manuell ergänzen.

### Schritt 5 — Anlage/Update via Shopify API (0 AI-Token)
`shopify--create_product` / `update_product` mit allen Daten. Kein Sale-Tag.

### Schritt 6 — Report
- Gelöscht: X | Angelegt: Y | Aktualisiert: Z | Übersprungen: W

## Geschätzter Token-Verbrauch
- AI-Token: **~0** (deterministische Extraktion)
- Firecrawl-Credits: **0** (eigener fetch)
- Lovable-Build-Credits: standard für die Skript-Erstellung + Tool-Aufrufe (Sale-Löschung & Anlage sind Shopify-Tool-Calls, kein AI)

## Was ich brauche
Nur dein Go. Sage mir kurz:
1. Sale-Löschung jetzt starten? (850 Produkte, irreversibel)
2. Soll ich vorher eine **Trockenlauf-Liste** der ersten 20 zu löschenden Produkte zeigen?