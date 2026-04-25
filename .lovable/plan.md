## Problem
Im Shopify-Store sind noch **773 alte Produkte** (CASA MODA + VENTI), bei denen jede Farbe ein eigenes Produkt ist (z.B. "BEN Braun", "BEN Dunkelblau", "BEN Beige" = 3 Einträge für ein Hemd). Der vorherige "Purge" hat nicht funktioniert.

Wenn wir jetzt den Re-Import starten, würde er **305 neue gruppierte Produkte** zusätzlich zu den 773 alten anlegen → ca. 1'078 Produkte mit massiven Duplikaten.

## Lösung — 3 Schritte

### Schritt 1 — Purge-Funktion fixen & ausführen
- `supabase/functions/product-import-cleanup/index.ts` prüfen und sicherstellen dass sie:
  - Per Shopify Admin GraphQL **paginiert** alle Produkte auflistet (Cursor-basiert, nicht nur erste 250)
  - Nach `vendor:CASA MODA` und `vendor:VENTI` filtert
  - Jedes Produkt mit `productDelete` mutation löscht
  - Im Log-Output anzeigt wieviele gelöscht wurden
- Über Admin-Dashboard einen neuen **"Alle Produkte purgen"**-Button hinzufügen, der die Funktion aufruft und Live-Status zeigt
- Funktion ausführen → wartet bis 0 Produkte übrig sind

### Schritt 2 — Verifikation
- Mit `shopify--count_products` bestätigen dass Store leer ist (oder nur explizit gewünschte Produkte enthält)
- Erst danach weiter

### Schritt 3 — Re-Import starten
- `/admin/import` öffnen
- **Entdecken** klicken → erzeugt ~305 gruppierte Einträge in `product_import_log`
- **Dry Run = AUS**, **Start** klicken
- Worker läuft ~2h durch und legt 305 saubere Produkte mit Farb- + Grössen-Varianten an

## Was ich konkret umsetze
1. **Cleanup-Funktion review/fix** (`supabase/functions/product-import-cleanup/index.ts`) — Pagination + sauberes Löschen aller CASA MODA + VENTI Produkte
2. **Admin-UI erweitern** (`src/pages/AdminImport.tsx`) — neuer Button "🗑 Shopify komplett purgen" mit Bestätigungs-Dialog, Live-Counter und Erfolgs-Toast
3. **Discover/Worker unverändert lassen** — die Logik aus dem letzten Schritt ist bereits korrekt für Multi-Color-Produkte

## Was du danach machst
1. Auf `/admin/import` den **Purge**-Button klicken → wartet bis 0 Produkte übrig
2. **Entdecken** → **Start** (Dry Run aus) → ~2h warten

Soll ich loslegen?