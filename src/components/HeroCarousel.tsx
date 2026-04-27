import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin, Star, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCuratedLooks } from "@/hooks/useCuratedLooks";

import heroDefault from "@/assets/hero.jpg";
import heroWeekend from "@/assets/hero-weekend.jpg";
import heroDate from "@/assets/hero-date.jpg";

interface Slide {
  image: string;
  alt: string;
  eyebrow: string;
  cta: { label: string; to: string };
}

const SLIDES: Slide[] = [
  {
    image: heroDefault,
    alt: "Mann in cognacfarbenem Hemd",
    eyebrow: "Smart Casual",
    cta: { label: "Looks entdecken", to: "/looks" },
  },
  {
    image: heroWeekend,
    alt: "Mann im dunkelblauen Strick auf einer sonnigen Altstadtgasse",
    eyebrow: "Weekend",
    cta: { label: "Weekend-Looks", to: "/looks?welt=jacken" },
  },
  {
    image: heroDate,
    alt: "Mann im dunklen Blazer im Restaurant am Abend",
    eyebrow: "Date Night",
    cta: { label: "Abend-Looks", to: "/looks?welt=smart-casual" },
  },
];

const SLIDE_DURATION_MS = 6000;

export const HeroCarousel = () => {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const { looks } = useCuratedLooks();

  // Dezenter „Frische"-Indikator: zeigt die Anzahl aktuell kuratierter Looks
  const recentLooksCount = Math.min(3, looks?.length ?? 0);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setActive((i) => (i + 1) % SLIDES.length);
    }, SLIDE_DURATION_MS);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <section
      className="relative h-[88vh] min-h-[640px] w-full overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="HATOFF Hero"
    >
      {/* Slides — gestapelt, fade + ken-burns */}
      {SLIDES.map((slide, i) => (
        <div
          key={slide.image}
          className={cn(
            "absolute inset-0 transition-opacity duration-1000 ease-out",
            i === active ? "opacity-100" : "opacity-0",
          )}
          aria-hidden={i !== active}
        >
          <img
            src={slide.image}
            alt={slide.alt}
            className={cn(
              "absolute inset-0 h-full w-full object-cover",
              i === active && "animate-ken-burns",
            )}
            fetchPriority={i === 0 ? "high" : "low"}
            loading={i === 0 ? "eager" : "lazy"}
          />
        </div>
      ))}

      {/* Lesbarkeits-Verlauf */}
      <div className="absolute inset-0 bg-gradient-to-b from-foreground/10 via-foreground/30 to-foreground/75" />

      {/* Content */}
      <div className="container-editorial relative flex h-full flex-col justify-end pb-16 text-primary-foreground md:pb-20">
        <div key={active} className="animate-fade-up">
          <p className="text-[11px] uppercase tracking-[0.3em] opacity-90">
            {SLIDES[active].eyebrow} · Kuratiertes Outfit-Universum
          </p>
        </div>
        <h1 className="mt-4 max-w-3xl text-balance font-display text-5xl leading-[1.05] md:text-7xl">
          Finde deinen Look. Einfach kombiniert. Stilvoll getragen.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed opacity-90 md:text-lg">
          HATOFF kuratiert komplette Looks für jeden Anlass — du findest, kombinierst und trägst.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg" className="bg-background text-foreground hover:bg-background/90">
            <Link to={SLIDES[active].cta.to}>
              {SLIDES[active].cta.label} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-background/40 bg-transparent text-primary-foreground hover:bg-background/10"
          >
            <Link to="/shop">Zum Shop</Link>
          </Button>
        </div>

        {/* Live-Counter + Trust */}
        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] tracking-wide opacity-90">
          {recentLooksCount > 0 && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-background opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-background" />
                </span>
                {recentLooksCount} {recentLooksCount === 1 ? "neuer Look" : "neue Looks"} diese Woche
              </span>
              <span className="hidden h-3 w-px bg-background/30 md:inline-block" />
            </>
          )}
          <span className="flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5" /> 4.9 / 5 Kundenzufriedenheit
          </span>
          <span className="hidden h-3 w-px bg-background/30 md:inline-block" />
          <span className="flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5" /> Gratis Versand & Retoure
          </span>
          <span className="hidden h-3 w-px bg-background/30 md:inline-block" />
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> Versand aus der Schweiz
          </span>
        </div>

        {/* Slide-Indikatoren */}
        <div className="mt-10 flex items-center gap-2">
          {SLIDES.map((s, i) => (
            <button
              key={s.image}
              onClick={() => setActive(i)}
              className="group p-1"
              aria-label={`Zu Slide ${i + 1}`}
              aria-current={i === active}
            >
              <span
                className={cn(
                  "block h-[2px] transition-all duration-500",
                  i === active
                    ? "w-12 bg-background"
                    : "w-6 bg-background/40 group-hover:bg-background/70",
                )}
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
