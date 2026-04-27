## Wichtiger Hinweis vorab

**Fake-Bewertungen baue ich nicht ein.** Erfundene Reviews verstossen in der Schweiz gegen das UWG (Art. 3) und in der EU gegen die Omnibus-Richtlinie / DSA — beides kann zu Abmahnungen, Bussen und Reputationsschäden führen. Für eine Premium-Brand wie Hatoff wäre das ein echter Risiko-Faktor und würde dem Trust-Konzept widersprechen, das wir gerade aufgebaut haben.

**Stattdessen** baue ich einen eleganten Empty-State mit klarer Botschaft (»Nur verifizierte Käufer können bewerten — sei der/die Erste«), der von Anfang an Vertrauen schafft. Sobald echte Kunden bewerten, füllt sich die Sektion organisch.

---

## Was ich umsetzen werde

### 1. Datenbankstruktur (neue Migration)

**Tabelle `product_reviews`**
- `id` (uuid, pk)
- `product_handle` (text) — Verknüpfung zum Shopify-Produkt
- `user_id` (uuid → auth.users) — eingeloggter Käufer
- `rating` (int, 1–5) — Sternewertung
- `title` (text, max 80 Zeichen) — kurze Headline
- `body` (text, max 1000 Zeichen) — Freitext
- `size_purchased` (text, optional) — gewählte Grösse
- `size_fit` (enum: 'small' | 'true' | 'large') — »Fällt aus wie…«
- `would_recommend` (boolean) — Weiterempfehlung
- `verified_purchase` (boolean, default false) — von Edge Function gesetzt
- `shopify_order_id` (text) — Referenz zur Bestellung
- `status` (text: 'pending' | 'published' | 'rejected')
- `created_at`, `updated_at`

**RLS-Policies**
- Public: SELECT nur wo `status = 'published'`
- Authenticated: INSERT nur eigene Reviews (mit `auth.uid() = user_id`)
- Authenticated: UPDATE/DELETE nur eigene Reviews

**View `product_review_stats`** (für schnelle Aggregation)
- `product_handle`, `avg_rating`, `count`, `count_5`, `count_4`, … `count_1`

### 2. Edge Function: `review-verify-purchase`

Prüft via Shopify Admin API, ob der eingeloggte User das Produkt tatsächlich gekauft hat:
1. Liest E-Mail des authentifizierten Users
2. Query an Shopify: `orders.json?email=...&status=any`
3. Sucht in `line_items` nach passendem `product_handle`
4. Bei Treffer: setzt `verified_purchase = true` und speichert `shopify_order_id`
5. Bei Treffer: Review geht direkt auf `status = 'published'`
6. Ohne Kauf: Review wird abgelehnt mit klarer Meldung

### 3. UI-Komponenten

**`src/components/reviews/ProductReviews.tsx`** — Hauptsektion auf der PDP
- Zusammenfassung oben: ⭐ Durchschnitt, Anzahl Reviews, Verteilungsbalken (5★ bis 1★)
- Liste der veröffentlichten Reviews (Avatar/Initialen, Name, Datum, »Verifizierter Kauf«-Badge, Sterne, Titel, Text, Grösse + Passform)
- Filter/Sortierung: Neueste, Beste, Schlechteste, Mit Bild
- **Empty-State** (initial — keine Reviews): Editorial-Card mit Text:
  > »Noch keine Bewertungen. Bei Hatoff kann nur bewerten, wer das Produkt tatsächlich gekauft hat — so bleibt jede Stimme echt. Sei der/die Erste.«

**`src/components/reviews/ReviewForm.tsx`** — Bewertungsformular (Dialog)
- Sterne-Auswahl (1–5, Pflicht)
- Titel (Pflicht, max 80)
- Freitext (Pflicht, mind. 30, max 1000)
- Grösse (Dropdown aus Produktvarianten)
- Passform (Radio: »Fällt klein aus / Passt genau / Fällt gross aus«)
- Weiterempfehlung (Switch)
- Submit → Edge Function → Verifizierung → Toast

**`src/components/reviews/RatingStars.tsx`** — wiederverwendbare Sterne-Anzeige

### 4. Trust-Hinweis (transparent)

Direkt über dem Bewertungsbereich ein dezenter Info-Hinweis:
> 🛡️ **Verifizierte Bewertungen** — Bei Hatoff können nur Kund:innen bewerten, die den Artikel auch gekauft haben. Wir prüfen jede Bewertung gegen unsere Bestellhistorie.

### 5. Validierung & Sicherheit

- **Zod-Schema** für Client-Validierung (Länge, Range, Pflichtfelder)
- **Server-Side**: Edge Function validiert nochmals
- **Rate Limiting**: max. 1 Review pro User pro Produkt (Unique Constraint auf `(user_id, product_handle)`)
- Auth-Check vor Submit; nicht eingeloggte User sehen Login-Prompt
- Keine HTML-Injection (Plain Text only, kein dangerouslySetInnerHTML)

### 6. PDP-Integration

In `src/pages/ProductDetail.tsx` direkt nach dem `TrustBadges`-Block und vor `YouMightAlsoLike` eingefügt. Im Titelbereich oben rechts wird zusätzlich der Durchschnittsstern + Anzahl angezeigt (verlinkt zur Sektion).

---

## Dateien (geplant)

**Neu:**
- `supabase/migrations/<timestamp>_product_reviews.sql`
- `supabase/functions/review-submit/index.ts` (Verifizierung + Insert)
- `src/components/reviews/ProductReviews.tsx`
- `src/components/reviews/ReviewForm.tsx`
- `src/components/reviews/RatingStars.tsx`
- `src/components/reviews/ReviewSummary.tsx`
- `src/hooks/useProductReviews.ts`

**Geändert:**
- `src/pages/ProductDetail.tsx` (Sektion einbinden + Stern-Summary im Header)

---

## Was du noch wissen solltest

- **Bestehende Käufe vor Launch**: Da Bestellungen über Shopify laufen, funktioniert die Verifizierung sofort für alle Kunden, deren E-Mail in Hatoff-Auth mit der Shopify-Bestell-E-Mail übereinstimmt.
- **Moderation**: Reviews gehen direkt live, sobald verifiziert. Falls du später Moderation willst (Freischalten via Admin), können wir `status = 'pending'` als Default setzen.
- **Bilder-Uploads**: bewusst weggelassen für V1, kann später ergänzt werden (Storage-Bucket).
- **E-Mail-Trigger** (»Wie war dein Hemd?« 14 Tage nach Lieferung) wäre ein logischer Next Step — kann nach diesem Sprint folgen.
