import { Gift, Truck, Sparkles, UserRound, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const benefits = [
  {
    icon: Gift,
    title: "10% Willkommen",
    text: "Auf deine erste Bestellung — direkt nach der Anmeldung.",
  },
  {
    icon: Truck,
    title: "Gratis Versand & Retoure",
    text: "Ab dem ersten Einkauf, ohne Mindestbestellwert.",
  },
  {
    icon: Sparkles,
    title: "Early Access",
    text: "Neue Kollektionen & Sales 24 h vor allen anderen.",
  },
  {
    icon: UserRound,
    title: "Stil-Concierge",
    text: "Persönliche Outfit-Beratung per Mail oder Chat.",
  },
];

export const ClubMemberCta = () => {
  const handleJoin = () => {
    toast.success("Bald verfügbar", {
      description: "Der HATOFF Club startet in Kürze. Wir melden uns, sobald es losgeht.",
      position: "top-right",
    });
  };

  return (
    <section className="bg-foreground text-background">
      <div className="container-editorial py-16 md:py-20">
        <div className="grid gap-10 md:grid-cols-[1fr_1.2fr] md:items-center md:gap-16">
          <div>
            <p className="text-[11px] uppercase tracking-[0.4em] text-background/60">HATOFF Club</p>
            <h2 className="mt-3 font-display text-4xl leading-tight md:text-5xl">
              Werde Mitglied.<br />
              <span className="text-background/70">Mehr Stil. Mehr Vorteile.</span>
            </h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-background/70">
              Kostenlos beitreten und sofort von exklusiven Vorteilen profitieren — für alle,
              die guten Stil zu schätzen wissen.
            </p>
            <Button
              onClick={handleJoin}
              size="lg"
              variant="secondary"
              className="mt-8 group bg-background text-foreground hover:bg-background/90"
            >
              Jetzt kostenlos beitreten
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-background/50">
              Keine Kosten · Jederzeit kündbar
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {benefits.map((b) => (
              <div
                key={b.title}
                className="border border-background/15 p-5 transition-colors hover:border-background/40"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background/10 text-background">
                  <b.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-lg">{b.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-background/70">{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
