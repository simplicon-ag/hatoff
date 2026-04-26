## Ausgangslage

- **`look-generate`** (Edge Function) ist bereits fertig: bekommt einen `productHandle`, prüft ob es ein "Anker"-Produkt ist (Hemd / Hose / Jacke / Pullover / Sakko), schaut welche Looks dazu schon existieren, und erstellt 0–2 NEUE Draft-Looks inkl. KI-generiertem Hero-Bild.
- **Bulk-Import** (`product-import-run`) ruft `look-generate` automatisch nach jedem neuen Produkt auf ✅
- **Einzel-URL-Import** (`product-import-by-url`) ruft `look-generate` aktuell **nicht** auf ❌
- In **`/admin/looks`** gibt es nur einen globalen "Backfill"-Button (langsam, alle Produkte) — keinen gezielten Trigger pro Handle.

Drafts landen in der „Drafts"-Tab von `/admin/looks` und müssen dort freigegeben werden, bevor sie öffentlich erscheinen.

## Was wird umgesetzt

### 1. Auto-Trigger beim Einzel-URL-Import
In `supabase/functions/product-import-by-url/index.ts` nach erfolgreichem Create/Update einen **Fire-and-Forget-Call** an `look-generate` mit dem Shopify-Handle hängen — analog zu `product-import-run`. Nicht blockierend, damit der Import-Response schnell bleibt. Im Erfolgs-Response ein Feld `look_generation_triggered: true` zurückgeben.

### 2. UI-Feedback in `AdminImport.tsx`
Nach Single-URL-Import zusätzlich anzeigen: *„Look-Vorschläge werden im Hintergrund generiert. In ~30 Sek. unter /admin/looks prüfen."* mit direktem Link in den Drafts-Tab.

### 3. Manueller Trigger in `/admin/looks`
Im **Manual-Tab** ein neues Eingabefeld + Button:
- **„Looks für ein einzelnes Produkt generieren"**
- Input: Produkt-Handle (z.B. `casa-moda-freizeithemd-kurzarm-14843`)
- Button ruft `look-generate` mit diesem Handle auf, mit Option `force: true` (für Re-Generierung trotz vorhandener Looks)
- Toast-Feedback inkl. Anzahl erzeugter Drafts (Response-Feld `created`)

### 4. „Looks generieren"-Button auf Produktdetailseite (Admin-Komfort)
Optional, aber wertvoll: Auf `/product/:handle` einen **dezenten Admin-Knopf** ergänzen (nur sichtbar, wenn URL `?admin=1` enthält oder via lokalem Flag), der das gleiche `look-generate`-Edge-Function aufruft. So kannst du beim Stöbern direkt für einzelne Bestandsprodukte Looks anstoßen, ohne die Handle abtippen zu müssen.

## Nicht-Ziele
- Wir ändern die Look-Generierungs-Logik selbst nicht (Anker-Kategorien, KI-Prompt, Hero-Bild bleiben wie sie sind).
- Auto-Publishing: Looks bleiben **Drafts** und müssen wie bisher in `/admin/looks` freigegeben werden — das verhindert qualitativ schlechte oder doppelte Looks im Live-Shop.

## Ergebnis nach Umsetzung

| Szenario | Was passiert |
|---|---|
| Bulk-Import läuft | Looks werden automatisch generiert (wie bisher) ✅ |
| Einzel-URL-Import via Admin | Looks werden **automatisch** im Hintergrund generiert (neu) ✅ |
| Bestehendes Produkt, Looks fehlen | Handle in `/admin/looks` → Manual-Tab eingeben → Button (neu) ✅ |
| Bestehendes Produkt auf Detailseite | „Looks generieren"-Admin-Button (neu, optional) ✅ |
| Backfill für alle | Bestehender Button weiterhin verfügbar ✅ |

Alle generierten Looks landen als **Drafts** und werden erst nach deiner Freigabe veröffentlicht.