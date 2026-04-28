# Looks-Strategie & Auto-Generierung

## Ausgangslage

- 111 Look-Drafts in der DB, alle mit Hero-Bild, 0 published
- Sehr ungleiche Verteilung: Freizeit 46 · Sommer 30 · Business 25 · Hemden 5 · Abend 3 · Jacken 2
- Keine bewussten Saison-/Farb-Achsen, AI generiert eher zufällig
- Auto-Trigger nach Import existiert schon, springt aber bei Draft-Produkten nicht an (sinnvoll – aber dein Workflow lautet: Produkte werden später als Active gesetzt, **dann** sollen Looks entstehen)

## Ziel

1. Bestand sauber & ausgewogen verteilt nach Anlass und Saison
2. Farbkombinationen bewusst diversifizieren (nicht 5x „Beige + Navy")
3. Sobald du ein Produkt auf „Active" setzt, automatisch 4 Look-Vorschläge in unterschiedlichen Anlässen/Saisons/Farbachsen generieren
4. Bestand bleibt von selbst ausgewogen, je mehr Produkte aktiv werden

## Plan in 4 Schritten

### 1. Look-Generator erweitern: Saison + Farbachse + Diversitäts-Mode

`look-generate` bekommt zwei neue optionale Body-Parameter:

- `mode: "diverse"` → erzeugt **4 Looks** statt 0–2, jeder mit explizit anderem Schwerpunkt
- `axes`: Liste von Achsen, an denen sich die 4 Looks orientieren sollen

Standard-Achsen für `mode: "diverse"`:
1. **Anlass A** (z.B. Business, formell)
2. **Anlass B** (z.B. Wochenende, casual)
3. **Saison** (Frühling/Sommer ODER Herbst/Winter, abhängig von Material/Produkttyp)
4. **Farbkontrast** (mutigere/unerwartete Farbkombi)

Welt wird um `fruehling-sommer` und `herbst-winter` erweitert (zusätzlich zu den bestehenden 6).

### 2. Bestand ausbalancieren (One-Off-Skript)

- Pro unterversorgter Welt (`hemden`, `abend`, `jacken`) Top-N aktive Anker-Produkte ermitteln und gezielt 1–2 Looks dort generieren, bis jede Welt min. ~10 Looks hat
- Für jeden Anker, der bereits 2 Looks im selben Anlass hat, einmal `mode: "diverse"` triggern, um Saison- und Farb-Vielfalt nachzuliefern
- Erwartung: ~50–80 zusätzliche Drafts, dauert ~20–30 Minuten

### 3. Auto-Trigger beim Aktivieren in Shopify

Da die Edge-Function nur bei Active-Produkten Looks anlegt, brauchen wir einen Mechanismus, der reagiert, wenn du ein Produkt von Draft → Active setzt:

**Option A — Shopify-Webhook (sauber):** Ein neuer Edge-Endpoint `shopify-product-webhook` wird von Shopify auf `products/update` gepingt. Erkennt Draft → Active und ruft `look-generate` mit `mode: "diverse"` auf.

**Option B — Polling-Cronjob (einfacher):** Stündlicher Cron prüft Shopify auf neu aktivierte Produkte (Active und kein Look in `curated_looks`) und triggert `look-generate`. Kein Webhook-Setup nötig, dafür bis zu 1h Verzögerung.

→ **Empfehlung A**, da live und ohne Polling-Last. Falls Webhook-Konfiguration in Shopify nicht klappt, Fallback auf B.

### 4. Admin-Verbesserungen

- Im `/admin/looks` einen **Bulk-Publish-Button** mit Filter („alle Drafts in Welt X mit Hero-Bild publishen")
- Filter nach Welt, Saison, Anlass, Anchor-Produkt
- „Re-generate Look"-Button pro Eintrag (nutzt bestehende `look-admin` regenerate-hero Action + neuer „regenerate-content")

## Reihenfolge der Umsetzung

1. **Generator erweitern** (Code in `look-generate/index.ts`): `mode`, `axes`, Saison-Welten
2. **Bestand ausbalancieren** (One-Off via curl-Skript)
3. **Webhook-Funktion** anlegen + in Shopify einrichten
4. **Admin-UI**: Bulk-Publish + Filter

Schritte 1+2 bringen sofort sichtbaren Mehrwert. 3+4 sind die Operationalisierung für die Zukunft.

## Technische Details

- Neue Welten: `fruehling-sommer`, `herbst-winter` (DB-Enum existiert nicht, `welt` ist `text` → keine Migration nötig)
- AI-Diversitäts-Prompt: System-Prompt erweitert um „Die 4 Looks MÜSSEN sich klar in Anlass, Saison und Farbpalette unterscheiden"
- Tool-Call-Schema: `minItems: 4, maxItems: 4` im `mode: "diverse"`
- Hero-Bild-Cost: 4 Looks × 1 Bildgenerierung = 4 Lovable-AI-Calls pro Aktivierung — vertretbar
- Webhook-Auth: HMAC-Signatur-Check mit Shopify-Secret
- Idempotenz: vor jedem Generate prüfen, ob es bereits ≥4 Looks für den Anker gibt → skip

## Was du danach hast

- Ausgewogene Look-Bibliothek über alle Welten
- Selbstpflegender Prozess: jedes neue Active-Produkt bekommt automatisch 4 stilistisch unterschiedliche Looks
- Admin-Tool, um schnell zu sichten und zu publishen
