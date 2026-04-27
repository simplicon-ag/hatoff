## Ziel

Den Store auf das nächste Level heben — in 5 klaren Phasen, damit nach jedem Schritt etwas Sichtbares da ist und du Feedback geben kannst, bevor wir tiefer gehen.

Reihenfolge nach Impact: erst der lebendige Hero (Quick Win, dein Ärgernis), dann Conversion-Hebel, dann Loyalty echt, dann Look-Erlebnis, dann Polish.

---

## Phase 1 — Lebendiger Homepage-Hero ✨ (dein Quick Win)

Statt eines statischen Bildes ein editorial **Hero-Carousel** mit 3 Slides, die zwischen Look-Welten wechseln (Auto-Play 6 s, manuell per Pfeil/Dot-Indikatoren). Subtile Ken-Burns-Bewegung (langsamer Zoom) auf jedem Bild. Headline und CTA bleiben fix, nur der Untertitel-Eyebrow ändert sich pro Slide ("Für's Büro" → "Weekend" → "Date Night"). Plus: dezenter **Live-Counter** unter den Trust-Badges („3 neue Looks diese Woche") gespeist aus `useCuratedLooks`.

**Dateien:**
- `src/pages/Index.tsx` — Hero-Section umbauen
- `src/components/HeroCarousel.tsx` (neu) — nutzt embla (bereits via `carousel.tsx` da)
- 2 zusätzliche Hero-Bilder via AI generieren

---

## Phase 2 — Conversion-Hebel

### 2a) Echte Wunschliste
Tabelle `wishlist_items` (user_id, product_handle, created_at). RLS: User sieht nur eigene. Herz-Button auf `ProductCard` & `ProductDetail` togglet echten Eintrag. Neue Seite `/club/wunschliste` (geschützt) zeigt gespeicherte Stücke. Im Header-User-Menü Link dorthin. Für nicht-eingeloggte User: Toast „Logge dich ein, um zu speichern" mit CTA zu `/auth`.

### 2b) Quick-View Modal auf Produktkarten
Zweiter Button in der Hover-Aktion (neben „In den Warenkorb"): „Schnellansicht" → öffnet Dialog mit Galerie-Slider, Größenwahl, Farbwahl, Preis, Add-to-Cart — ohne die Listing-Seite zu verlassen. Spart 1 Klick auf jedem Produkt.

### 2c) Aktive Filter-Chips im Shop
Über dem Produkt-Grid auf `/shop` eine Reihe Chips, die jeden aktiven Filter zeigen (z. B. „Farbe: Cognac ✕", „Marke: Casa Moda ✕"). Klick entfernt einzeln. Plus „Alle zurücksetzen". Macht den aktuellen Zustand transparent — User filtert mutiger.

### 2d) Sticky Add-to-Cart auf Mobile (Produktseite)
Beim Scrollen auf `/product/:handle` erscheint unten ein schmaler Sticky-Bar mit Mini-Bild, Preis, „In den Warenkorb"-Button. Nur Mobile (`md:hidden`). Verschwindet wenn der echte CTA im Viewport ist (IntersectionObserver).

**Dateien:**
- Migration: `wishlist_items` Tabelle + RLS
- `src/hooks/useWishlist.ts` (neu)
- `src/components/ProductCard.tsx`, `src/pages/ProductDetail.tsx` — Wunschlist-Button echt machen
- `src/pages/ClubWishlist.tsx` (neu) + Route in `App.tsx`
- `src/components/QuickViewDialog.tsx` (neu)
- `src/pages/Shop.tsx` — Active-Filter-Chips
- `src/components/StickyAddToCart.tsx` (neu) → in `ProductDetail.tsx`

---

## Phase 3 — Loyalty echt machen

### 3a) Punkte gegen Rabatt-Code einlösen
Neue Sektion auf `/club/mein-konto` „Belohnungen": 3 Stufen-Coupons:
- 200 Punkte → 10 CHF Rabatt-Code
- 500 Punkte → 30 CHF Rabatt-Code  
- 1000 Punkte → 75 CHF Rabatt-Code

„Einlösen"-Button ruft Edge Function `club-redeem` auf, die:
1. Punkte-Saldo prüft (via `get_my_points()`)
2. Über Shopify-Tools einen einmaligen Discount-Code generiert (Format `HATOFF-CLUB-XXXX`, einmal verwendbar, an User-Email gebunden via Note)
3. Punkte über `add_club_points(-X, 'redeemed_reward')` abzieht
4. Code in neue Tabelle `club_rewards` schreibt (user_id, code, value_chf, redeemed_at, used_at)

User sieht aktive Codes mit Copy-Button.

### 3b) Refer-a-Friend
Auf `/club/mein-konto` ein eindeutiger Empfehlungslink (z. B. `/?ref=ABC123`). Wenn neuer User mit `?ref=` kommt und sich registriert: 50 Punkte für Werber, 50 für neuen User. Speicherung in `profiles.referral_code` (Spalte ergänzen) und `profiles.referred_by`.

### 3c) Geburtstags-Bonus
Im Profil-Editor `birthday`-Feld bereits vorhanden. Edge Function `club-birthday-check` (manuell triggerbar, später Cron): vergibt am Geburtstag 100 Punkte mit reason `birthday_YYYY`. Verhindert Doppel-Vergabe pro Jahr via reason-Check.

**Dateien:**
- Migration: `club_rewards` Tabelle, `profiles.referral_code` & `referred_by`, RLS
- Edge Functions: `club-redeem`, `club-birthday-check`, `club-referral` (Trigger bei Signup)
- `supabase/functions/club-redeem/index.ts` nutzt `shopify--create_price_rule` + `shopify--create_discount_code` über Admin-Token
- `src/components/club/RewardsCatalog.tsx` (neu)
- `src/components/club/ReferralCard.tsx` (neu)
- `src/pages/ClubAccount.tsx` — neue Sektionen einbinden
- `src/pages/Auth.tsx` — `?ref=`-Param auswerten, in user_metadata speichern
- `handle_new_user`-Trigger erweitern: bei `referred_by` 50 Punkte beidseitig

---

## Phase 4 — Look-Erlebnis aufwerten

### 4a) Editorial Hero auf `/looks`
Aktuell nur „Komplette Looks, kuratiert für dich" + Filter-Pills. Neu: Großes Hero-Spotlight oben mit dem ersten Look (riesiges Bild, Titel im Editorial-Stil, „Look ansehen"-CTA). Drunter ein zweites kleineres Block: **„Look der Woche"** mit Story-Text. Erst danach das Grid.

### 4b) Sticky „Komplettes Outfit kaufen" auf Look-Detail
Auf `/looks/:slug` ein Sticky-Bar unten (Desktop & Mobile) mit „4 Stücke · CHF 487 — Ganzer Look in den Warenkorb". Aktion fügt alle Look-Produkte mit Default-Variante in einem Schwung hinzu (existierende `addItem`-Schleife). Großer emotionaler Hebel.

### 4c) „Ähnliche Stimmung"
Unter jedem Look-Detail: 3 Looks aus derselben `welt`, exklusive aktueller. Hält User im Look-Universum.

**Dateien:**
- `src/pages/Looks.tsx` — Hero-Sektion
- `src/pages/LookDetail.tsx` — Sticky-Buy-Bar + verwandte Looks
- `src/components/LookBuyBar.tsx` (neu)

---

## Phase 5 — Polish & Trust

### 5a) Skeleton-Loaders
Statt „Produkte werden geladen …" → Grid aus 6 grauen Skeleton-Karten (animate-pulse). Wirkt sofort professioneller. Auf `/shop`, `/looks`, `/neuheiten`, `/sale`, Homepage-Sections.

### 5b) Newsletter-Popup mit 10 %-Incentive
Einmalig nach 15 s oder beim Exit-Intent (Mausbewegung Richtung Browser-Schließen) — Modal mit „10 % auf deine erste Bestellung — sichere dir den Stilbrief". Ablehnung speichert Cookie für 30 Tage. Bei Eintragung: Edge Function generiert einen einmaligen Discount-Code (gleicher Mechanismus wie Loyalty), schickt per E-Mail (Resend, falls verfügbar — sonst direkt im Modal anzeigen + Copy). Footer-Newsletter-Form bekommt denselben Mechanismus, aber ohne Popup-Druck.

### 5c) Footer rechtlich
- `/impressum`, `/datenschutz`, `/agb` als echte Seiten anlegen (Platzhalter-Texte mit Hinweis „bitte anpassen")
- Footer-Links darauf umstellen
- Cookie-Banner (minimal, kein Cookiebot — nur einfacher Hinweis mit Akzeptieren/Ablehnen, lokaler State, kein Tracking-Block weil aktuell keine Tracker im Code)

### 5d) Reviews-UI (leer, ehrlich)
Auf `ProductDetail` neuer Tab/Akkordeon „Bewertungen": leere Sterne-UI + „Noch keine Bewertungen — sei der Erste". **Keine Fake-Reviews** (Policy). Karten bleiben ohne Sterne, bis echte Daten da sind. Vorbereitung für späteres Reviews-System (z. B. nach erstem Order-Webhook).

**Dateien:**
- `src/components/ui/ProductCardSkeleton.tsx`, `LookCardSkeleton.tsx` (neu) + Einbau in alle Listing-Pages
- `src/components/NewsletterPopup.tsx` (neu) → in `SiteLayout.tsx`
- `supabase/functions/newsletter-signup/index.ts` (neu)
- `src/pages/Impressum.tsx`, `Datenschutz.tsx`, `Agb.tsx` (neu)
- `src/components/CookieBanner.tsx` (neu)
- `src/components/ProductDescription.tsx` oder neuer `ReviewsSection.tsx`
- `src/components/SiteFooter.tsx` — Links anpassen

---

## Was wir NICHT tun (bewusst)

- **Bottom-Tab-Bar Mobile** — abgelehnt
- **Fake-Reviews** — Policy
- **Sale-Counter / „X Personen schauen"** — wirkt billig, passt nicht zur Editorial-Brand
- **Cookiebot/echtes Tracking** — kein Bedarf solange keine Tracker drin sind

---

## Reihenfolge & Stop-Punkte

Ich liefere **Phase 1 als Ersten Schritt** (Hero-Carousel + 2 generierte Bilder + Live-Counter). Sobald das steht und du es dir angeschaut hast, geht's mit Phase 2 weiter. So musst du nicht 2 Stunden warten, bis du etwas siehst, und kannst nach jeder Phase noch umsteuern.

Rough Aufwand (Code-Volumen): Phase 1 klein · Phase 2 groß · Phase 3 groß (Edge Functions + Shopify Discount API) · Phase 4 mittel · Phase 5 mittel.

**Bestätige den Plan und ich starte mit Phase 1.** Falls du eine andere Reihenfolge willst (z. B. erst Loyalty, dann Hero) sag Bescheid — alles modular.