import { Check, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClubTier } from "@/lib/club-tiers";

interface Props {
  tier: ClubTier;
  current?: boolean;
  reached?: boolean;
}

const accentByTier: Record<string, string> = {
  bronze: "from-[hsl(27_43%_30%)] to-[hsl(14_49%_58%)]",
  silber: "from-[hsl(30_8%_45%)] to-[hsl(30_6%_70%)]",
  gold: "from-[hsl(40_70%_45%)] to-[hsl(40_85%_65%)]",
};

export const TierCard = ({ tier, current, reached }: Props) => {
  return (
    <div
      className={cn(
        "relative flex h-full flex-col border bg-card p-6 transition-colors",
        current
          ? "border-foreground shadow-[var(--shadow-soft)]"
          : "border-border hover:border-foreground/40",
      )}
    >
      {current && (
        <span className="absolute -top-3 left-6 inline-flex items-center gap-1 bg-foreground px-2.5 py-1 text-[10px] uppercase tracking-[0.25em] text-background">
          <Crown className="h-3 w-3" /> Du bist hier
        </span>
      )}

      <div
        className={cn(
          "h-1 w-12 bg-gradient-to-r",
          accentByTier[tier.key] ?? accentByTier.bronze,
        )}
      />

      <h3 className="mt-5 font-display text-2xl">{tier.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{tier.tagline}</p>

      <div className="mt-5 flex items-baseline gap-2">
        <span className="font-display text-5xl">{tier.discountPercent}%</span>
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Rabatt</span>
      </div>
      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Ab {tier.threshold.toLocaleString("de-CH")} Punkten
      </p>

      <ul className="mt-6 flex-1 space-y-2.5 text-sm">
        {tier.perks.map((perk) => (
          <li key={perk} className="flex items-start gap-2 text-foreground/85">
            <Check className={cn("mt-0.5 h-4 w-4 shrink-0", reached ? "text-foreground" : "text-muted-foreground")} />
            <span>{perk}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
