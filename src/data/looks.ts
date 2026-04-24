// HATOFF — Curated Looks
// Each look references real Shopify product handles created in the store.

export interface CuratedLook {
  slug: string;
  title: string;
  subtitle: string;
  welt: string; // matches welten id
  anlaesse: string[]; // anlass slugs
  productHandles: string[];
  story: string;
  hero: string; // image asset path
}

export const looks: CuratedLook[] = [
  {
    slug: "modernes-buero",
    title: "Modernes Büro",
    subtitle: "Klar, präzise, mühelos.",
    welt: "business",
    anlaesse: ["buero", "besondere-anlaesse"],
    productHandles: [
      "venti-businesshemd-extra-langer-arm-72cm-weiss",
      "casa-moda-chinohose-chris-dunkelblau",
    ],
    story:
      "Ein weisses Hemd ist nie eine Notlösung — es ist eine Haltung. Mit der dunkelblauen CHRIS-Chino entsteht ein Look, der vom Termin bis zum After-Work funktioniert.",
    hero: "https://cdn.shopify.com/s/files/1/0999/5006/8094/files/p0315_i0.jpg?v=1777042433",
  },
  {
    slug: "smart-casual-cafe",
    title: "Smart Casual am Café",
    subtitle: "Locker, aber nie nachlässig.",
    welt: "smart-casual",
    anlaesse: ["alltag", "ausgang"],
    productHandles: [
      "venti-businesshemd-extra-langer-arm-72cm-hellblau",
      "casa-moda-chinohose-chris-beige",
    ],
    story:
      "Hellblaues Hemd, Ärmel umgeschlagen, beige CHRIS-Chino — der Klassiker für Tage, an denen alles passen soll. Vom Meeting bis zum Aperitif.",
    hero: "https://cdn.shopify.com/s/files/1/0999/5006/8094/files/p0302_i0.jpg?v=1777042388",
  },
  {
    slug: "wochenende-warm",
    title: "Warmes Wochenende",
    subtitle: "Ankommen, durchatmen, gut aussehen.",
    welt: "freizeit",
    anlaesse: ["alltag", "reisen"],
    productHandles: [
      "casa-moda-pullover-champagner-beige",
      "casa-moda-jeans-steve-dunkelblau",
      "casa-moda-blouson-olive",
    ],
    story:
      "Champagner-Pullover, dunkelblaue STEVE-Jeans und ein olivfarbener Blouson — Wärme, die nach Stil aussieht. Für Spaziergänge, Märkte und lange Frühstücke.",
    hero: "https://cdn.shopify.com/s/files/1/0999/5006/8094/files/p0145_i0.jpg?v=1777041794",
  },
  {
    slug: "sommer-leicht",
    title: "Sommer, leicht gehalten",
    subtitle: "Polo, Pikee, Pause.",
    welt: "sommer",
    anlaesse: ["sommer", "reisen"],
    productHandles: [
      "casa-moda-polo-shirt-dunkelblau",
      "casa-moda-3-4-bermuda-ben-beige",
    ],
    story:
      "Ein dunkelblaues Polo bringt Frische ohne Anstrengung. Mit der beigen BEN-Bermuda wird daraus die ehrlichste Form von Sommer-Stil.",
    hero: "https://cdn.shopify.com/s/files/1/0999/5006/8094/files/p0099_i0.jpg?v=1777041624",
  },
  {
    slug: "abend-cognac",
    title: "Abendlicht & Beige",
    subtitle: "Ein Look, der die Stunde fühlt.",
    welt: "smart-casual",
    anlaesse: ["ausgang", "besondere-anlaesse"],
    productHandles: [
      "venti-businesshemd-extra-langer-arm-72cm-hellblau",
      "casa-moda-jeans-steve-dunkelblau",
      "casa-moda-strickjacke-beige",
    ],
    story:
      "Hellblaues Hemd, dunkle Jeans, beige Strickjacke — der Look für lange Abende, in denen Stil keine Anstrengung sein soll.",
    hero: "https://cdn.shopify.com/s/files/1/0999/5006/8094/files/p0302_i0.jpg?v=1777042388",
  },
  {
    slug: "business-klassiker",
    title: "Neuer Business-Klassiker",
    subtitle: "Anzug, neu gedacht.",
    welt: "business",
    anlaesse: ["buero"],
    productHandles: [
      "venti-businesshemd-extra-langer-arm-72cm-weiss",
      "venti-anzughose-108-blau",
      "casa-moda-steppweste-dunkelblau",
    ],
    story:
      "Weisses Hemd, blaue Anzughose und eine dunkelblaue Steppweste als moderne Schicht — präzise, ruhig, souverän.",
    hero: "https://cdn.shopify.com/s/files/1/0999/5006/8094/files/p0315_i0.jpg?v=1777042433",
  },
];

