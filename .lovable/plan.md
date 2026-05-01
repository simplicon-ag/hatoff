## Weshalb es immer abbricht

Do I know what the issue is? Ja.

Das Problem ist nicht mehr primär der neu verbundene Shopify-Zugang. Die aktuellen Logs zeigen: Der Import läuft wieder, aber der Worker ist zu gross/zu langsam für einen einzelnen Backend-Funktionslauf.

### Aktueller Befund

- `product-import-by-url` braucht pro Produkt im Schnitt ca. 42 Sekunden, maximal zuletzt ca. 67 Sekunden.
- `brand-import-worker` nimmt aktuell per Cron alle 1 Minute bis zu 10 Produkte und verarbeitet sie nacheinander.
- 10 Produkte x ca. 42 Sekunden = ca. 7 Minuten Laufzeit.
- Die Backend-Funktion wird vorher beendet/abgewürgt. Dann bleiben bereits reservierte Produkte auf `syncing` stehen.
- Genau das sieht man jetzt in der Datenbank:
  - Casa Moda: 588 wartend, 172 `syncing`, davon 105 bereits hängend
  - Venti: 213 wartend, 16 `syncing`, davon 16 hängend
  - Fehler aktuell: Casa Moda 24, Venti 2
- Die alten 401-Token-Fehler sind noch in einzelnen Log-Zeilen/DB-Einträgen vorhanden, aber in den frischen Funktionslogs sehe ich aktuell keine neuen 401-Treffer.
- Zusätzlich läuft `casa-moda-color-sweep` alle 2 Minuten und endet wiederholt mit 500 / `[object Object]`. Das ist ein zweiter Störfaktor, weil dieser Prozess parallel neue Farbvarianten sucht/einreiht und selbst fehlschlägt.

### Exakt was passiert

```text
Cron startet brand-import-worker
  -> Worker claimt z.B. 10 Produkte und setzt sie auf syncing
  -> Produkt 1 dauert 30-60s
  -> Produkt 2 dauert 30-60s
  -> ...
  -> Funktion läuft zu lange und wird beendet
  -> restliche geclaimte Produkte bleiben auf syncing
  -> nächster Cron startet wieder
  -> Queue wirkt blockiert / stockt / bricht ab
```

Das ist also ein Architektur-/Batching-Problem: Der Worker verarbeitet zu viel in einem Funktionslauf und ruft dabei langsame Produktimporte seriell auf.

## Plan zur Stabilisierung

### 1. Sofortbremse: Batch stark reduzieren
- Cron für `brand-import-worker` von Batch 10 auf Batch 1 oder 2 setzen.
- Dadurch bleibt jeder Lauf unter der Laufzeitgrenze.
- Es wird langsamer, aber stabiler und ohne hängenbleibende `syncing`-Blöcke.

### 2. Hängende Einträge sauber zurücksetzen
- Alle `syncing`-Einträge älter als 10 Minuten wieder auf `sync_pending` setzen.
- Echte Fehler wie `no colours scraped` separat lassen, damit sie nicht endlos erneut laufen.
- Alte 401-Fehler nach der Shopify-Neuverbindung gezielt wieder einreihen.

### 3. `casa-moda-color-sweep` vorübergehend deaktivieren oder fixen
- Den fehlerhaften Sweep-Cron pausieren, solange der Hauptimport läuft.
- Danach die Funktion korrigieren, damit sie echte Fehlermeldungen loggt statt `[object Object]`.
- Erst wieder aktivieren, wenn der Hauptimport stabil leerläuft.

### 4. Worker robuster machen
- Im `brand-import-worker` eine Laufzeitgrenze einbauen, z.B. nach 45-60 Sekunden kontrolliert stoppen.
- Vor jedem nächsten Produkt prüfen: Habe ich noch genug Zeit?
- Wenn nicht: nicht weiter claimen/verarbeiten, sondern sauber mit Status zurückkommen.
- Fehlerdetails besser speichern, damit wir nicht nur generische Abbrüche sehen.

### 5. Danach Reimport erneut anstossen
- Queue bereinigen.
- Worker manuell mit kleinem Batch starten.
- Dann Status prüfen: pending muss sinken, stale syncing darf nicht wieder wachsen.

## Erwartetes Ergebnis

Nach der Änderung bricht der Import nicht mehr in grossen Blöcken ab. Er läuft langsamer, aber kontrolliert durch. Sobald die Queue stabil ist, kann man die Geschwindigkeit vorsichtig wieder erhöhen.

## Technische Details

Betroffene Stellen:
- `supabase/functions/brand-import-worker/index.ts`
- Cron-Job `brand-import-worker-1min`
- Cron-Job `casa-moda-color-sweep-tick`
- Tabelle `product_import_log`
- Tabelle `sweep_state`

Ich würde als nächsten Schritt die Stabilisierung umsetzen: Batch runter, hängende Einträge requeuen, Sweep pausieren/fixen und den Worker mit einer eigenen Laufzeitbremse absichern.

<lov-actions>
  <lov-open-history>View History</lov-open-history>
</lov-actions>

<lov-actions>
<lov-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</lov-link>
</lov-actions>