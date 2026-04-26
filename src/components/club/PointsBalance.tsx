import { Progress } from "@/components/ui/progress";
import type { ClubTier } from "@/lib/club-tiers";

interface Props {
  points: number;
  tier: ClubTier;
  next: ClubTier | null;
  progress: { from: number; to: number; percent: number } | null;
}

export const PointsBalance = ({ points, tier, next, progress }: Props) => {
  return (
    <div className="border border-border bg-card p-8 md:p-10">
      <p className="text-[11px] uppercase tracking-[0.4em] text-muted-foreground">Dein Punktestand</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="font-display text-6xl leading-none md:text-7xl">
            {points.toLocaleString("de-CH")}
          </span>
          <span className="ml-3 text-sm uppercase tracking-[0.2em] text-muted-foreground">Punkte</span>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Aktuelle Stufe</p>
          <p className="mt-1 font-display text-2xl">
            {tier.name} · {tier.discountPercent}%
          </p>
        </div>
      </div>

      {next && progress ? (
        <div className="mt-8">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{tier.name}</span>
            <span>
              Noch {(next.threshold - points).toLocaleString("de-CH")} Punkte bis {next.name}
            </span>
            <span>{next.name}</span>
          </div>
          <Progress value={progress.percent} className="mt-2 h-2" />
        </div>
      ) : (
        <p className="mt-8 text-sm text-muted-foreground">
          Du hast die höchste Stufe erreicht. Hut ab — Stil pur.
        </p>
      )}
    </div>
  );
};
