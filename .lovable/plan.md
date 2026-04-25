# Preise wirklich korrigieren

## Aktueller Stand (verifiziert)

Cache-Status Casa Moda: 26 `ok`, 64 `fallback`, **147 `mismatch`**, 1 `not_found`.

**Du bist gerade auf `/product/casa-moda-polo-shirt-ivory`.** DB-Eintrag:
- `status = 'mismatch'` ✅ (durch Audit korrekt markiert)
- `on_sale = true, display = 39.95, original = 79.95` ❌ (falscher Preis steht aber noch im Cache)

→ Die UI zeigt trotzdem den falschen Sale, weil die Edge-Function den `mismatch`-Status beim Lesen nicht filtert.

## Zwei offene Bugs

**Bug 1:** `supabase/functions/product-price/index.ts` Zeile 258–280 — der Cache-Read gibt jeden Eintrag innerhalb der TTL zurück, egal ob `status='ok'`, `'fallback'` oder `'mismatch'`. Die Audit-Markierung wird ignoriert.

**Bug 2:** Beim Re-Scrapen (TTL abgelaufen oder force) gibt es keinen Bild-Vergleich → derselbe falsche URL wird wieder gecached.

## Schritt 1 — Mismatch-Filter (löst sofort das UI-Problem)

In `product-price/index.ts`:
- Cache-Lese-Schleife: wenn `c.status === 'mismatch'` → Eintrag ignorieren.
- Stattdessen direkt Shopify-Fallback zurückgeben (`status='fallback'`, `on_sale=false`) **ohne** `upsert` (sonst geht die Mismatch-Markierung verloren).

Effekt: Polo Shirt Ivory + die 146 anderen Mismatches zeigen sofort den Shopify-Standardpreis ohne falsches Sale-Badge.

## Schritt 2 — Bild-Match-Schutz vor neuem Cache-Eintrag

In `product-price/index.ts`:
- `firecrawlScrape` zusätzlich Produktbild aus dem Casa-Moda-Markdown extrahieren (erstes `images.casamoda.com`-Bild).
- Body-Payload erweitern um `shopifyImages: Record<handle, imageUrl>`.
- Vor `upsert`: dHash-Vergleich (9×8 Graustufen, 64-Bit-Hash via `imagescript` aus deno.land/x). Hamming-Distanz ≤ 12 = Match.
- Kein Match → `status='mismatch'` speichern statt `'ok'`.

## Schritt 3 — Hook + Aufrufer Shopify-Bild mitschicken

`src/hooks/useLivePrice.ts`: Signatur `useLivePrice(handle, shopifyImage?)` und `useLivePrices(handles, shopifyImages?)`. Body-Payload um `shopifyImages` ergänzen.

Aufrufer aktualisieren: `ProductCard.tsx`, `ProductDetail.tsx`, `LookSetBuilder.tsx`, `AiStyleGenerator.tsx` → `primary?.url` mitgeben.

## Schritt 4 — Verifikation

- Polo Shirt Ivory neu laden → erwartet: kein Sale-Badge, Shopify-Standardpreis.
- Stichprobe 3 weitere Mismatch-Handles aus dem Cache.
- Ein sauberer `ok`-Handle muss weiterhin korrekten Sale zeigen.

## Nicht geändert
- Keine DB-Migrationen.
- 26 `ok` + 64 `fallback`-Einträge bleiben.
- Venti unberührt.