## Ziel

Für die Looks, die du publishen willst, soll das Hero-Bild **exakt die zugewiesenen Produkte** zeigen — selbe Farbe, Stoff, Schnitt. Der Bild-Generator existiert schon (`generateHeroImage` in `look-generate`), aber es gibt keinen bequemen Weg, ihn gezielt für eine Auswahl von Looks erneut laufen zu lassen.

## Vorgehen

### 1. Auswahl-Pool definieren

Bevor wir anfangen, identifizieren wir den Publish-Pool — die ~60 Looks (10 pro Welt × 6 Welten), die am Ende live gehen. Auswahlkriterien wie zuvor besprochen:
- Hero-Bild vorhanden
- Diversität nach `anchor_handle` und `anlaesse`
- Bei hemden/abend/jacken: erst nach dem Auffüllen aus dem vorherigen Plan

Diese Auswahl wird **nicht sofort published** — wir setzen erst ein Marker-Feld bzw. arbeiten auf einer ID-Liste.

### 2. Bestehende Edge-Function `look-admin` erweitern: Bulk-Hero-Regenerate

`supabase/functions/look-admin/index.ts` bekommt eine neue Action `regenerate-heroes-bulk`:

- **Input**: `{ ids: string[] }` (Look-IDs)
- **Pro Look**:
  1. `product_handles` aus DB lesen
  2. Pro Handle das aktuelle Produktbild von Shopify holen (Storefront API)
  3. `generateHeroImage()` mit **strengerem Prompt** aufrufen — siehe unten
  4. Neues Bild in `look-heroes`-Bucket hochladen, alten Pfad ersetzen
  5. `hero_image_url` in DB updaten

Strengerer Prompt-Zusatz:
> "ABSOLUTE PRIORITY: Reproduce every visible garment from the reference images PIXEL-FAITHFULLY. Same colour saturation, same collar/cuff style, same buttons, same fabric texture, same pattern. If a piece is light blue linen, it must appear light blue linen — never white, never cotton. Treat the references as a hard constraint, the setting as decoration."

### 3. Skript: Bulk-Aufruf für den Publish-Pool

Ein One-Off-Skript ruft die neue Action für alle Look-IDs aus dem Pool auf:
- Sequentiell (nicht parallel — Lovable AI Image hat Rate-Limits)
- Throttle ~1.5 s zwischen Calls
- Logged Erfolg / Fehler pro Look in eine CSV in `/mnt/documents/` zur QA

### 4. QA-Stichprobe

Nach dem Lauf ziehen wir per `psql` 6-8 Looks (1 pro Welt + 2 zufällige), öffnen die neuen `hero_image_url`s und vergleichen visuell, ob die Stücke jetzt zu den Produkthandles passen. Falls eine Welt systematisch schlecht aussieht → Prompt-Tuning + nur diese Welt nochmal regenerieren.

### 5. Publishen

Erst nach erfolgreicher QA: `UPDATE curated_looks SET status='published', published_at=now() WHERE id IN (...)` für den Pool.

## Was passiert mit den restlichen Drafts?

Bleiben unverändert (alte Hero-Bilder, `status='draft'`). Du kannst sie später über `/admin/looks` einzeln regenerieren oder publishen.

## Technische Schritte (für Build-Phase)

1. **`look-admin/index.ts`**: neue Action `regenerate-heroes-bulk` mit `ids[]`-Validierung; nutzt vorhandene Storage-Upload-Logik aus `look-generate` (Funktion auslagern oder duplizieren)
2. **Prompt-Verschärfung** in `generateHeroImage` (oder neue Variante `generateHeroImageStrict`) — siehe Wortlaut oben
3. **Pool-Auswahl-SQL** + Speichern der ID-Liste in temporärer Tabelle oder direkt im Skript
4. **Bulk-Skript** (`/tmp/regen.ts`) das die Edge-Function pro ID aufruft, mit Throttle und CSV-Log nach `/mnt/documents/hero-regen.csv`
5. **QA-Skript**: SQL-Sample, Hero-URLs in eine HTML-Vorschau nach `/mnt/documents/qa.html` schreiben
6. **Publish-SQL** nach Freigabe

## Kosten / Dauer

- ~60 Looks × 1 Bildgenerierung = 60 Lovable-AI-Image-Calls
- ~1.5 s Throttle → grob 2-3 Minuten Edge-Function-Laufzeit, plus Bildgenerierungszeit pro Call (~5-10 s) → real ~10-15 Minuten
- Storage-Impact minimal (Hero-Bild pro Look ist ~200-500 KB)

## Was du danach hast

- 60 Looks im Publish-Pool, deren Hero-Bilder die zugewiesenen Produkte korrekt zeigen
- Wiederverwendbare Bulk-Regenerate-Action im `look-admin` für künftige Korrekturen
- QA-Vorschau-HTML als Beleg, dass die Bilder passen
