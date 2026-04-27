### Tag-Badges aus dem Wochen-Mosaik entfernen

**Ziel:** Auf der Startseite in der Sektion „7 Tage, 7 Looks" sollen die Tagesstempel (z. B. „01 Montag", „02 Dienstag" …) auf den einzelnen Look-Kacheln entfernt werden. Das Mosaik-Raster, der Hover-Effekt, der Look-Titel und die Untertitel bleiben unverändert.

**Datei:** `src/components/WeeklyEditions.tsx`

**Konkrete Änderungen:**
1. In der `LookTile`-Komponente das `<div>` mit der Tag-Badge entfernen:
   ```tsx
   <div className="absolute left-3 top-3 ... bg-background/90 ...">
     <span ...>{String(day).padStart(2, "0")}</span>
     <span ...>{dayNames[day]}</span>
   </div>
   ```
2. Die `day`-Prop aus `LookTile` entfernen (wird nicht mehr genutzt).
3. In `MosaicGrid` die `day={1..7}`-Props auf den `<LookTile>`-Aufrufen entfernen.
4. Die ungenutzte `dayNames`-Konstante löschen.

**Was bleibt unverändert:**
- Mosaik-Layout mit verschiedenen Aspect-Ratios
- Hover-Zoom auf Bildern
- Gradient-Overlay unten für die Lesbarkeit von Titel/Untertitel
- Linke Archiv-Leiste mit KW-Nummern und Saisonzuordnung
- Sektion-Header („Ausgabe KW xx · …")