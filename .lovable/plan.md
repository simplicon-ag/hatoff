## Problem
Der Worker bekommt von Shopify durchgehend `401: Invalid API key or access token`. Das Secret `SHOPIFY_ADMIN_API_TOKEN` ist abgelaufen, widerrufen oder gehört zu einem anderen Store. Im Trockenlauf merkst du das nicht (da läuft nur Firecrawl + DB), aber sobald der echte Import Produkte in Shopify anlegen will, scheitert jeder einzelne Aufruf — daher die vielen Errors.

## Schritt 1 — Token in Shopify generieren (manuell durch dich)

1. Öffne den Shopify-Admin: `https://admin.shopify.com/store/style-compass-6nrqi`
2. Gehe zu **Settings → Apps and sales channels → Develop apps**
3. Falls noch keine Custom-App existiert: Klick **"Create an app"**, nenne sie z.B. *"Lovable Product Importer"*
4. Klick auf die App → Tab **"Configuration"** → bei *Admin API integration* auf **"Configure"**
5. Folgende Scopes freigeben:
   - `write_products`
   - `read_products`
   - `write_product_listings`
6. **Save** klicken
7. Tab **"API credentials"** → **"Install app"** klicken
8. Den **Admin API access token** kopieren (beginnt mit `shpat_...`) — wird nur EINMAL angezeigt!

## Schritt 2 — Token via `add_secret` aktualisieren

Nach Plan-Genehmigung rufe ich `add_secret` auf und du fügst den Token im sicheren Eingabefeld für **`SHOPIFY_ADMIN_API_TOKEN`** ein. Der alte Wert wird überschrieben, alle Edge-Functions sehen den neuen Token sofort.

## Schritt 3 — Worker absichern (Code-Änderung)

In `supabase/functions/product-import-run/index.ts`:
- **Fail-fast Auth-Check**: Vor dem ersten Produkt einen Test-Request gegen `/admin/api/2025-07/shop.json` machen. Bei 401 sofort den Job auf `error` setzen mit Klartext-Meldung "Shopify-Token ungültig — bitte SHOPIFY_ADMIN_API_TOKEN aktualisieren". Verhindert dass 1006 Produkte als `error` geflaggt werden, nur weil der Token kaputt ist.
- **Token-Quelle loggen**: Beim Start loggen welches Secret gewählt wurde (`SHOPIFY_ADMIN_API_TOKEN` vs Fallback) — Debug-Hilfe für künftige Auth-Probleme.

## Schritt 4 — Stuck-Errors zurücksetzen & echten Import starten

Nach Token-Update führe ich automatisch aus:
- Reset aller `error`-Logs zurück auf `pending`
- Job-State auf `idle`

Du gehst dann auf `/admin/import`, schaltest **Trockenlauf AUS**, klickst **Start** — diesmal werden Produkte tatsächlich in Shopify angelegt.

## Was du jetzt tun musst
1. Token in Shopify generieren (Schritt 1 oben)
2. Plan genehmigen → ich frage den Token via `add_secret` ab und mache Schritte 3 + 4

<lov-actions>
<lov-link url="https://admin.shopify.com/store/style-compass-6nrqi">Shopify-Admin öffnen</lov-link>
</lov-actions>