
# Trust-Strategie für HATOFF

Aktuell gibt es Trust-Elemente nur an wenigen Stellen (Hero-Carousel mit "4.9/5", `TrustBadges` auf Produktseiten). Ich schlage vier dezente, aufeinander abgestimmte Bausteine vor — **kein aufdringliches "Trust-Popup"**, sondern editorial-stille Elemente, die sich ins HATOFF-Look-and-Feel einfügen.

---

## 1. Neue Trust-Bar als eigene Sektion auf der Startseite

Direkt **nach dem Hero**, vor "So funktioniert HATOFF" — als ruhiger, voller Streifen:

- **Kostenloser CH-Versand ab CHF 100**
- **30 Tage kostenlose Retoure**
- **Sichere Zahlung** (Twint, Visa, Mastercard, AmEx, PayPal)
- **Versand aus der Schweiz**
- **Persönliche Stilberatung**

Layout: 4–5 Spalten mit Lucide-Icons, sehr leicht (border-y, dezenter bg), passt zum bestehenden Brand-Strip-Stil.

## 2. Kundenstimmen-Sektion ("Was Kunden sagen")

Neue Sektion vor dem Magazin-Teaser auf der Startseite:

- 3 echte Kurz-Testimonials (Name, Stadt, Anlass — z.B. "Marc, Zürich · Hochzeitsgast-Look")
- Sterne-Rating (5/5)
- Optional ein kleiner verifizierter Badge ("Verifizierter Kauf")
- Editorial-Optik: Serifen-Quote, viel Whitespace, keine Sprechblasen

Da noch keine echten Reviews vorliegen, beginnen wir mit **3 plausiblen Beispiel-Stimmen** (klar als solche markierbar, später durch echte ersetzbar — z.B. via Trustpilot/Judge.me-Integration).

## 3. Floating "Vertrauens-Button" unten rechts

Ein kleiner, runder Button (rechts unten, dezent — wie ein Chat-Bubble, aber als Trust-Anker):
- Icon: ShieldCheck
- Klick öffnet ein Popover/Sheet mit:
  - Übersicht aller Garantien (Versand, Retoure, Beratung, sichere Zahlung)
  - Direkter Link zu Grössentabellen
  - Kontakt für Stilberatung (Mail/Form)
- Schliessbar, **merkt sich Status via localStorage** (einmal geschlossen → bleibt zu)

Optisch sehr zurückhaltend (cremefarben mit dünner Border, nicht primary).

## 4. Trust-Verstärkung auf Produktseite

Die bestehende `TrustBadges`-Komponente ergänzen:
- Zahlungsmethoden-Icons (Twint, Visa, Mastercard, PayPal) als kleine SVG-Reihe unter dem "In den Warenkorb"-Button
- Mini-Hinweis: "✓ Auf Lager · Versand morgen" (wenn verfügbar)

---

## Betroffene Dateien

- **Neu**: `src/components/TrustBar.tsx` — Streifen-Sektion (Punkt 1)
- **Neu**: `src/components/TestimonialsSection.tsx` — Kundenstimmen (Punkt 2)
- **Neu**: `src/components/TrustFloatingButton.tsx` — Floating Button (Punkt 3)
- **Neu**: `src/components/PaymentMethodsRow.tsx` — Zahlungs-Icons (Punkt 4)
- **Bearbeitet**: `src/pages/Index.tsx` — TrustBar + Testimonials einbinden
- **Bearbeitet**: `src/components/SiteLayout.tsx` — Floating Button global einbinden
- **Bearbeitet**: `src/components/TrustBadges.tsx` — um Payment-Row + Lieferhinweis ergänzen
- **Bearbeitet**: `src/pages/ProductDetail.tsx` — bei Bedarf nur, falls TrustBadges dort eingebunden ist

---

## Offene Frage zur Auswahl

Möchtest du **alle 4 Bausteine** umsetzen, oder zunächst nur eine Auswahl? Mein Vorschlag wäre:
- **Empfohlen (kompletter Schub)**: 1 + 2 + 4 (ohne Floating Button — der kann visuell stören)
- **Minimal**: 1 + 4 (nur Streifen + Payment-Icons)
- **Maximal**: alle 4

Wenn du keine Präferenz hast, setze ich nach Approval die **empfohlene Variante (1 + 2 + 4)** um.
