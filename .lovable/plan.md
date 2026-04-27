## Ziel

Der bisherige Block **„Style-Welten — Sechs Welten, ein Stil."** auf der Startseite (`src/pages/Index.tsx`) gefällt dir nicht: die 6 Kacheln wirken visuell uneinheitlich (Flatlays, Personen, Stillleben gemischt) und mischen Anlass-Welten mit Produktkategorien.

Wir ersetzen ihn durch eine **redaktionelle Saison-Story als Triptychon** — drei vertikale Bilder, eine durchgehende Headline, eine Sequenz, die einen Tag in der Kollektion erzählt. Magazinhaft, ruhig, hochwertig.

---

## Konzept der Editorial Story

**Saison-Thema:** Frühling/Sommer 2026 — *Leinen & Salbei*
**Stimmung:** ruhig, hell, natürlich — Naturtöne, Salbeigrün, Sand, Crème, weiches Tageslicht
**Layout:** Triptychon — 3 vertikale Bilder nebeneinander, gleiche Höhe, gleiche Bildsprache

**Struktur des Blocks (von oben nach unten):**

1. **Eyebrow-Label**: `AUSGABE 01 · FRÜHLING/SOMMER 2026`
2. **Headline (gross, Display-Font)**: „Leinen, Salbei, ein langer Tag."
3. **Lead-Text** (1–2 Sätze, max. 2 Zeilen): „Eine Kollektion in Naturtönen, getragen vom ersten Cappuccino bis zur blauen Stunde. Drei Momente, ein Stoff, ein Stil."
4. **Triptychon (3 Spalten auf Desktop, gestapelt auf Mobile):**
   - **Bild 1 — Morgen** · Bildunterschrift: „08:14 — Leinenhemd, Sand-Chino, das erste Licht."
   - **Bild 2 — Mittag** · Bildunterschrift: „13:42 — Salbeigrün am Marktplatz, Ärmel umgeschlagen."
   - **Bild 3 — Abend** · Bildunterschrift: „19:30 — Crème über Indigo, der Tag wird weich."
5. **CTA**: Textlink rechts „Zur Kollektion entdecken →" (verlinkt auf `/looks?welt=hemden` oder `/looks`)

Bildunterschriften sind klein, in Mono- oder kleiner Sans, mit Uhrzeit als ruhiges redaktionelles Detail.

---

## Umsetzung

### 1. Drei neue Hero-Bilder generieren (Lifestyle, mit Personen)

Konsistente Bildsprache, gleiches Model, gleiche Bildlogik — nur Tageszeit und Setting variieren:

- `src/assets/editorial-fs26-morgen.jpg` — Mann am Frühstückstisch am Fenster, weisses Leinenhemd, Sand-Chino, Cappuccino, weiches Morgenlicht (warmer Crème-Ton)
- `src/assets/editorial-fs26-mittag.jpg` — Mann auf einem südeuropäischen Marktplatz, salbeigrünes Leinenhemd (Ärmel umgeschlagen), Sand-Chino, Mittagslicht, Naturschatten
- `src/assets/editorial-fs26-abend.jpg` — Mann auf einer Terrasse zur blauen Stunde, crèmefarbener Pullover über Hemd, Indigo-Hose, weiches Gegenlicht

Alle drei in **vertikalem Format (3:4 oder 4:5)**, gleicher Look & Feel, gleicher Model-Typ, gleiche Farbtemperatur-Familie. So funktioniert das Triptychon als Sequenz.

### 2. Neue Section in `src/pages/Index.tsx`

- Den bestehenden Block „Style-Welten" (ca. Zeilen 84–115, die Section mit `welten.map(...)`) **komplett entfernen**.
- An gleicher Stelle eine neue Section einfügen mit:
  - Container `container-editorial`
  - Headline-Block (Eyebrow + Display-Headline + Lead)
  - Grid: `grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6`
  - Drei `<figure>`-Elemente mit `<img>` (aspect-[3/4]) + `<figcaption>`
  - CTA-Link am Ende rechtsbündig
- Die drei Bilder als ES6-Imports oben in der Datei einbinden.
- Spacing analog zu den anderen Sections: `py-16 md:py-24`.

### 3. Aufräumen

- Der `welten`-Export in `src/data/looks.ts` wird **nicht entfernt** — er wird vermutlich noch an anderer Stelle (z.B. `Looks.tsx`) verwendet. Ich prüfe das im Default-Modus per `rg "welten"` und entferne nur, falls keine andere Verwendung existiert.
- Die alten `welt-*.jpg`-Imports in `Index.tsx` werden mitgelöscht; die Asset-Dateien selbst bleiben (könnten anderswo gebraucht werden).
- Das Mapping-Objekt `weltLabel` in `Index.tsx` (oben in der Datei) bleibt — wird weiterhin von der „Featured Looks"-Section verwendet.

### 4. Responsive & QA

- Desktop (≥ md): 3 Bilder nebeneinander, Headline links, CTA rechts in derselben Zeile
- Mobile: Bilder gestapelt, Headline darüber, CTA als eigener Block am Ende
- Bildunterschriften klein (`text-xs uppercase tracking-[0.2em] text-muted-foreground`)
- Visuelle Prüfung im Preview nach Implementierung

---

## Was sich nicht ändert

- Hero-Carousel oben bleibt unverändert
- „So funktioniert HATOFF" bleibt
- „Featured Looks", „Brand Strip", „Social Proof Wall", „Neu eingetroffen", „Sale-Highlights", „Magazin" bleiben alle unverändert
- Die Routing-Struktur (`/looks?welt=...`) bleibt — nur der Einstiegspunkt auf der Homepage ändert sich

---

## Ergebnis

Statt eines unruhigen 6er-Rasters bekommt die Startseite einen **ruhigen, magazinhaften Saison-Auftritt** — eine erzählerische Sequenz, die Atmosphäre transportiert und neugierig macht, ohne dass jede Kachel erklärt werden muss. Das passt zum redaktionellen HATOFF-Ton und hebt sich klar von den darunter folgenden Produkt- und Look-Sektionen ab.