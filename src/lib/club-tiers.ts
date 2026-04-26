export type ClubTierKey = "bronze" | "silber" | "gold";

export interface ClubTier {
  key: ClubTierKey;
  name: string;
  threshold: number;
  discountPercent: number;
  tagline: string;
  perks: string[];
  /** Demo discount code shown in the dashboard */
  code: string;
}

export const CLUB_TIERS: ClubTier[] = [
  {
    key: "bronze",
    name: "Bronze",
    threshold: 0,
    discountPercent: 5,
    tagline: "Dein Einstieg in den Club.",
    perks: [
      "5 % Rabatt auf alle Bestellungen",
      "Gratis Versand ab 100 CHF",
      "100 Willkommens-Punkte",
      "Newsletter mit Stil-Tipps",
    ],
    code: "CLUB-BRONZE-5",
  },
  {
    key: "silber",
    name: "Silber",
    threshold: 500,
    discountPercent: 10,
    tagline: "Für regelmässige Begleiter.",
    perks: [
      "10 % Rabatt auf alle Bestellungen",
      "Gratis Versand & Retoure",
      "Early Access zu neuen Drops (24 h)",
      "Doppelte Punkte an deinem Geburtstag",
    ],
    code: "CLUB-SILBER-10",
  },
  {
    key: "gold",
    name: "Gold",
    threshold: 1500,
    discountPercent: 15,
    tagline: "Für echte Stil-Liebhaber.",
    perks: [
      "15 % Rabatt auf alle Bestellungen",
      "Persönlicher Stil-Concierge",
      "Geburtstags-Geschenk",
      "Zugang zu Preview-Sales & Limited Editions",
    ],
    code: "CLUB-GOLD-15",
  },
];

export const tierForPoints = (points: number): ClubTier => {
  let current = CLUB_TIERS[0];
  for (const tier of CLUB_TIERS) {
    if (points >= tier.threshold) current = tier;
  }
  return current;
};

export const nextTier = (points: number): ClubTier | null => {
  return CLUB_TIERS.find((t) => t.threshold > points) ?? null;
};

export const progressToNext = (points: number): { from: number; to: number; percent: number } | null => {
  const current = tierForPoints(points);
  const next = nextTier(points);
  if (!next) return null;
  const span = next.threshold - current.threshold;
  const done = points - current.threshold;
  return {
    from: current.threshold,
    to: next.threshold,
    percent: Math.max(0, Math.min(100, Math.round((done / span) * 100))),
  };
};
