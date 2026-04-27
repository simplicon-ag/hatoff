import { Truck, RotateCcw, ShieldCheck, MapPin, MessageCircle } from "lucide-react";

const ITEMS = [
  {
    icon: Truck,
    title: "Gratis CH-Versand",
    sub: "ab CHF 100",
  },
  {
    icon: RotateCcw,
    title: "30 Tage Retoure",
    sub: "kostenlos & einfach",
  },
  {
    icon: ShieldCheck,
    title: "Sichere Zahlung",
    sub: "Twint, Visa, PayPal …",
  },
  {
    icon: MapPin,
    title: "Versand aus der Schweiz",
    sub: "verlässlich, schnell",
  },
  {
    icon: MessageCircle,
    title: "Stilberatung",
    sub: "persönlich per Mail",
  },
];

export const TrustBar = () => (
  <section
    aria-label="HATOFF Versprechen"
    className="border-y border-border bg-secondary/40"
  >
    <div className="container-editorial py-8 md:py-10">
      <ul className="grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-5">
        {ITEMS.map(({ icon: Icon, title, sub }) => (
          <li key={title} className="flex items-start gap-3">
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-foreground/70" strokeWidth={1.5} />
            <div className="leading-tight">
              <p className="text-sm font-medium text-foreground">{title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  </section>
);
