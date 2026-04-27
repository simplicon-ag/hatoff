
## Look-Likes — auch ohne Login, 1 Like pro IP

Ja, machbar. Wir nutzen eine Edge Function, die die IP serverseitig aus den Request-Headers liest (vom Client kommende IPs sind nicht vertrauenswürdig), und speichern den Like in einer eigenen Tabelle mit `UNIQUE(look_slug, ip_hash)`.

### Datenbank

**Neue Tabelle `look_likes`**
- `id uuid PK`
- `look_slug text NOT NULL`
- `ip_hash text NOT NULL` — SHA-256 aus IP + Server-Salt (kein Klartext, DSGVO-freundlich)
- `user_id uuid NULL` — falls eingeloggt, zusätzlich speichern
- `created_at timestamptz DEFAULT now()`
- `UNIQUE (look_slug, ip_hash)` → harte Sperre: 1 Like pro IP pro Look
- Index auf `look_slug` für schnelles Counting

**RLS**
- `SELECT`: public erlaubt (nur für Counts; alternativ nur via RPC)
- `INSERT/DELETE/UPDATE`: keine Policies → nur Edge Function (Service Role) darf schreiben

**RPC `get_look_like_count(_slug text) → int`** (SECURITY DEFINER, public)
- Liefert die Anzahl Likes für einen Look — vermeidet, dass der Client `count(*)` selbst macht.

### Edge Function `look-like`

Eine Function mit zwei Aktionen (POST mit `{ slug, action: "toggle" | "status" }`):

1. **IP ermitteln**: `x-forwarded-for` (erster Eintrag) → fallback `cf-connecting-ip`.
2. **Hashen**: `sha256(ip + LOOK_LIKE_SALT)` — neuer Secret `LOOK_LIKE_SALT` wird via add_secret angefordert.
3. **`status`**: gibt `{ liked: boolean, count: number }` zurück (für initiales Rendering).
4. **`toggle`**:
   - Falls Eintrag mit `(slug, ip_hash)` existiert → DELETE (unlike).
   - Sonst INSERT (mit optionalem `user_id` aus JWT, falls Header vorhanden).
   - Antwort: `{ liked: boolean, count: number }`.
5. CORS-Headers wie üblich, `verify_jwt = false` (default), JWT manuell parsen falls vorhanden — sonst anonym.

Kleine Rate-Limit-Sicherheit: max 1 Toggle pro IP pro Sekunde via In-Memory-Map (Best-Effort).

### Frontend

**Neuer Hook `src/hooks/useLookLikes.ts`**
- Lädt Status beim Mount via `supabase.functions.invoke("look-like", { body: { slug, action: "status" } })`.
- `toggle()` → optimistisches Update, rollt bei Fehler zurück.
- Cached Counts in einem kleinen Map-Store, damit `LookCard` und `LookDetail` synchron bleiben.

**`LookCard.tsx`**
- Kleiner Heart-Button oben rechts auf der Karte (absolute, mit Backdrop-Blur).
- Zeigt aktuelle Anzahl daneben.
- `onClick` stoppt Navigation, ruft `toggle()`.

**`LookDetail.tsx`**
- Größerer Like-Button im Hero-Bereich (neben Titel oder unter Subtitle), mit Animation beim Liken (kleiner Pulse).
- Anzeige: „❤ 124 Likes“.

### UX-Details

- Wenn schon geliked: Herz gefüllt + andere Farbe (`destructive`).
- Klick erneut → Like wird entfernt (Toggle).
- Toast bei Fehler („Du hast diesen Look bereits geliked“ falls UNIQUE-Conflict trotz Race).
- Eingeloggte User: zusätzlich `user_id` gespeichert → später nutzbar für „Meine gelikten Looks“.

### Hinweise / Trade-offs

- IP-Limit ist nicht perfekt: User mit dynamischer IP (Mobilfunk) oder VPN können mehrfach liken; mehrere Personen im selben Haushalt-WLAN teilen ein Limit. Für ein Vanity-Engagement-Feature ist das aber Standard und akzeptabel.
- Salt wird in Supabase Secrets gehalten, nicht im Code — IP-Hashes sind damit nicht reversibel.
- Keine Cookies/LocalStorage-Tricks nötig — Server entscheidet.

### Was passiert nach Approval

1. Migration: Tabelle `look_likes` + RPC `get_look_like_count` + RLS.
2. Secret `LOOK_LIKE_SALT` anfordern (auto-generiert oder vom User gesetzt).
3. Edge Function `look-like` deployen.
4. Hook `useLookLikes` + Like-Buttons in `LookCard` und `LookDetail`.

Sag „approved“ und ich leg los.
