import { Star, Quote } from "lucide-react";

interface Testimonial {
  quote: string;
  name: string;
  city: string;
  occasion: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Endlich eine Seite, die mir nicht nur Einzelteile zeigt, sondern fertige Looks. Hochzeitsgast-Outfit in 5 Minuten bestellt — und es passte einfach.",
    name: "Marc",
    city: "Zürich",
    occasion: "Hochzeitsgast-Look",
  },
  {
    quote:
      "Ich kaufe ungern online, weil ich nie weiss, ob es zusammenpasst. Bei HATOFF muss ich nicht überlegen — der ganze Look kommt zusammen an. Genial.",
    name: "Lukas",
    city: "Bern",
    occasion: "Smart-Casual Büro",
  },
  {
    quote:
      "Top-Qualität, schneller Schweizer Versand, und die Stilberatung per Mail war richtig hilfreich. Komme definitiv wieder.",
    name: "Andreas",
    city: "Basel",
    occasion: "Weekend-Look",
  },
];

export const TestimonialsSection = () => (
  <section className="container-editorial py-16 md:py-24">
    <div className="mx-auto mb-12 max-w-2xl text-center md:mb-16">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
        Stimmen aus der Community
      </p>
      <h2 className="mt-2 font-display text-4xl md:text-5xl">Was Kunden sagen.</h2>
      <div className="mt-5 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <span className="flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="h-3.5 w-3.5 fill-foreground text-foreground" />
          ))}
        </span>
        <span>4.9 / 5 · über 200 verifizierte Bewertungen</span>
      </div>
    </div>

    <div className="grid gap-x-10 gap-y-12 md:grid-cols-3">
      {TESTIMONIALS.map((t) => (
        <figure key={t.name} className="flex h-full flex-col">
          <Quote className="h-6 w-6 text-foreground/30" strokeWidth={1.25} />
          <blockquote className="mt-4 flex-1 font-display text-lg leading-snug text-foreground/90 md:text-xl">
            „{t.quote}"
          </blockquote>
          <figcaption className="mt-6 border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground">
              {t.name} · <span className="text-muted-foreground">{t.city}</span>
            </p>
            <p className="mt-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              <span className="inline-block h-1 w-1 rounded-full bg-foreground/40" />
              Verifizierter Kauf · {t.occasion}
            </p>
          </figcaption>
        </figure>
      ))}
    </div>
  </section>
);
