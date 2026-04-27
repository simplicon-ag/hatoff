import { Truck, RotateCcw, ShieldCheck, Package, CheckCircle2 } from "lucide-react";
import { PaymentMethodsRow } from "./PaymentMethodsRow";

export const TrustBadges = ({ inStock = true }: { inStock?: boolean }) => (
  <div className="space-y-4 border-t border-border pt-6">
    {inStock && (
      <div className="flex items-center gap-2 text-xs text-foreground/80">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        <span>
          <span className="font-medium">Auf Lager</span> · Versand innert 24 Std.
        </span>
      </div>
    )}
    <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
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
    <PaymentMethodsRow className="pt-2" />
  </div>
);