export const welten = [
  { id: "business", title: "Business", description: "Souverän auftreten.", image: "/src/assets/welt-business.jpg" },
  { id: "smart-casual", title: "Smart Casual", description: "Locker mit Haltung.", image: "/src/assets/welt-smart-casual.jpg" },
  { id: "freizeit", title: "Freizeit", description: "Tage ohne Eile.", image: "/src/assets/welt-freizeit.jpg" },
  { id: "sommer", title: "Sommer", description: "Leicht und hell.", image: "/src/assets/welt-sommer.jpg" },
  { id: "hemden", title: "Hemden-Welt", description: "Das Fundament.", image: "/src/assets/welt-hemden.jpg" },
  { id: "jacken", title: "Jacken-Welt", description: "Schicht für Schicht.", image: "/src/assets/welt-jacken.jpg" },
];

export const anlaesse = [
  { slug: "buero", title: "Büro" },
  { slug: "alltag", title: "Alltag" },
  { slug: "ausgang", title: "Ausgang" },
  { slug: "reisen", title: "Reisen" },
  { slug: "sommer", title: "Sommer" },
  { slug: "besondere-anlaesse", title: "Besondere Anlässe" },
];

export const marken = [
  {
    slug: "casamoda",
    name: "CASAMODA",
    tagline: "Hemden mit Haltung — seit Generationen.",
    story:
      "CASAMODA steht für sorgfältig gefertigte Hemden mit präzisem Schnitt und langlebiger Qualität. Eine Marke für alle, die das Detail sehen.",
  },
  {
    slug: "venti",
    name: "VENTI",
    tagline: "Schmal geschnitten, klar gedacht.",
    story:
      "VENTI bringt moderne Silhouetten ins Hemd. Slim Fits, klare Muster, und Stoffe, die mitarbeiten — vom Büro bis ins Wochenende.",
  },
  {
    slug: "meyer",
    name: "MEYER",
    tagline: "Hosen, die mitgehen.",
    story:
      "MEYER fertigt Hosen, die sich wie ein Lieblingsstück anfühlen — präzise verarbeitet, perfekt im Sitz.",
  },
  {
    slug: "fynch-hatton",
    name: "FYNCH-HATTON",
    tagline: "Reise, Stil, Wärme.",
    story:
      "FYNCH-HATTON kombiniert reisetaugliche Stoffe mit zeitlosen Schnitten. Eine Marke, die in jedes Klima passt.",
  },
  {
    slug: "milestone",
    name: "MILESTONE",
    tagline: "Jacken mit Charakter.",
    story:
      "MILESTONE macht Jacken zum Statement — warm, durchdacht, mit dem gewissen Etwas.",
  },
];

