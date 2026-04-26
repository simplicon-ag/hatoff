import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Gift, ShoppingBag, Sparkles, Trophy } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { TierCard } from "@/components/club/TierCard";
import { CLUB_TIERS } from "@/lib/club-tiers";
import { useAuth } from "@/hooks/useAuth";

const steps = [
  {
    icon: Gift,
    title: "1. Kostenlos beitreten",
    text: "Konto in 30 Sekunden eröffnen — und sofort 100 Willkommens-Punkte sichern.",
  },
  {
    icon: ShoppingBag,
    title: "2. Stilvoll einkaufen",
    text: "Pro 1 CHF Umsatz erhältst du 1 Punkt. Punkte verfallen im ersten Jahr nicht.",
  },
  {
    icon: Trophy,
    title: "3. Stufen aufsteigen",
    text: "Je mehr Punkte, desto höher die Stufe — und desto grösser dein Rabatt.",
  },
  {
    icon: Sparkles,
    title: "4. Vorteile geniessen",
    text: "Rabatte, Early Access, Concierge — exklusiv für Mitglieder.",
  },
];

const faqs = [
  {
    q: "Was kostet die Mitgliedschaft?",
    a: "Nichts. Der HATOFF Club ist und bleibt kostenlos. Du kannst dein Konto jederzeit ohne Angabe von Gründen löschen.",
  },
  {
    q: "Wie sammle ich Punkte?",
    a: "Pro 1 CHF Umsatz erhältst du 1 Punkt. Zusätzlich gibt es Bonus-Punkte zur Anmeldung, an deinem Geburtstag und bei Aktionen.",
  },
  {
    q: "Verfallen meine Punkte?",
    a: "Nein, im ersten Jahr nach deiner Anmeldung verfallen keine Punkte. Danach gilt eine Gültigkeit von 24 Monaten ab letzter Aktivität.",
  },
  {
    q: "Wie löse ich meinen Rabatt ein?",
    a: "Sobald du eine Stufe erreichst, erhältst du einen persönlichen Rabattcode in deinem Mitgliederbereich. Diesen gibst du im Checkout ein.",
  },
  {
    q: "Kann ich Punkte übertragen?",
    a: "Punkte sind an dein Konto gebunden und nicht übertragbar.",
  },
];

const Club = () => {
  const { user } = useAuth();

  useEffect(() => {
    document.title = "HATOFF Club · Stil wird belohnt";
  }, []);

  const ctaTo = user ? "/club/mein-konto" : "/auth?redirect=/club/mein-konto";
  const ctaLabel = user ? "Zum Mitgliederbereich" : "Kostenlos beitreten";

  return (
    <SiteLayout>
      {/* Hero */}
      <section className="bg-foreground text-background">
        <div className="container-editorial py-20 md:py-28">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.4em] text-background/60">HATOFF Club</p>
            <h1 className="mt-4 font-display text-5xl leading-[1.05] md:text-7xl">
              Stil wird<br />belohnt.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-background/75 md:text-lg">
              Sammle mit jedem Einkauf Punkte, steige in höhere Stufen auf — und sichere dir
              dauerhafte Rabatte, Early Access und persönliche Stil-Beratung.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Button asChild size="lg" variant="secondary" className="group bg-background text-foreground hover:bg-background/90">
                <Link to={ctaTo}>
                  {ctaLabel}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <p className="text-[11px] uppercase tracking-[0.2em] text-background/50">
                Kostenlos · 100 Willkommens-Punkte · Jederzeit kündbar
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section className="bg-background">
        <div className="container-editorial py-16 md:py-24">
          <div className="mb-12 max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.4em] text-muted-foreground">Drei Stufen</p>
            <h2 className="mt-3 font-display text-4xl md:text-5xl">Mehr Punkte. Mehr Vorteile.</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base">
              Jede Stufe schaltet neue Privilegien frei. Dein Rabatt bleibt dir auf jeder
              Bestellung erhalten — solange du Mitglied bist.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {CLUB_TIERS.map((t) => (
              <TierCard key={t.key} tier={t} />
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-secondary/40">
        <div className="container-editorial py-16 md:py-24">
          <div className="mb-12 max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.4em] text-muted-foreground">So funktioniert's</p>
            <h2 className="mt-3 font-display text-4xl md:text-5xl">In vier Schritten dabei.</h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <div key={s.title}>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-foreground text-background">
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-display text-xl">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-background">
        <div className="container-editorial py-16 md:py-24">
          <div className="grid gap-10 md:grid-cols-[1fr_1.5fr] md:gap-16">
            <div>
              <p className="text-[11px] uppercase tracking-[0.4em] text-muted-foreground">FAQ</p>
              <h2 className="mt-3 font-display text-4xl">Fragen?<br />Wir haben Antworten.</h2>
              <p className="mt-4 text-sm text-muted-foreground">
                Noch Unklarheiten? Schreib uns, wir helfen gerne weiter.
              </p>
            </div>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((f, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="text-left font-display text-lg">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-foreground text-background">
        <div className="container-editorial py-16 text-center md:py-20">
          <h2 className="font-display text-4xl md:text-5xl">Bereit, Stil zu sammeln?</h2>
          <p className="mx-auto mt-4 max-w-md text-sm text-background/70">
            Kostenlos beitreten und die ersten 100 Punkte direkt sichern.
          </p>
          <Button asChild size="lg" variant="secondary" className="group mt-8 bg-background text-foreground hover:bg-background/90">
            <Link to={ctaTo}>
              {ctaLabel}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      </section>
    </SiteLayout>
  );
};

export default Club;
