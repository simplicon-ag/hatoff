import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface CuratedLookRow {
  slug: string;
  title: string;
  subtitle: string | null;
  welt: string | null;
  hero_image_url: string | null;
  product_handles: string[];
  published_at: string | null;
  created_at: string;
}

interface Edition {
  number: number;       // 1..52
  label: string;        // "Ausgabe 01"
  range: string;        // "KW 17 · 21.–27. April"
  looks: CuratedLookRow[]; // up to 7
  isComingSoon: boolean;
}

const TOTAL_EDITIONS = 52;
const LOOKS_PER_EDITION = 7;

const formatRange = (startMonday: Date) => {
  const end = new Date(startMonday);
  end.setDate(startMonday.getDate() + 6);
  // ISO week number
  const tmp = new Date(startMonday);
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const week1 = new Date(tmp.getFullYear(), 0, 4);
  const weekNum =
    1 + Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  const fmt = new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "short" });
  return `KW ${String(weekNum).padStart(2, "0")} · ${fmt.format(startMonday)}–${fmt.format(end)}`;
};

// Get Monday of the current ISO week
const mondayOfThisWeek = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
};

export const WeeklyEditions = () => {
  const [looks, setLooks] = useState<CuratedLookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeEdition, setActiveEdition] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("curated_looks")
        .select("slug,title,subtitle,welt,hero_image_url,product_handles,published_at,created_at")
        .eq("status", "published")
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(TOTAL_EDITIONS * LOOKS_PER_EDITION);
      if (cancelled) return;
      setLooks((data as CuratedLookRow[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const editions = useMemo<Edition[]>(() => {
    const startMonday = mondayOfThisWeek();
    return Array.from({ length: TOTAL_EDITIONS }, (_, i) => {
      const editionLooks = looks.slice(i * LOOKS_PER_EDITION, (i + 1) * LOOKS_PER_EDITION);
      const weekStart = new Date(startMonday);
      weekStart.setDate(startMonday.getDate() - i * 7);
      return {
        number: i + 1,
        label: `Ausgabe ${String(i + 1).padStart(2, "0")}`,
        range: formatRange(weekStart),
        looks: editionLooks,
        isComingSoon: editionLooks.length === 0,
      };
    });
  }, [looks]);

  const current = editions.find((e) => e.number === activeEdition) ?? editions[0];

  return (
    <section className="border-y border-border/60 bg-background py-16 md:py-24">
      <div className="container-editorial">
        <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:gap-16">
          {/* Main content */}
          <div className="min-w-0">
            {/* Header */}
            <div className="mb-10 flex flex-col gap-3 md:mb-14">
              <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                {current?.label} · {current?.range}
              </p>
              <h2 className="font-display text-4xl leading-[1.05] md:text-6xl">
                7 Tage, 7 Looks.
              </h2>
              <p className="mt-2 max-w-xl text-muted-foreground">
                Jede Woche eine neue Ausgabe — sieben kuratierte Looks für sieben Tage. Blättere rechts
                durch das Archiv und entdecke, wie sich die Saison entwickelt hat.
              </p>
            </div>

            {/* Mosaic */}
            {loading ? (
              <div className="flex h-[500px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : current?.isComingSoon ? (
              <ComingSoonGrid />
            ) : (
              <MosaicGrid looks={current!.looks} />
            )}
          </div>

          {/* Vertical Edition Bar */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <p className="mb-3 text-[10px] uppercase tracking-[0.3em] text-muted-foreground lg:hidden">
              Ausgaben
            </p>
            <div
              className="flex max-h-[600px] flex-row gap-1 overflow-x-auto overflow-y-hidden lg:flex-col lg:gap-0 lg:overflow-x-hidden lg:overflow-y-auto lg:pr-1 lg:[scrollbar-width:thin]"
              role="tablist"
              aria-label="Ausgaben-Archiv"
            >
              {editions.map((ed) => {
                const active = ed.number === activeEdition;
                const empty = ed.isComingSoon;
                return (
                  <button
                    key={ed.number}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveEdition(ed.number)}
                    className={cn(
                      "group flex shrink-0 items-center gap-3 border-l-2 px-3 py-2 text-left text-xs transition-colors lg:w-[170px]",
                      active
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted-foreground hover:border-border hover:text-foreground/80",
                      empty && !active && "opacity-40",
                    )}
                  >
                    <span
                      className={cn(
                        "font-display tabular-nums",
                        active ? "text-base" : "text-sm",
                      )}
                    >
                      {String(ed.number).padStart(2, "0")}
                    </span>
                    <span className="hidden flex-col leading-tight lg:flex">
                      <span className={cn("text-[10px] uppercase tracking-[0.18em]", active && "font-medium")}>
                        {empty ? "Kommt bald" : ed.range.split(" · ")[0]}
                      </span>
                      {!empty && (
                        <span className="text-[10px] text-muted-foreground/80">
                          {ed.range.split(" · ")[1]}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
};

// ─────────────────────────── Sub-Components ───────────────────────────

const MosaicGrid = ({ looks }: { looks: CuratedLookRow[] }) => {
  // 7-Look-Mosaik in editorial Manier:
  // [ big | small  small ]
  // [ big | small  small ]
  // [ wide-medium | medium ]
  // Layout adapts: mobile = stack, md = 6 cols
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-6 md:gap-4">
      {looks[0] && <LookTile look={looks[0]} day={1} className="col-span-2 row-span-2 md:col-span-3 md:row-span-2 aspect-[3/4]" />}
      {looks[1] && <LookTile look={looks[1]} day={2} className="col-span-1 md:col-span-3 aspect-square md:aspect-[3/2]" />}
      {looks[2] && <LookTile look={looks[2]} day={3} className="col-span-1 md:col-span-3 aspect-square md:aspect-[3/2]" />}
      {looks[3] && <LookTile look={looks[3]} day={4} className="col-span-1 md:col-span-2 aspect-[3/4]" />}
      {looks[4] && <LookTile look={looks[4]} day={5} className="col-span-1 md:col-span-2 aspect-[3/4]" />}
      {looks[5] && <LookTile look={looks[5]} day={6} className="col-span-1 md:col-span-2 aspect-[3/4]" />}
      {looks[6] && <LookTile look={looks[6]} day={7} className="col-span-2 md:col-span-6 aspect-[2/1] md:aspect-[3/1]" />}
    </div>
  );
};

const dayNames = ["", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

const LookTile = ({
  look,
  day,
  className,
}: {
  look: CuratedLookRow;
  day: number;
  className?: string;
}) => {
  return (
    <Link to={`/looks/${look.slug}`} className={cn("group relative block overflow-hidden bg-secondary", className)}>
      {look.hero_image_url ? (
        <img
          src={look.hero_image_url}
          alt={look.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-[1200ms] group-hover:scale-[1.04]"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
          Kein Bild
        </div>
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />

      {/* Day badge */}
      <div className="absolute left-3 top-3 flex items-center gap-2 bg-background/90 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-foreground backdrop-blur md:left-4 md:top-4">
        <span className="font-display text-xs tabular-nums">{String(day).padStart(2, "0")}</span>
        <span className="text-muted-foreground">{dayNames[day]}</span>
      </div>

      {/* Caption */}
      <div className="absolute inset-x-0 bottom-0 p-3 md:p-5">
        <h3 className="font-display text-base leading-tight text-white drop-shadow-sm md:text-2xl">
          {look.title}
        </h3>
        {look.subtitle && (
          <p className="mt-1 hidden text-xs text-white/80 line-clamp-1 md:block">{look.subtitle}</p>
        )}
      </div>
    </Link>
  );
};

const ComingSoonGrid = () => (
  <div className="grid grid-cols-2 gap-3 md:grid-cols-6 md:gap-4">
    {Array.from({ length: 7 }).map((_, i) => (
      <div
        key={i}
        className={cn(
          "flex items-center justify-center border border-dashed border-border/70 bg-secondary/30",
          i === 0 && "col-span-2 row-span-2 md:col-span-3 md:row-span-2 aspect-[3/4]",
          (i === 1 || i === 2) && "col-span-1 md:col-span-3 aspect-square md:aspect-[3/2]",
          (i === 3 || i === 4 || i === 5) && "col-span-1 md:col-span-2 aspect-[3/4]",
          i === 6 && "col-span-2 md:col-span-6 aspect-[2/1] md:aspect-[3/1]",
        )}
      >
        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Kommt bald
        </span>
      </div>
    ))}
  </div>
);
