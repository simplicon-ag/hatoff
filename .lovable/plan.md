Ich werde die Produktsuche so umbauen, dass sie zuverlässig und dauerhaft alle wichtigen Produktdaten durchsucht — besonders Artikelnummern und Beschreibungstexte.

Geplante Änderungen:

1. Zentrale Suchlogik erstellen
- Eine gemeinsame Funktion für Produktsuche/Scoring anlegen, damit die Suche überall gleich funktioniert.
- Durchsucht werden künftig:
  - Titel
  - Marke
  - Kategorie / Produkttyp
  - Handle / URL-Name
  - Tags, inklusive Werte wie `art:126430023`
  - Variantenoptionen wie Farbe/Grösse
  - Produktbeschreibung
  - HTML-Beschreibung als bereinigter Text
  - Artikelnummern aus Texten wie `Artikelnummer: 126430023`

2. Globale Suche verbessern
- Die Suche oben im Header nutzt dann dieselbe robuste Logik.
- Artikelnummern bekommen höchste Priorität.
- Mehrwort-Suchen funktionieren präziser: jedes Wort muss im Produkt vorkommen, aber es darf in unterschiedlichen Feldern stehen.
- Ergebnisse werden nach Relevanz sortiert, nicht zufällig.

3. Shop-Seite korrigieren
- Das Suchfeld im Shop durchsucht aktuell nur Titel, Marke und Kategorie. Das wird korrigiert.
- Wenn man aus der globalen Suche auf „Alle Ergebnisse ansehen“ klickt, bleiben die Ergebnisse konsistent und suchen ebenfalls in Texten, Tags und Artikelnummern.

4. Persistenz / URL-Suche verbessern
- Der Suchbegriff soll im Shop über `?q=...` sauber übernommen werden.
- Optional wird die URL aktualisiert, wenn man im Shop sucht, damit die Suche beim Reload/Teilen der Seite erhalten bleibt.

Technische Details:
- Änderung in `src/lib/shopify.ts` oder einer neuen kleinen Hilfsdatei, z. B. `src/lib/product-search.ts`.
- Anpassung von `src/components/GlobalSearch.tsx`.
- Anpassung von `src/pages/Shop.tsx`.
- Keine Datenbankänderung nötig.
- Kein Backend nötig.

Ergebnis:
- Wenn du eine Artikelnummer eingibst, wird der passende Artikel gefunden.
- Wenn der Suchbegriff nur in der Beschreibung steht, wird der Artikel ebenfalls gefunden.
- Globale Suche und Shop-Suche verhalten sich gleich und bleiben auch bei neuen Produkten tag-/textbasiert funktionsfähig.