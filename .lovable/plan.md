## Ausgangslage

Beim Polo-Shirt 993106500 hat Casa Moda **15 Farben in einem einzigen Artikel** — der Importer macht das schon richtig: Alle Farb-URLs werden gruppiert und als **EIN Shopify-Produkt mit Varianten** (`option2: Farbe`) angelegt. Auf der Detail-Seite (`ProductDetail.tsx`) werden die Farben aktuell aber nur als **Text-Buttons** ("Schwarz", "Marine", "Rot"…) gerendert — ohne Bild, ohne automatischen Bildwechsel.

Zusätzlich erwähnst du: derselbe Artikel existiert manchmal **zweimal als getrennte Produkte** (einmal "Sale", einmal "Neu") — das sind in Shopify aber zwei verschiedene Produkte mit unterschiedlichen Handles, weil Casa Moda sie unter zwei URLs führt. Diese müssen wir **cross-verlinken**, damit der Kunde aus der Sale-Variante zur Neu-Variante (oder umgekehrt) springen kann.

## Was ich ändere

### 1. Farb-Swatches mit Produktbild (statt Text-Buttons)
**Datei:** `src/pages/ProductDetail.tsx`

Wenn die Option `Farbe` heisst:
- Statt eckige Text-Buttons → **runde/quadratische Bild-Swatches** wie auf casamoda.com (kleines Produktbild der jeweiligen Farbe)
- Zuordnung Farbe → Bild über `images[].altText` oder die Bild-Reihenfolge (Importer hängt Bilder pro Farbe in Reihenfolge an)
- Bei Klick auf eine Farbe: 
  - `selectedVariantId` wechselt
  - **Hauptbild + Galerie** scrollen automatisch zum ersten Bild dieser Farbe
  - Preis aktualisiert sich (eine Farbe kann SALE sein, andere nicht — Shopify-Variant hat eigenen `price` + `compareAtPrice`)
- Andere Optionen (Grösse) bleiben als Text-Buttons

### 2. Bilder pro Farb-Variante korrekt zuordnen
**Datei:** `supabase/functions/product-import-run/index.ts`

Aktuell werden alle Bilder gemeinsam als Produkt-Bilder hochgeladen. Ich ergänze:
- Pro Farb-Variante wird das **erste Bild dieser Farbe** über `attachImageToVariants(productId, imageUrl, [variantId])` an die Varianten-IDs gebunden (Funktion existiert schon in der Datei).
- Dadurch kennt Shopify die Farbe→Bild-Zuordnung → das Frontend kann beim Variant-Switch automatisch das richtige Bild anzeigen.

### 3. Cross-Linking "Sale"-Produkt ↔ "Neu"-Produkt
**Datei:** `supabase/functions/product-import-run/index.ts` + `src/pages/ProductDetail.tsx`

Wenn derselbe `articleId` (z.B. `993106500`) in **zwei Shopify-Produkten** landet (eins aus `/sale/`, eins aus `/neuheiten/`):
- Beim Anlegen wird im **Shopify-Tag** `related-article:993106500` gesetzt
- Auf der PDP fragen wir per Storefront-API alle Produkte mit demselben Tag ab
- Falls > 1 Treffer → Block **"Auch erhältlich als"** mit Verlinkung (z.B. "→ Diesen Artikel als Neuheit ansehen" / "→ Im Sale ansehen")
- Badge `SALE` / `NEU` jeweils sichtbar

### 4. Sale-Badge & Compare-At-Preis sichtbar
**Datei:** `src/pages/ProductDetail.tsx` + `src/components/ProductCard.tsx`

Wenn `compareAtPrice > price` der gewählten Variante:
- Roter **SALE**-Badge oben links auf dem Hauptbild
- Alter Preis durchgestrichen + neuer Preis in Akzentfarbe (wie im Screenshot)
- Im ProductCard: Badge "NEU" wenn Tag `neu` vorhanden, "SALE" wenn `compareAtPrice > price`

## Was ich NICHT ändere

- Der Importer-Flow bleibt wie er ist (Discover → Group by articleId → Run scrapt alle Farben → erstellt EIN Produkt pro Artikel)
- Bestehende importierte Produkte bekommen die Bild→Variante-Zuordnung **beim nächsten Update-Run** (du hast Update-Mode an)

## Offene Punkte / Annahmen

- **Farb-Bild-Zuordnung**: Die Reihenfolge der Bilder pro Farbe ist im Scraper deterministisch (erst Farbe A alle Bilder, dann Farbe B). Ich nutze das + `imgix`-URL-Muster `/product/{articleId}/{colorId}/...` um Bilder dem Variant zuzuordnen.
- **"Sale" vs "Neu" als getrennte Produkte**: Falls du das vermeiden willst, könnten wir alternativ den Discover so ändern, dass Sale + Neu desselben `articleId` zu **einem** Produkt mit Tags `sale` UND `neu` zusammenfallen. Das wäre sauberer als Cross-Linking. **Möchtest du das stattdessen?** → Sag Bescheid, dann passe ich Punkt 3 entsprechend an.

## Aufwand
~30 Min Implementation, keine DB-Migration nötig.