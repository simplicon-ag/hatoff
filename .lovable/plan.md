## Ziel
Sobald neue Produkte importiert werden, entstehen automatisch passende **Looks (Sets)** als Drafts. Du prüfst sie im Admin und gibst sie frei — nur freigegebene Looks erscheinen auf `/looks`.

---

## 1. Datenbank — neue Tabelle `curated_looks`

Migration mit folgenden Spalten:
- `id uuid pk`, `slug text unique`, `title text`, `subtitle text`, `welt text`, `anlaesse text[]`
- `product_handles text[]` — die Set-Bestandteile (Anker zuerst)
- `anchor_handle text` — das auslösende Hauptstück (für Smart-Dedupe)
- `story text`, `highlights text[]`
- `hero_image_url text` — AI-generiertes Lifestyle-Bild (Storage)
- `status text` — `draft` | `published` | `rejected` (default `draft`)
- `created_at`, `updated_at`, `published_at`
- RLS: public kann nur `status='published'` lesen; alle Writes via Edge Function (service role)

Storage-Bucket `look-heroes` (public) für die generierten Hero-Bilder.

---

## 2. Edge Function `look-generate` (neu)

Wird **automatisch nach jedem erfolgreichen Produktimport** für das frisch importierte Produkt aufgerufen (fire-and-forget aus `product-import-run`, analog zum bestehenden Style-Inspirations-Trigger).

**Smart-Logik (kein Duplikat):**
1. Nur "Anker-Kategorien" lösen aus: Hemd, Hose/Chino/Jeans, Jacke/Blouson, Pullover. Polos/Shorts sind nur Begleiter.
2. Für den Anker fragt die Function alle bisherigen `curated_looks` ab, in denen er bereits enthalten ist.
3. Lädt Katalog-Slice (z.B. 50 passende Begleitstücke aus Shopify, gefiltert nach komplementärer Kategorie + Farbharmonie).
4. **Lovable AI** (`google/gemini-3-flash-preview`, structured output via tool-call) bekommt: Anker-Produkt + Katalog + bestehende Looks → schlägt **0–2 neue Sets** vor mit `{slug, title, subtitle, welt, anlaesse, product_handles, story, highlights}`. Der Prompt verlangt explizit "nur vorschlagen, wenn die Kombination signifikant von bestehenden Looks abweicht".
5. Pro vorgeschlagenes Set wird ein **Lifestyle-Hero** generiert via `google/gemini-2.5-flash-image` (Nano Banana) — Prompt enthält die Produktbilder + Setting (Café/Büro/Weekend je nach `welt`). Bild → Storage → URL.
6. Insert in `curated_looks` mit `status='draft'`.

**Trigger-Stelle:** In `supabase/functions/product-import-run/index.ts` wird nach dem bestehenden `triggerStyleInspirations`-Aufruf zusätzlich `triggerLookGeneration(handle, ...)` aufgerufen (non-blocking).

---

## 3. Admin-Review UI — neue Seite `/admin/looks`

Erweiterung der bestehenden Admin-Sektion:
- **Tab "Drafts"**: Grid aller `status='draft'` Looks mit Hero-Bild, Produktliste, Story.
  - Buttons pro Karte: **Freigeben**, **Verwerfen**, **Bild neu generieren**, **Story bearbeiten** (Inline-Editor).
- **Tab "Veröffentlicht"**: Liste der live Looks mit Option "Zurückziehen" / "Löschen".
- **Tab "Manuell erstellen"**: Form um händisch einen Look anzulegen (für Specials).

Edge Function `look-admin` für die Mutationen (publish/reject/regenerate-image/update).

---

## 4. Frontend — `/looks` & `/looks/:slug` umstellen

- `src/data/looks.ts` bleibt als **Fallback** (die 99 bestehenden kuratierten Looks).
- `Looks.tsx` & `LookDetail.tsx` & `Index.tsx` (FeaturedLook): laden DB-Looks (`status='published'`) + statische Looks, gemerged & nach `published_at` sortiert.
- Neuer Hook `useCuratedLooks()` der beide Quellen vereint und ein einheitliches `CuratedLook`-Interface zurückgibt.

---

## 5. Backfill für bereits importierte Produkte

Einmaliger Admin-Button **"Looks für alle Bestandsprodukte generieren"** auf `/admin/looks` → ruft `look-generate` für alle Produkte ohne bestehenden Anchor-Look auf (mit Throttling, ~2 sek Delay zwischen Calls). Läuft im Hintergrund, du siehst Progress.

---

## Zusammenfassung des Flows
1. Du importierst neues Hemd → Worker speichert in Shopify
2. Worker triggert `look-generate` (non-blocking)
3. AI prüft, schlägt z.B. 1 neuen Look vor ("Hemd + neue Casa-Moda-Chino in Sand")
4. Lifestyle-Hero wird generiert, alles als `draft` gespeichert
5. Du öffnest `/admin/looks` → siehst den Vorschlag → 1 Klick "Freigeben"
6. Look ist auf `/looks` live und im FeaturedLook-Karussell der Startseite

**Kostenkontrolle:** Smart-Dedupe verhindert Spam-Generierung; durchschnittlich ~30–40 neue Drafts bei 70 importierten Produkten erwartet.