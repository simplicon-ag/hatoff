// HATOFF — Curated Looks
// Each look references real Shopify product handles created in the store.
import heroBuero from "@/assets/look-modernes-buero.jpg";
import heroCafe from "@/assets/look-smart-casual-cafe.jpg";
import heroWochenende from "@/assets/look-wochenende-warm.jpg";
import heroSommer from "@/assets/look-sommer-leicht.jpg";
import heroAbend from "@/assets/look-abend-cognac.jpg";
import heroBusiness from "@/assets/look-business-klassiker.jpg";

export interface CuratedLook {
  slug: string;
  title: string;
  subtitle: string;
  welt: string; // matches welten id
  anlaesse: string[]; // anlass slugs
  productHandles: string[];
  story: string;
  hero?: string; // image asset path (optional — falls back to first product image)
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
    hero: heroBuero,
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
    hero: heroCafe,
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
    hero: heroWochenende,
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
    hero: heroSommer,
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
    hero: heroAbend,
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
    hero: heroBusiness,
  },
  {
    slug: "business-1",
    title: "Business-Look",
    subtitle: "Klar, präzise, souverän.",
    welt: "business",
    anlaesse: ["buero"],
    productHandles: ["venti-businesshemd-beige", "venti-anzughose-hellblau", "casa-moda-steppweste-gelb"],
    story: "Ein präzise sitzendes VENTI Businesshemd zur VENTI Anzughose — der ruhige Code für Tage, an denen Substanz zählt.",
  },
  {
    slug: "business-2",
    title: "Business-Look",
    subtitle: "Klar, präzise, souverän.",
    welt: "business",
    anlaesse: ["buero"],
    productHandles: ["venti-businesshemd-blau", "venti-anzughose-670-braun", "casa-moda-steppweste-beige"],
    story: "Ein präzise sitzendes VENTI Businesshemd zur VENTI Anzughose — der ruhige Code für Tage, an denen Substanz zählt.",
  },
  {
    slug: "business-3",
    title: "Business-Look",
    subtitle: "Klar, präzise, souverän.",
    welt: "business",
    anlaesse: ["buero"],
    productHandles: ["venti-businesshemd-mit-print-muster-in-blau-blau", "venti-anzughose-schwarz", "casa-moda-steppweste-gruen"],
    story: "Ein präzise sitzendes VENTI Businesshemd mit Print Muster in Blau zur VENTI Anzughose — der ruhige Code für Tage, an denen Substanz zählt.",
  },
  {
    slug: "business-4",
    title: "Business-Look",
    subtitle: "Klar, präzise, souverän.",
    welt: "business",
    anlaesse: ["buero"],
    productHandles: ["venti-businesshemd-dunkelblau", "venti-anzughose-670-braun", "venti-anzugweste-graues-mittelblau"],
    story: "Ein präzise sitzendes VENTI Businesshemd zur VENTI Anzughose — der ruhige Code für Tage, an denen Substanz zählt.",
  },
  {
    slug: "business-5",
    title: "Business-Look",
    subtitle: "Klar, präzise, souverän.",
    welt: "business",
    anlaesse: ["buero"],
    productHandles: ["venti-businesshemd-extra-langer-arm-69cm-dunkelblau", "venti-anzughose-670-braun", "casa-moda-steppweste-beige"],
    story: "Ein präzise sitzendes VENTI Businesshemd extra langer Arm 69cm zur VENTI Anzughose — der ruhige Code für Tage, an denen Substanz zählt.",
  },
  {
    slug: "business-6",
    title: "Business-Look",
    subtitle: "Klar, präzise, souverän.",
    welt: "business",
    anlaesse: ["buero"],
    productHandles: ["venti-businesshemd-extra-langer-arm-69cm-hellblau", "venti-anzughose-780-anthrazit", "casa-moda-steppweste-gruen"],
    story: "Ein präzise sitzendes VENTI Businesshemd extra langer Arm 69cm zur VENTI Anzughose — der ruhige Code für Tage, an denen Substanz zählt.",
  },
  {
    slug: "business-7",
    title: "Business-Look",
    subtitle: "Klar, präzise, souverän.",
    welt: "business",
    anlaesse: ["buero"],
    productHandles: ["venti-businesshemd-dunkelgruen", "venti-anzughose-dunkelgrau", "casa-moda-steppweste-hellgruen"],
    story: "Ein präzise sitzendes VENTI Businesshemd zur VENTI Anzughose — der ruhige Code für Tage, an denen Substanz zählt.",
  },
  {
    slug: "business-8",
    title: "Business-Look",
    subtitle: "Klar, präzise, souverän.",
    welt: "business",
    anlaesse: ["buero"],
    productHandles: ["venti-businesshemd-im-print-muster-dunkelgrau", "venti-anzughose-108-blau", "casa-moda-steppweste-hellgruen"],
    story: "Ein präzise sitzendes VENTI Businesshemd im Print Muster zur VENTI Anzughose — der ruhige Code für Tage, an denen Substanz zählt.",
  },
  {
    slug: "business-9",
    title: "Business-Look",
    subtitle: "Klar, präzise, souverän.",
    welt: "business",
    anlaesse: ["buero"],
    productHandles: ["venti-businesshemd-dunkelblau-dunkelblau", "venti-anzughose-670-braun", "casa-moda-steppweste-gruen"],
    story: "Ein präzise sitzendes VENTI Businesshemd Dunkelblau zur VENTI Anzughose — der ruhige Code für Tage, an denen Substanz zählt.",
  },
  {
    slug: "business-10",
    title: "Business-Look",
    subtitle: "Klar, präzise, souverän.",
    welt: "business",
    anlaesse: ["buero"],
    productHandles: ["venti-businesshemd-extra-langer-arm-69cm-weiss", "venti-anzughose-108-blau", "casa-moda-steppweste-gruen"],
    story: "Ein präzise sitzendes VENTI Businesshemd extra langer Arm 69cm zur VENTI Anzughose — der ruhige Code für Tage, an denen Substanz zählt.",
  },
  {
    slug: "business-11",
    title: "Business-Look",
    subtitle: "Klar, präzise, souverän.",
    welt: "business",
    anlaesse: ["buero"],
    productHandles: ["venti-businesshemd-extra-langer-arm-69cm-weissbeige", "venti-anzughose-hellblau", "casa-moda-steppweste-beige"],
    story: "Ein präzise sitzendes VENTI Businesshemd extra langer Arm 69cm zur VENTI Anzughose — der ruhige Code für Tage, an denen Substanz zählt.",
  },
  {
    slug: "business-12",
    title: "Business-Look",
    subtitle: "Klar, präzise, souverän.",
    welt: "business",
    anlaesse: ["buero"],
    productHandles: ["venti-businesshemd-extra-langer-arm-69cm-blau", "venti-anzughose-670-braun", "casa-moda-steppweste-blau"],
    story: "Ein präzise sitzendes VENTI Businesshemd extra langer Arm 69cm zur VENTI Anzughose — der ruhige Code für Tage, an denen Substanz zählt.",
  },
  {
    slug: "smart-casual-13",
    title: "Smart Casual",
    subtitle: "Locker mit Haltung.",
    welt: "smart-casual",
    anlaesse: ["alltag", "ausgang"],
    productHandles: ["casa-moda-polo-shirt-beige", "casa-moda-chinohose-chris-hellgrau"],
    story: "Ein CASA MODA Polo-Shirt zur CASA MODA Chinohose CHRIS — mühelos, modern, alltagstauglich.",
  },
  {
    slug: "smart-casual-14",
    title: "Smart Casual",
    subtitle: "Locker mit Haltung.",
    welt: "smart-casual",
    anlaesse: ["alltag", "ausgang"],
    productHandles: ["casa-moda-polo-shirt-blau", "casa-moda-jeans-steve-blau"],
    story: "Ein CASA MODA Polo-Shirt zur CASA MODA Jeans STEVE — mühelos, modern, alltagstauglich.",
  },
  {
    slug: "smart-casual-15",
    title: "Smart Casual",
    subtitle: "Locker mit Haltung.",
    welt: "smart-casual",
    anlaesse: ["alltag", "ausgang"],
    productHandles: ["casa-moda-polo-shirt-dunkelblau", "casa-moda-chinohose-chris-champagner-beige"],
    story: "Ein CASA MODA Polo-Shirt zur CASA MODA Chinohose CHRIS — mühelos, modern, alltagstauglich.",
  },
  {
    slug: "smart-casual-16",
    title: "Smart Casual",
    subtitle: "Locker mit Haltung.",
    welt: "smart-casual",
    anlaesse: ["alltag", "ausgang"],
    productHandles: ["casa-moda-polo-shirt-dunkelgrau", "casa-moda-chinohose-chris-hellgrau"],
    story: "Ein CASA MODA Polo-Shirt zur CASA MODA Chinohose CHRIS — mühelos, modern, alltagstauglich.",
  },
  {
    slug: "smart-casual-17",
    title: "Smart Casual",
    subtitle: "Locker mit Haltung.",
    welt: "smart-casual",
    anlaesse: ["alltag", "ausgang"],
    productHandles: ["casa-moda-polo-shirt-dunkelorange", "casa-moda-chinohose-chris-beige"],
    story: "Ein CASA MODA Polo-Shirt zur CASA MODA Chinohose CHRIS — mühelos, modern, alltagstauglich.",
  },
  {
    slug: "smart-casual-18",
    title: "Smart Casual",
    subtitle: "Locker mit Haltung.",
    welt: "smart-casual",
    anlaesse: ["alltag", "ausgang"],
    productHandles: ["casa-moda-polo-shirt-champagner", "casa-moda-jeans-steve-dunkelblau"],
    story: "Ein CASA MODA Polo-Shirt zur CASA MODA Jeans STEVE — mühelos, modern, alltagstauglich.",
  },
  {
    slug: "smart-casual-19",
    title: "Smart Casual",
    subtitle: "Locker mit Haltung.",
    welt: "smart-casual",
    anlaesse: ["alltag", "ausgang"],
    productHandles: ["casa-moda-polo-shirt-dunkelgruen", "casa-moda-jeans-steve-hellblau"],
    story: "Ein CASA MODA Polo-Shirt zur CASA MODA Jeans STEVE — mühelos, modern, alltagstauglich.",
  },
  {
    slug: "smart-casual-20",
    title: "Smart Casual",
    subtitle: "Locker mit Haltung.",
    welt: "smart-casual",
    anlaesse: ["alltag", "ausgang"],
    productHandles: ["casa-moda-polo-shirt-dunkelrot", "casa-moda-jeans-steve-grau"],
    story: "Ein CASA MODA Polo-Shirt zur CASA MODA Jeans STEVE — mühelos, modern, alltagstauglich.",
  },
  {
    slug: "smart-casual-21",
    title: "Smart Casual",
    subtitle: "Locker mit Haltung.",
    welt: "smart-casual",
    anlaesse: ["alltag", "ausgang"],
    productHandles: ["casa-moda-polo-shirt-dunkles-mittelblau", "casa-moda-chinohose-chris-hellgruen"],
    story: "Ein CASA MODA Polo-Shirt zur CASA MODA Chinohose CHRIS — mühelos, modern, alltagstauglich.",
  },
  {
    slug: "smart-casual-22",
    title: "Smart Casual",
    subtitle: "Locker mit Haltung.",
    welt: "smart-casual",
    anlaesse: ["alltag", "ausgang"],
    productHandles: ["casa-moda-polo-shirt-gelb", "casa-moda-jeans-steve-hellblau"],
    story: "Ein CASA MODA Polo-Shirt zur CASA MODA Jeans STEVE — mühelos, modern, alltagstauglich.",
  },
  {
    slug: "smart-casual-23",
    title: "Smart Casual",
    subtitle: "Locker mit Haltung.",
    welt: "smart-casual",
    anlaesse: ["alltag", "ausgang"],
    productHandles: ["casa-moda-polo-shirt-graues-mittelblau", "casa-moda-chinohose-chris-hellgrau"],
    story: "Ein CASA MODA Polo-Shirt zur CASA MODA Chinohose CHRIS — mühelos, modern, alltagstauglich.",
  },
  {
    slug: "smart-casual-24",
    title: "Smart Casual",
    subtitle: "Locker mit Haltung.",
    welt: "smart-casual",
    anlaesse: ["alltag", "ausgang"],
    productHandles: ["casa-moda-polo-shirt-dunkles-tuerkis", "casa-moda-chinohose-chris-champagner-beige"],
    story: "Ein CASA MODA Polo-Shirt zur CASA MODA Chinohose CHRIS — mühelos, modern, alltagstauglich.",
  },
  {
    slug: "freizeit-25",
    title: "Freizeit-Layer",
    subtitle: "Wärme, die nach Stil aussieht.",
    welt: "freizeit",
    anlaesse: ["alltag", "reisen"],
    productHandles: ["casa-moda-pullover-663-beige", "casa-moda-freizeithemd-kurzarm-blau", "casa-moda-chinohose-chris-champagner-beige"],
    story: "Ein CASA MODA Pullover über einem Hemd, dazu eine CASA MODA Chinohose CHRIS — die Definition eines guten Wochenendes.",
  },
  {
    slug: "freizeit-26",
    title: "Freizeit-Layer",
    subtitle: "Wärme, die nach Stil aussieht.",
    welt: "freizeit",
    anlaesse: ["alltag", "reisen"],
    productHandles: ["casa-moda-pullover-braun", "casa-moda-freizeithemd-kurzarm-hellblau", "casa-moda-chinohose-chris-champagner-beige"],
    story: "Ein CASA MODA Pullover über einem Hemd, dazu eine CASA MODA Chinohose CHRIS — die Definition eines guten Wochenendes.",
  },
  {
    slug: "freizeit-27",
    title: "Freizeit-Layer",
    subtitle: "Wärme, die nach Stil aussieht.",
    welt: "freizeit",
    anlaesse: ["alltag", "reisen"],
    productHandles: ["casa-moda-pullover-graues-mittelblau", "casa-moda-freizeithemd-kurzarm-gruen", "casa-moda-jeans-steve-blau"],
    story: "Ein CASA MODA Pullover über einem Hemd, dazu eine CASA MODA Jeans STEVE — die Definition eines guten Wochenendes.",
  },
  {
    slug: "freizeit-28",
    title: "Freizeit-Layer",
    subtitle: "Wärme, die nach Stil aussieht.",
    welt: "freizeit",
    anlaesse: ["alltag", "reisen"],
    productHandles: ["casa-moda-pullover-741-silber", "casa-moda-freizeithemd-kurzarm-gruen", "casa-moda-chinohose-chris-dunkelblau"],
    story: "Ein CASA MODA Pullover über einem Hemd, dazu eine CASA MODA Chinohose CHRIS — die Definition eines guten Wochenendes.",
  },
  {
    slug: "freizeit-29",
    title: "Freizeit-Layer",
    subtitle: "Wärme, die nach Stil aussieht.",
    welt: "freizeit",
    anlaesse: ["alltag", "reisen"],
    productHandles: ["casa-moda-pullover-champagner", "casa-moda-freizeithemd-kurzarm-gelb", "casa-moda-jeans-steve-blau"],
    story: "Ein CASA MODA Pullover über einem Hemd, dazu eine CASA MODA Jeans STEVE — die Definition eines guten Wochenendes.",
  },
  {
    slug: "freizeit-30",
    title: "Freizeit-Layer",
    subtitle: "Wärme, die nach Stil aussieht.",
    welt: "freizeit",
    anlaesse: ["alltag", "reisen"],
    productHandles: ["casa-moda-pullover-champagner-beige", "casa-moda-freizeithemd-kurzarm-dunkelblau", "casa-moda-chinohose-chris-hellgruen"],
    story: "Ein CASA MODA Pullover über einem Hemd, dazu eine CASA MODA Chinohose CHRIS — die Definition eines guten Wochenendes.",
  },
  {
    slug: "freizeit-31",
    title: "Freizeit-Layer",
    subtitle: "Wärme, die nach Stil aussieht.",
    welt: "freizeit",
    anlaesse: ["alltag", "reisen"],
    productHandles: ["casa-moda-pullover-dunkelgrau", "casa-moda-freizeithemd-kurzarm-blau", "casa-moda-chinohose-chris-dunkelblau"],
    story: "Ein CASA MODA Pullover über einem Hemd, dazu eine CASA MODA Chinohose CHRIS — die Definition eines guten Wochenendes.",
  },
  {
    slug: "freizeit-32",
    title: "Freizeit-Layer",
    subtitle: "Wärme, die nach Stil aussieht.",
    welt: "freizeit",
    anlaesse: ["alltag", "reisen"],
    productHandles: ["casa-moda-pullover-gelb", "casa-moda-freizeithemd-kurzarm-gruen", "casa-moda-jeans-steve-blau"],
    story: "Ein CASA MODA Pullover über einem Hemd, dazu eine CASA MODA Jeans STEVE — die Definition eines guten Wochenendes.",
  },
  {
    slug: "freizeit-33",
    title: "Freizeit-Layer",
    subtitle: "Wärme, die nach Stil aussieht.",
    welt: "freizeit",
    anlaesse: ["alltag", "reisen"],
    productHandles: ["casa-moda-pullover-dunkelorange", "casa-moda-freizeithemd-kurzarm-dunkelblau", "casa-moda-chinohose-chris-dunkelblau"],
    story: "Ein CASA MODA Pullover über einem Hemd, dazu eine CASA MODA Chinohose CHRIS — die Definition eines guten Wochenendes.",
  },
  {
    slug: "freizeit-34",
    title: "Freizeit-Layer",
    subtitle: "Wärme, die nach Stil aussieht.",
    welt: "freizeit",
    anlaesse: ["alltag", "reisen"],
    productHandles: ["casa-moda-pullover-hellblau", "casa-moda-freizeithemd-kurzarm-dunkelblau", "casa-moda-chinohose-chris-gruen"],
    story: "Ein CASA MODA Pullover über einem Hemd, dazu eine CASA MODA Chinohose CHRIS — die Definition eines guten Wochenendes.",
  },
  {
    slug: "sommer-35",
    title: "Sommer, leicht",
    subtitle: "Leinen, Luft, Pause.",
    welt: "sommer",
    anlaesse: ["sommer", "reisen"],
    productHandles: ["casa-moda-leinenhemd-beige", "casa-moda-34-bermuda-ben-champagner-beige"],
    story: "Leinen atmet, der Schnitt sitzt — der ehrlichste Sommer-Look mit CASA MODA Leinenhemd und CASA MODA 3/4 - Bermuda BEN.",
  },
  {
    slug: "sommer-36",
    title: "Sommer, leicht",
    subtitle: "Leinen, Luft, Pause.",
    welt: "sommer",
    anlaesse: ["sommer", "reisen"],
    productHandles: ["casa-moda-leinenhemd-blau", "casa-moda-3-4-bermuda-ben-beige"],
    story: "Leinen atmet, der Schnitt sitzt — der ehrlichste Sommer-Look mit CASA MODA Leinenhemd und CASA MODA 3/4 - Bermuda BEN.",
  },
  {
    slug: "sommer-37",
    title: "Sommer, leicht",
    subtitle: "Leinen, Luft, Pause.",
    welt: "sommer",
    anlaesse: ["sommer", "reisen"],
    productHandles: ["casa-moda-leinenhemd-dunkelgruen", "casa-moda-3-4-bermuda-ben-dunkelblau"],
    story: "Leinen atmet, der Schnitt sitzt — der ehrlichste Sommer-Look mit CASA MODA Leinenhemd und CASA MODA 3/4 - Bermuda BEN.",
  },
  {
    slug: "sommer-38",
    title: "Sommer, leicht",
    subtitle: "Leinen, Luft, Pause.",
    welt: "sommer",
    anlaesse: ["sommer", "reisen"],
    productHandles: ["casa-moda-leinenhemd-hellblau", "casa-moda-jeans-shorts-steve-grau"],
    story: "Leinen atmet, der Schnitt sitzt — der ehrlichste Sommer-Look mit CASA MODA Leinenhemd und CASA MODA Jeans shorts STEVE.",
  },
  {
    slug: "sommer-39",
    title: "Sommer, leicht",
    subtitle: "Leinen, Luft, Pause.",
    welt: "sommer",
    anlaesse: ["sommer", "reisen"],
    productHandles: ["casa-moda-leinenhemd-kurzarm-blau", "casa-moda-jeans-shorts-steve-dunkelblau"],
    story: "Leinen atmet, der Schnitt sitzt — der ehrlichste Sommer-Look mit CASA MODA Leinenhemd Kurzarm und CASA MODA Jeans shorts STEVE.",
  },
  {
    slug: "sommer-40",
    title: "Sommer, leicht",
    subtitle: "Leinen, Luft, Pause.",
    welt: "sommer",
    anlaesse: ["sommer", "reisen"],
    productHandles: ["casa-moda-leinenhemd-kurzarm-gruen", "casa-moda-chinohose-chris-hellgruen"],
    story: "Leinen atmet, der Schnitt sitzt — der ehrlichste Sommer-Look mit CASA MODA Leinenhemd Kurzarm und CASA MODA Chinohose CHRIS.",
  },
  {
    slug: "sommer-41",
    title: "Sommer, leicht",
    subtitle: "Leinen, Luft, Pause.",
    welt: "sommer",
    anlaesse: ["sommer", "reisen"],
    productHandles: ["casa-moda-leinenhemd-kurzarm-hellblau", "casa-moda-jeans-shorts-steve-dunkelblau"],
    story: "Leinen atmet, der Schnitt sitzt — der ehrlichste Sommer-Look mit CASA MODA Leinenhemd Kurzarm und CASA MODA Jeans shorts STEVE.",
  },
  {
    slug: "sommer-42",
    title: "Sommer, leicht",
    subtitle: "Leinen, Luft, Pause.",
    welt: "sommer",
    anlaesse: ["sommer", "reisen"],
    productHandles: ["casa-moda-leinenhemd-kurzarm-dunkelgruen", "casa-moda-chinohose-chris-hellgrau"],
    story: "Leinen atmet, der Schnitt sitzt — der ehrlichste Sommer-Look mit CASA MODA Leinenhemd Kurzarm und CASA MODA Chinohose CHRIS.",
  },
  {
    slug: "sommer-43",
    title: "Sommer, leicht",
    subtitle: "Leinen, Luft, Pause.",
    welt: "sommer",
    anlaesse: ["sommer", "reisen"],
    productHandles: ["casa-moda-leinenhemd-kurzarm-weiss", "casa-moda-34-bermuda-ben-grau"],
    story: "Leinen atmet, der Schnitt sitzt — der ehrlichste Sommer-Look mit CASA MODA Leinenhemd Kurzarm und CASA MODA 3/4 - Bermuda BEN.",
  },
  {
    slug: "sommer-44",
    title: "Sommer, leicht",
    subtitle: "Leinen, Luft, Pause.",
    welt: "sommer",
    anlaesse: ["sommer", "reisen"],
    productHandles: ["casa-moda-leinenhemd-schwarz", "casa-moda-chino-shorts-chris-dunkelblau"],
    story: "Leinen atmet, der Schnitt sitzt — der ehrlichste Sommer-Look mit CASA MODA Leinenhemd und CASA MODA Chino shorts CHRIS.",
  },
  {
    slug: "sommer-polo-45",
    title: "Polo & Bermuda",
    subtitle: "Polo, Pikee, Pause.",
    welt: "sommer",
    anlaesse: ["sommer"],
    productHandles: ["casa-moda-polo-shirt-hellblau", "casa-moda-jeans-shorts-steve-sattes-mittelblau"],
    story: "Polo, Bermuda, Sneaker — der wohl entspannteste Sommer-Code.",
  },
  {
    slug: "sommer-polo-46",
    title: "Polo & Bermuda",
    subtitle: "Polo, Pikee, Pause.",
    welt: "sommer",
    anlaesse: ["sommer"],
    productHandles: ["casa-moda-polo-shirt-graues-dunkelblau", "casa-moda-chino-shorts-chris-dunkelblau"],
    story: "Polo, Bermuda, Sneaker — der wohl entspannteste Sommer-Code.",
  },
  {
    slug: "sommer-polo-47",
    title: "Polo & Bermuda",
    subtitle: "Polo, Pikee, Pause.",
    welt: "sommer",
    anlaesse: ["sommer"],
    productHandles: ["casa-moda-polo-shirt-gruen", "casa-moda-3-4-bermuda-ben-dunkelblau"],
    story: "Polo, Bermuda, Sneaker — der wohl entspannteste Sommer-Code.",
  },
  {
    slug: "sommer-polo-48",
    title: "Polo & Bermuda",
    subtitle: "Polo, Pikee, Pause.",
    welt: "sommer",
    anlaesse: ["sommer"],
    productHandles: ["casa-moda-polo-shirt-grau", "casa-moda-jeans-shorts-steve-dunkelblau"],
    story: "Polo, Bermuda, Sneaker — der wohl entspannteste Sommer-Code.",
  },
  {
    slug: "sommer-polo-49",
    title: "Polo & Bermuda",
    subtitle: "Polo, Pikee, Pause.",
    welt: "sommer",
    anlaesse: ["sommer"],
    productHandles: ["casa-moda-polo-shirt-hellgruen", "casa-moda-34-bermuda-ben-champagner-beige"],
    story: "Polo, Bermuda, Sneaker — der wohl entspannteste Sommer-Code.",
  },
  {
    slug: "sommer-polo-50",
    title: "Polo & Bermuda",
    subtitle: "Polo, Pikee, Pause.",
    welt: "sommer",
    anlaesse: ["sommer"],
    productHandles: ["casa-moda-polo-shirt-hellorange", "casa-moda-bermuda-ben-beige"],
    story: "Polo, Bermuda, Sneaker — der wohl entspannteste Sommer-Code.",
  },
  {
    slug: "sommer-polo-51",
    title: "Polo & Bermuda",
    subtitle: "Polo, Pikee, Pause.",
    welt: "sommer",
    anlaesse: ["sommer"],
    productHandles: ["casa-moda-polo-shirt-hellrot", "casa-moda-3-4-bermuda-ben-beige"],
    story: "Polo, Bermuda, Sneaker — der wohl entspannteste Sommer-Code.",
  },
  {
    slug: "sommer-polo-52",
    title: "Polo & Bermuda",
    subtitle: "Polo, Pikee, Pause.",
    welt: "sommer",
    anlaesse: ["sommer"],
    productHandles: ["casa-moda-polo-shirt-helltuerkis", "casa-moda-3-4-bermuda-ben-beige"],
    story: "Polo, Bermuda, Sneaker — der wohl entspannteste Sommer-Code.",
  },
  {
    slug: "abend-53",
    title: "Abendlicht-Look",
    subtitle: "Ein Look, der die Stunde fühlt.",
    welt: "smart-casual",
    anlaesse: ["ausgang", "besondere-anlaesse"],
    productHandles: ["venti-businesshemd-beige", "casa-moda-jeans-steve-grau", "casa-moda-blouson-olive"],
    story: "VENTI Businesshemd, dunkle Jeans und eine CASA MODA Blouson — für Abende, die etwas länger gehen.",
  },
  {
    slug: "abend-54",
    title: "Abendlicht-Look",
    subtitle: "Ein Look, der die Stunde fühlt.",
    welt: "smart-casual",
    anlaesse: ["ausgang", "besondere-anlaesse"],
    productHandles: ["venti-businesshemd-blau", "casa-moda-jeans-steve-blau", "casa-moda-sommerjacke-dunkelblau"],
    story: "VENTI Businesshemd, dunkle Jeans und eine CASA MODA Sommerjacke — für Abende, die etwas länger gehen.",
  },
  {
    slug: "abend-55",
    title: "Abendlicht-Look",
    subtitle: "Ein Look, der die Stunde fühlt.",
    welt: "smart-casual",
    anlaesse: ["ausgang", "besondere-anlaesse"],
    productHandles: ["venti-businesshemd-mit-print-muster-in-blau-blau", "casa-moda-jeans-steve-hellblau", "casa-moda-steppjacke-gelb"],
    story: "VENTI Businesshemd mit Print Muster in Blau, dunkle Jeans und eine CASA MODA Steppjacke — für Abende, die etwas länger gehen.",
  },
  {
    slug: "abend-56",
    title: "Abendlicht-Look",
    subtitle: "Ein Look, der die Stunde fühlt.",
    welt: "smart-casual",
    anlaesse: ["ausgang", "besondere-anlaesse"],
    productHandles: ["venti-businesshemd-dunkelblau", "casa-moda-jeans-steve-dunkelblau", "casa-moda-steppjacke-hellgruen"],
    story: "VENTI Businesshemd, dunkle Jeans und eine CASA MODA Steppjacke — für Abende, die etwas länger gehen.",
  },
  {
    slug: "abend-57",
    title: "Abendlicht-Look",
    subtitle: "Ein Look, der die Stunde fühlt.",
    welt: "smart-casual",
    anlaesse: ["ausgang", "besondere-anlaesse"],
    productHandles: ["venti-businesshemd-extra-langer-arm-69cm-dunkelblau", "casa-moda-jeans-steve-schwarz", "casa-moda-steppjacke-dunkelblau"],
    story: "VENTI Businesshemd extra langer Arm 69cm, dunkle Jeans und eine CASA MODA Steppjacke — für Abende, die etwas länger gehen.",
  },
  {
    slug: "abend-58",
    title: "Abendlicht-Look",
    subtitle: "Ein Look, der die Stunde fühlt.",
    welt: "smart-casual",
    anlaesse: ["ausgang", "besondere-anlaesse"],
    productHandles: ["venti-businesshemd-extra-langer-arm-69cm-hellblau", "casa-moda-jeans-steve-grau", "casa-moda-sommerjacke-dunkelblau"],
    story: "VENTI Businesshemd extra langer Arm 69cm, dunkle Jeans und eine CASA MODA Sommerjacke — für Abende, die etwas länger gehen.",
  },
  {
    slug: "abend-59",
    title: "Abendlicht-Look",
    subtitle: "Ein Look, der die Stunde fühlt.",
    welt: "smart-casual",
    anlaesse: ["ausgang", "besondere-anlaesse"],
    productHandles: ["casa-moda-freizeithemd-kurzarm-blau", "casa-moda-jeans-steve-schwarz", "casa-moda-blouson-schwarz"],
    story: "CASA MODA Freizeithemd Kurzarm, dunkle Jeans und eine CASA MODA Blouson — für Abende, die etwas länger gehen.",
  },
  {
    slug: "abend-60",
    title: "Abendlicht-Look",
    subtitle: "Ein Look, der die Stunde fühlt.",
    welt: "smart-casual",
    anlaesse: ["ausgang", "besondere-anlaesse"],
    productHandles: ["casa-moda-freizeithemd-kurzarm-dunkelblau", "casa-moda-jeans-steve-hellblau", "casa-moda-blouson-schwarz"],
    story: "CASA MODA Freizeithemd Kurzarm, dunkle Jeans und eine CASA MODA Blouson — für Abende, die etwas länger gehen.",
  },
  {
    slug: "abend-61",
    title: "Abendlicht-Look",
    subtitle: "Ein Look, der die Stunde fühlt.",
    welt: "smart-casual",
    anlaesse: ["ausgang", "besondere-anlaesse"],
    productHandles: ["casa-moda-freizeithemd-kurzarm-gelb", "casa-moda-jeans-steve-hellblau", "casa-moda-sommerjacke-beige"],
    story: "CASA MODA Freizeithemd Kurzarm, dunkle Jeans und eine CASA MODA Sommerjacke — für Abende, die etwas länger gehen.",
  },
  {
    slug: "abend-62",
    title: "Abendlicht-Look",
    subtitle: "Ein Look, der die Stunde fühlt.",
    welt: "smart-casual",
    anlaesse: ["ausgang", "besondere-anlaesse"],
    productHandles: ["casa-moda-freizeithemd-kurzarm-gruen", "casa-moda-jeans-steve-schwarz", "casa-moda-sommerjacke-dunkelblau"],
    story: "CASA MODA Freizeithemd Kurzarm, dunkle Jeans und eine CASA MODA Sommerjacke — für Abende, die etwas länger gehen.",
  },
  {
    slug: "abend-63",
    title: "Abendlicht-Look",
    subtitle: "Ein Look, der die Stunde fühlt.",
    welt: "smart-casual",
    anlaesse: ["ausgang", "besondere-anlaesse"],
    productHandles: ["casa-moda-freizeithemd-kurzarm-hellblau", "casa-moda-jeans-steve-grau", "casa-moda-steppjacke-dunkelblau"],
    story: "CASA MODA Freizeithemd Kurzarm, dunkle Jeans und eine CASA MODA Steppjacke — für Abende, die etwas länger gehen.",
  },
  {
    slug: "hemdjacke-64",
    title: "Hemdjacken-Layer",
    subtitle: "Eine Schicht, die alles verbindet.",
    welt: "smart-casual",
    anlaesse: ["alltag", "ausgang"],
    productHandles: ["casa-moda-t-shirt-weiss", "casa-moda-jeans-steve-dunkelblau", "venti-hemdjacke-dunkelblau"],
    story: "Eine VENTI Hemdjacke ist die ehrlichste Form von Übergangsstil — über T-Shirt, zur Jeans, fertig.",
  },
  {
    slug: "hemdjacke-65",
    title: "Hemdjacken-Layer",
    subtitle: "Eine Schicht, die alles verbindet.",
    welt: "smart-casual",
    anlaesse: ["alltag", "ausgang"],
    productHandles: ["casa-moda-t-shirt-hellbraun", "casa-moda-jeans-steve-grau", "venti-hemdjacke-gruen"],
    story: "Eine VENTI Hemdjacke ist die ehrlichste Form von Übergangsstil — über T-Shirt, zur Jeans, fertig.",
  },
  {
    slug: "hemdjacke-66",
    title: "Hemdjacken-Layer",
    subtitle: "Eine Schicht, die alles verbindet.",
    welt: "smart-casual",
    anlaesse: ["alltag", "ausgang"],
    productHandles: ["casa-moda-t-shirt-gruen", "casa-moda-chinohose-chris-champagner-beige", "venti-hemdjacke-dunkelblau-1"],
    story: "Eine VENTI Hemdjacke ist die ehrlichste Form von Übergangsstil — über T-Shirt, zur Jeans, fertig.",
  },
  {
    slug: "hemdjacke-67",
    title: "Hemdjacken-Layer",
    subtitle: "Eine Schicht, die alles verbindet.",
    welt: "smart-casual",
    anlaesse: ["alltag", "ausgang"],
    productHandles: ["casa-moda-henley-blau", "casa-moda-chinohose-chris-beige", "venti-hemdjacke-gruen-1"],
    story: "Eine VENTI Hemdjacke ist die ehrlichste Form von Übergangsstil — über T-Shirt, zur Jeans, fertig.",
  },
];

// Auto-attach generated lifestyle hero images for looks that don't already have one.
const generatedHeroes = import.meta.glob<{ default: string }>(
  "../assets/looks-generated/*.jpg",
  { eager: true },
);
const heroBySlug: Record<string, string> = {};
for (const [path, mod] of Object.entries(generatedHeroes)) {
  const slug = path.split("/").pop()!.replace(/\.jpg$/, "");
  heroBySlug[slug] = mod.default;
}
for (const look of looks) {
  if (!look.hero && heroBySlug[look.slug]) {
    look.hero = heroBySlug[look.slug];
  }
}

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
    slug: "casa-moda",
    name: "CASA MODA",
    tagline: "Hemden, Polos & Hosen mit Haltung.",
    story:
      "CASA MODA steht für sorgfältig gefertigte Hemden, Polos und Hosen mit präzisem Schnitt und langlebiger Qualität. Eine Marke für alle, die das Detail sehen.",
  },
  {
    slug: "venti",
    name: "VENTI",
    tagline: "Business-Hemden & Anzughosen, klar gedacht.",
    story:
      "VENTI bringt moderne Silhouetten ins Hemd und in die Anzughose. Klare Muster und Stoffe, die mitarbeiten — vom Büro bis ins Wochenende.",
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