export const magazinArtikel = [
  {
    slug: "hemd-modern-kombinieren",
    title: "Hemd modern kombinieren — 5 Wege, die immer funktionieren",
    teaser: "Vom Klassiker bis zum entspannten Smart-Casual: Wie ein Hemd zum vielseitigsten Stück im Schrank wird.",
    image: "/src/assets/mag-hemd.jpg",
    readingTime: "4 Min",
    content: `Ein Hemd ist nie nur ein Hemd. Es ist die Basis, auf der ein ganzer Tag aufbaut — und wenn man es richtig kombiniert, übersteht es Meeting, Mittagessen und den Abend mit Freunden, ohne dass man sich umziehen müsste.

**1. Das weisse Hemd zur Chino — der ehrliche Klassiker.** Ein gut sitzendes weisses Hemd mit beiger oder dunkelblauer Chino ist die zuverlässigste Kombination, die ein Mann besitzen kann. Reinstecken fürs Büro, raushängen lassen am Wochenende. Mit Lederschuhen wirkt es seriös, mit weissen Sneakern entspannt.

**2. Oxford in Hellblau — das Verbindungsstück.** Hellblaues Oxford ist die geheime Waffe für Smart Casual. Es wirkt nie zu förmlich, nie zu lässig. Tragen Sie es zur Chino, zur dunklen Jeans oder unter einem Pullover — es funktioniert immer.

**3. Hemd unter Pullover.** Ein V-Ausschnitt-Pullover über einem Hemd mit Kragen schafft Tiefe und macht jeden Look interessanter. Achten Sie darauf, dass der Hemdkragen sauber sitzt — er ist das, was man sieht.

**4. Karo & Streifen — mit Mass.** Ein dezentes Karohemd oder feine Streifen bringen Persönlichkeit, ohne aufdringlich zu sein. Kombinieren Sie sie immer mit einer ruhigen Hose und einfachen Schuhen.

**5. Hemd ohne Krawatte, oberster Knopf offen.** Die heute relevanteste Form, ein Hemd zu tragen. Klar, lässig, modern. Funktioniert besonders gut, wenn die Schultern sitzen — ein gut geschnittenes Hemd macht hier den Unterschied.

Die Regel hinter allem: Passform vor Marke, Material vor Trend. Ein Hemd, das gut sitzt und sich gut anfühlt, wird zur zweiten Haut — und genau das macht den Stil aus.`,
  },
  {
    slug: "business-ohne-steif",
    title: "Business Look ohne steif zu wirken",
    teaser: "Wie man professionell aussieht, ohne in der Anzug-Schablone zu verschwinden.",
    image: "/src/assets/mag-business.jpg",
    readingTime: "5 Min",
    content: `Der klassische Anzug verliert an Bedeutung — aber das heisst nicht, dass Stil im Büro unwichtig wird. Im Gegenteil: Wer heute professionell aussehen will, braucht ein feineres Gespür dafür, was angemessen ist und was authentisch wirkt.

**Weniger Uniform, mehr Person.** Der dunkle Zweiteiler war jahrzehntelang die Standardlösung. Heute zählt eher die Kombination aus gutem Hemd, präziser Hose und einer Jacke, die Charakter zeigt — etwa ein unstrukturierter Blazer in warmem Beige oder ein Cardigan in Anthrazit.

**Materialien sprechen lassen.** Baumwolle, Leinen, Wolle in feinen Qualitäten wirken sofort hochwertig — auch ohne Logo. Achten Sie auf den Griff: Stoffe, die sich angenehm anfühlen, sehen auch besser aus.

**Farben aus der Erde.** Beige, Cognac, warmes Grau, gedämpftes Blau. Diese Farben wirken modern und seriös zugleich. Schwarz wirkt im Tagesgeschäft oft härter als gewünscht.

**Schuhe entscheiden.** Ein guter Lederschuh — Derby, Loafer oder ein cleaner weisser Sneaker — macht aus einem entspannten Look einen kompletten. Hier zu sparen ist falsch.

**Die Passform ist alles.** Ein günstiges Hemd, das perfekt sitzt, sieht besser aus als ein teures, das schlecht passt. Investieren Sie in Änderungen — sie sind oft günstiger als ein neues Stück.

Der moderne Business-Look erlaubt mehr Persönlichkeit, verlangt aber mehr Sorgfalt. Wer das versteht, wirkt nicht nur professionell — sondern wie jemand, dem man vertraut.`,
  },
  {
    slug: "5-kombis-fuer-jeden-tag",
    title: "5 einfache Kombinationen für jeden Tag",
    teaser: "Mit wenigen Stücken durch die Woche — ohne morgens nachdenken zu müssen.",
    image: "/src/assets/mag-kombis.jpg",
    readingTime: "3 Min",
    content: `Stil ist kein grosser Schrank, sondern ein klarer Gedanke. Mit wenigen, gut gewählten Stücken lassen sich erstaunlich viele Looks bauen, die jeden Anlass tragen.

**Montag — Hemd & Chino.** Weisses Hemd, beige Chino, Lederloafer. Das Fundament. Gerade weil es einfach ist, wirkt es immer.

**Dienstag — Polo & Chino.** Navy-Polo, gleiche Chino, weisse Sneaker. Lässiger, aber nicht weniger durchdacht.

**Mittwoch — Karo & Pullover.** Dezentes Karohemd unter cremefarbenem Pullover, dunkle Hose. Layering, das Wärme bringt — visuell und tatsächlich.

**Donnerstag — Streifen & Jacke.** Streifenhemd, Chino, cognacfarbene Übergangsjacke. Der Look mit dem meisten Charakter — perfekt für After-Work.

**Freitag — Polo & Jeans.** Polo, dunkle Jeans, weisse Sneaker. Wochenend-Modus aktiviert, aber ohne nachlässig zu wirken.

**Das Rezept dahinter:** Drei Hemden, ein Polo, eine Chino, eine dunkle Jeans, ein Pullover, eine Jacke. Mehr braucht es nicht, um zwei Wochen ohne Wiederholung gut auszusehen.

Stil entsteht nicht durch Vielfalt — sondern durch Wiederholung der richtigen Stücke.`,
  },
];
