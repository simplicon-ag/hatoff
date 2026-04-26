
# HATOFF Club – Mitgliederbereich mit Punkten & Stufen

Ziel: Eigene `/club` Seite mit Login, persönlichem Dashboard, echtem Punktestand in der Datenbank und 3 Stufen mit Rabatt-Vorteilen.

---

## 1. Stufen-Konzept (fix verdrahtet im Code)

| Stufe   | ab Punkten | Rabatt | Vorteile                                           |
|---------|------------|--------|----------------------------------------------------|
| Bronze  | 0          | 5 %    | Willkommen, Gratis Versand ab 100 CHF              |
| Silber  | 500        | 10 %   | Gratis Versand & Retoure, Early Access (24 h)      |
| Gold    | 1500       | 15 %   | Stil-Concierge, Geburtstags-Geschenk, Preview-Sale |

Punkte-Logik (Konzept im UI erklärt):  
**1 CHF Umsatz = 1 Punkt** · 100 Bonus-Punkte für Anmeldung · Punkte verfallen nicht im ersten Jahr.

> Hinweis: Punkte werden in dieser Version **manuell oder per interner Funktion** gutgeschrieben (kein automatisches Mapping aus Shopify-Bestellungen, weil es noch keine Bestellhistorie pro Nutzer in der App gibt). Dafür gibt es ein einfaches RPC, das Punkte hinzufügt – später kann das von einer Bestell-Webhook-Funktion aufgerufen werden.

---

## 2. Authentifizierung (Lovable Cloud)

- **Email + Passwort** und **Google Sign-In** (Standard-Defaults)
- Neue Seite `/auth` mit Tabs *Anmelden / Registrieren*
- Passwort vergessen + `/reset-password` Seite
- `onAuthStateChange` Listener vor `getSession()` (Best Practice)
- Auto-Confirm Email **aus** (User muss bestätigen)

---

## 3. Datenbank (neue Tabellen)

### `profiles`
- `id` uuid PK = `auth.users.id`
- `display_name` text
- `avatar_url` text
- `birthday` date (für Gold-Geburtstagsgeschenk, optional)
- `created_at`, `updated_at` timestamptz
- RLS: Jeder User liest/aktualisiert nur seinen eigenen Eintrag
- Trigger `on_auth_user_created` legt automatisch ein Profil + 100 Willkommens-Punkte an

### `club_points_ledger` (Transaktions-Log)
- `id` uuid PK
- `user_id` uuid → `auth.users.id` ON DELETE CASCADE, **NOT NULL**
- `points` int (positiv = Gutschrift, negativ = Einlösung)
- `reason` text (z. B. `welcome_bonus`, `purchase`, `birthday`, `manual`)
- `meta` jsonb (Bestell-Ref etc.)
- `created_at` timestamptz
- RLS: User darf nur **eigene** Zeilen lesen (kein Insert/Update/Delete für Clients)

### View / Funktion `get_my_points()`
- SECURITY DEFINER, gibt aktuelle Summe für `auth.uid()` zurück
- Wird vom Frontend für den Punktestand verwendet

### RPC `add_club_points(_user_id, _points, _reason, _meta)`
- SECURITY DEFINER, intern aufrufbar (z. B. später aus Edge Function)
- In dieser Version aus dem Admin-Bereich oder per Demo-Button erreichbar – siehe unten

---

## 4. Neue Seiten / Routen

### `/club` (öffentlich – Marketing-Landing)
Ersetzt langfristig `ClubMemberCta`. Inhalt:
- Hero: „HATOFF Club. Stil wird belohnt."
- 3 Stufen-Karten (Bronze/Silber/Gold) mit Rabatt + Vorteilen, im editorialen Stil (warmer Sand-BG, dezente Trennlinien – passend zum Rest der Seite)
- „So funktioniert's" – 3 Schritte (Anmelden → Einkaufen → Punkte sammeln → Rabatte)
- FAQ-Akkordeon (Verfall, Übertragbarkeit, Kündigung)
- CTA wechselt je nach Auth-Status:
  - eingeloggt → „Zum Mitgliederbereich" → `/club/mein-konto`
  - ausgeloggt → „Kostenlos beitreten" → `/auth?redirect=/club/mein-konto`

