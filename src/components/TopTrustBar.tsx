import { Check } from "lucide-react";

const items = [
  "Kostenloser Versand ab CHF 99",
  "30 Tage Rückgaberecht",
  "Kauf auf Rechnung & Teilzahlung",
  "Schweizer Kundenservice",
];

/**
 * Schmale dunkle Bar ganz oben — analog PKZ. Listet Trust-Elemente,
 * Desktop alle nebeneinander, Mobile als horizontaler Lauftext-Stack
 * (wir lassen nur 1–2 Items sichtbar, der Rest wäre zu eng).
 */
export const TopTrustBar = () => (
  <div className="w-full bg-foreground text-background">
    <div className="container-editorial flex h-9 items-center justify-center gap-8 text-[11px] font-medium tracking-wide">
      {items.map((label, i) => (
        <span
          key={label}
          className={`inline-flex items-center gap-1.5 ${
            i === 0 ? "" : "hidden md:inline-flex"
          }`}
        >
          <Check className="h-3 w-3 text-background/80" strokeWidth={2.5} />
          <span className="text-background/90">{label}</span>
        </span>
      ))}
    </div>
  </div>
);
