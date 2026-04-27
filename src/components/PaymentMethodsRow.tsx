/**
 * Akzeptierte Zahlungsmethoden — dezente Wortmarken-Reihe.
 * Bewusst als Text statt SVG-Logos (Markenrechte, konsistente Optik mit HATOFF-Editorial-Stil).
 */
export const PaymentMethodsRow = ({ className = "" }: { className?: string }) => {
  const methods = ["Twint", "Visa", "Mastercard", "Amex", "PayPal", "Apple Pay"];
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>
      <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        Sichere Zahlung
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {methods.map((m) => (
          <span
            key={m}
            className="rounded-sm border border-border bg-background px-2 py-1 text-[10px] font-medium tracking-wide text-foreground/70"
          >
            {m}
          </span>
        ))}
      </div>
    </div>
  );
};
