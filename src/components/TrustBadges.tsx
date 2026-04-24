import { Truck, RotateCcw, ShieldCheck, Package } from "lucide-react";

export const TrustBadges = () => (
  <div className="grid grid-cols-2 gap-3 border-t border-border pt-6 text-xs sm:grid-cols-4">
    {[
      { icon: Truck, label: "Versand 3–5 Tage" },
      { icon: RotateCcw, label: "30 Tage Rückgabe" },
      { icon: ShieldCheck, label: "Sichere Zahlung" },
      { icon: Package, label: "Sorgfältig verpackt" },
    ].map(({ icon: Icon, label }) => (
      <div key={label} className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4 shrink-0 text-primary" />
        <span className="leading-tight">{label}</span>
      </div>
    ))}
  </div>
);
