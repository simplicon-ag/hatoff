## Ziel
Die Produktdetailseite (`src/pages/ProductDetail.tsx`) bekommt unterhalb des bestehenden Inhalts vier neue Abschnitte in dieser Reihenfolge:

1. **Style-Ideen** — 3 inspirierende Outfit-Bilder ("So trägst du es")
2. **Style mit diesem Stück** (existiert bereits als `AiStyleGenerator` — bleibt) → wird ggf. leicht im Layout angepasst
3. **Das könnte dir auch gefallen** — automatische Produktempfehlungen
4. **Club-Member werden** — CTA-Banner mit Vorteilen

---

## 1. Style-Ideen (neue Komponente `StyleInspirations`)

**Was:** Ein redaktioneller Block mit 3 Bildern, die zeigen, mit welchen Stilen / Anlässen das Produkt getragen werden kann (z.B. "Im Office", "Am Wochenende", "Für den Abend"). 

**Warum AI-generiert klingt verlockend, aber:** Bildgenerierung pro Produktaufruf wäre zu langsam und teuer. Stattdessen:

**Ansatz:** Statische, kuratierte Inspirations-Bilder pro **Produktkategorie** (Hemd, Polo, Hose, Sakko, Pullover, …). Die Komponente erkennt anhand von `productType` + `tags` + `title` die Kategorie (gleiche Logik wie schon im AI-Stylist-Gate verwendet) und zeigt die passenden 3 Bilder + Titel.

- Bilder werden als statische Assets in `src/assets/style-inspirations/` abgelegt (z.B. `hemd-1.jpg`, `hemd-2.jpg`, `hemd-3.jpg`, `polo-1.jpg`, …). Wir generieren sie einmalig per AI-Bildgenerierung im Build-Schritt (über das `ai-gateway`-Skript) und committen sie.
- Pro Kategorie ein kurzer Titel + Beschreibung pro Bild ("Klassisch zum Anzug", "Lässig mit Jeans", "Layered im Herbst").
- Layout: Grid mit 3 Spalten (Desktop), gestapelt mobil, im `container-editorial`, mit Top-Border wie die anderen Sections.
- Fallback: Wenn keine Kategorie matched → Section wird nicht gerendert.

**Datei-Struktur:**
- `src/data/styleInspirations.ts` — Mapping `category → { images: string[], captions: string[] }`
- `src/components/StyleInspirations.tsx` — Komponente
- `src/assets/style-inspirations/*.jpg` — Bilder (einmalig generiert)

---

## 2. Style mit diesem Stück (bestehend, keine Änderung)

Der `AiStyleGenerator` bleibt wie er ist und rückt in der Reihenfolge **nach** den Style-Ideen.

---

## 3. „Das könnte dir auch gefallen" (neue Komponente `YouMightAlsoLike`)

**Was:** Automatische Produktempfehlungen basierend auf dem aktuellen Produkt — **kein** AI-Call (zu langsam für jeden Pageview), sondern eine smarte Heuristik über die Storefront-API:

**Logik (in dieser Reihenfolge, bis 4 unique Produkte gefunden):**
1. Gleicher `productType` (z.B. "Hemd") + andere Marke → Cross-Brand-Vorschläge
2. Gleicher Stil-Tag (sucht im Tag-Array nach `stil:*`, `anlass:*`, `saison:*`)
3. Gleiche Preisklasse (±30%) + ähnlicher `productType`
4. Auffüllen mit beliebten Produkten (z.B. neueste mit Tag `neu`)

Aktuelle Karte ausschliessen, ebenso Produkte die schon in `related` (gleicher Vendor, oben) gezeigt werden, um Doppelungen zu vermeiden.

**Layout:** Identisch zum bestehenden „Mehr von {vendor}"-Grid (4 Spalten Desktop, `ProductCard`).

**Datei:** `src/components/YouMightAlsoLike.tsx` — nutzt `fetchProducts` mehrfach mit unterschiedlichen Queries und merged die Ergebnisse.

**Position:** Nach „Mehr von {vendor}", vor dem Club-Banner.

---

## 4. Club-Member-CTA (neue Komponente `ClubMemberCta`)

**Vorschlag fürs Konzept** (HATOFF Club):

> **HATOFF CLUB — Werde Mitglied**  
> Mehr Stil. Mehr Vorteile. Kostenlos.

**Vier Vorteile (mit Icons):**
1. 🎁 **10% Willkommensrabatt** auf deine erste Bestellung
2. 🚚 **Gratis Versand & Retoure** ab dem ersten Einkauf — keine Mindestbestellung
3. ✨ **Early Access** zu neuen Kollektionen & Sales (24 h vor allen anderen)
4. 👔 **Persönlicher Stil-Concierge** — Outfit-Beratung per Mail oder Chat

**Layout:** Voll-Breite Section mit dunklem Hintergrund (`bg-foreground text-background`), zentriertem Inhalt im `container-editorial`, Headline in `font-display`, 4-Spalten-Grid für die Vorteile (2×2 mobil), und ein primärer Call-to-Action-Button **„Jetzt kostenlos beitreten"**.

**Funktionalität (für jetzt):** Der Button öffnet noch keinen Auth-Flow — es wird ein Toast „Bald verfügbar" angezeigt **oder** zu einer noch nicht existierenden Route `/club` verlinkt. **Frage an dich:** Soll der Button später eine echte Anmeldung haben (mit Lovable-Cloud-Auth), oder reicht erst mal nur das visuelle Konzept? Ich würde im ersten Schritt nur die Optik bauen und die Anmeldung in einem späteren Schritt nachziehen — sag mir, wenn das anders sein soll.

**Datei:** `src/components/ClubMemberCta.tsx`

---

## Geänderte / neue Dateien

**Neu:**
- `src/components/StyleInspirations.tsx`
- `src/components/YouMightAlsoLike.tsx`
- `src/components/ClubMemberCta.tsx`
- `src/data/styleInspirations.ts`
- `src/assets/style-inspirations/*.jpg` (einmalig per AI generiert, ~9–12 Bilder für 3–4 Kategorien)

**Bearbeitet:**
- `src/pages/ProductDetail.tsx` — neue Sections in dieser Reihenfolge unterhalb der bestehenden Inhalte einbinden:
  1. Bestehende Galerie + Produktinfo (unverändert)
  2. Bestehende Accordions (unverändert)
  3. **NEU:** `<StyleInspirations product={product} />`
  4. Bestehender `<AiStyleGenerator />` (unverändert)
  5. Bestehende „Mehr von {vendor}" Sektion (unverändert)
  6. **NEU:** `<YouMightAlsoLike product={product} excludeHandles={[...related]} />`
  7. Bestehende „In diesen Looks getragen" Sektion (unverändert)
  8. **NEU:** `<ClubMemberCta />`

---

## Reihenfolge der Implementierung

1. Style-Inspirationen-Bilder per AI generieren (Gemini Image Preview) und nach `src/assets/style-inspirations/` ablegen
2. `styleInspirations.ts` Datenmapping anlegen
3. `StyleInspirations`-Komponente
4. `YouMightAlsoLike`-Komponente (mit Fetch-Logik)
5. `ClubMemberCta`-Komponente
6. `ProductDetail.tsx` integrieren