### `/club/mein-konto` (geschützt)
Persönliches Dashboard:
- Begrüssung mit `display_name`
- Grosse Punkte-Anzeige + aktuelle Stufe (Badge)
- **Progress-Bar** zur nächsten Stufe (`Progress` Komponente, schon vorhanden)
- 3 Stufen-Karten mit visueller Markierung „Du bist hier"
- Aktueller Rabatt-Code-Hinweis (statisch generiert: z. B. `CLUB-BRONZE-5`, später dynamisch)
- Punkte-Historie: Liste der letzten 20 Einträge aus `club_points_ledger`
- Einstellungen: `display_name` & `birthday` editierbar
- Logout-Button

### `/auth`
Login + Registrierung mit Google + Email/Passwort, „Passwort vergessen" Link

### `/reset-password`
Pflicht-Seite für Passwort-Reset-Flow

---

## 5. Komponenten (neu)

- `src/pages/Club.tsx` – öffentliche Landing
- `src/pages/ClubAccount.tsx` – geschütztes Dashboard
- `src/pages/Auth.tsx` – Login/Signup
- `src/pages/ResetPassword.tsx`
- `src/components/club/TierCard.tsx` – einzelne Stufen-Karte
- `src/components/club/PointsBalance.tsx` – grosse Punkte-Anzeige + Progress
- `src/components/club/PointsHistory.tsx` – Tabelle der Transaktionen
- `src/components/club/RequireAuth.tsx` – Route-Wrapper, leitet auf `/auth` um
- `src/hooks/useAuth.ts` – Session-State Hook (mit `onAuthStateChange`)
- `src/hooks/useClubPoints.ts` – React Query Hook für Punktestand + Stufe
- `src/lib/club-tiers.ts` – Stufen-Definition + Helper `tierForPoints(points)`

---

## 6. Anpassungen an bestehenden Dateien

- **`src/App.tsx`**: neue Routen `/club`, `/club/mein-konto`, `/auth`, `/reset-password`
- **`src/components/SiteHeader.tsx`**: „CLUB" Link existiert bereits → zeigt jetzt `/club`. Zusätzlich: kleines Personen-Icon rechts (neben Cart) – führt zu `/auth` (ausgeloggt) oder `/club/mein-konto` (eingeloggt)
- **`src/components/ClubMemberCta.tsx`**: bleibt als Teaser auf der Startseite, der „Jetzt beitreten" Button verlinkt jetzt auf `/club` statt nur Toast zu zeigen
- **`src/pages/Index.tsx`**: keine Logik-Änderung, nur Verlinkung über `ClubMemberCta`

---

## 7. Demo-Punkte vergeben

Da es noch keine Bestell-Pipeline an User-IDs gibt, baue ich für die erste Version im Dashboard einen kleinen, dezenten **„Demo: 50 Punkte gutschreiben"** Button (nur sichtbar in Dev/Preview oder hinter einem Schalter). So kannst du das System direkt ausprobieren. Sobald Bestellungen pro User existieren, ersetzen wir das durch eine Edge Function, die `add_club_points` aufruft.

---

## 8. Was bewusst NICHT in diesem Schritt enthalten ist

- Automatische Punktevergabe nach Shopify-Checkout (braucht Webhook + User-Mapping)
- Generierung echter, einlösbarer Rabattcodes pro User in Shopify (würde Shopify Admin API + Coupon-Tabelle erfordern – als Folge-Schritt)
- Mehrsprachigkeit / Newsletter-Kopplung

---

Wenn du den Plan bestätigst, baue ich alles oben genannte in einem Schritt: Migration, Auth-Seiten, Club-Seiten, Header-Update und Verknüpfung mit der bestehenden Startseiten-CTA.
