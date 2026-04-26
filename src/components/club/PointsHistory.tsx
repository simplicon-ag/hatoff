import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { PointsLedgerEntry } from "@/hooks/useClubPoints";

const reasonLabel: Record<string, string> = {
  welcome_bonus: "Willkommens-Bonus",
  purchase: "Einkauf",
  birthday: "Geburtstags-Geschenk",
  manual: "Gutschrift",
  demo_grant: "Demo-Gutschrift",
  redemption: "Einlösung",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("de-CH", { day: "2-digit", month: "short", year: "numeric" });

export const PointsHistory = ({ entries }: { entries: PointsLedgerEntry[] }) => {
  if (entries.length === 0) {
    return (
      <p className="border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
        Noch keine Punkte-Bewegungen.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border border border-border bg-card">
      {entries.map((e) => {
        const positive = e.points >= 0;
        return (
          <li key={e.id} className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full ${
                  positive ? "bg-foreground/5 text-foreground" : "bg-destructive/10 text-destructive"
                }`}
              >
                {positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              </span>
              <div>
                <p className="text-sm font-medium">{reasonLabel[e.reason] ?? e.reason}</p>
                <p className="text-xs text-muted-foreground">{fmtDate(e.created_at)}</p>
              </div>
            </div>
            <span className={`font-display text-lg ${positive ? "" : "text-destructive"}`}>
              {positive ? "+" : ""}
              {e.points}
            </span>
          </li>
        );
      })}
    </ul>
  );
};
