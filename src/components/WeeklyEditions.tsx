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

type Season = "fruehling" | "sommer" | "herbst" | "winter";

interface Edition {
  number: number;        // 1 = neueste Ausgabe
  weekNumber: number;    // ISO-KW
  year: number;
  weekStart: Date;       // Montag dieser Woche
  range: string;         // "21.–27. April"
  season: Season;
  seasonLabel: string;
  looks: CuratedLookRow[]; // bis zu 7
}

const LOOKS_PER_EDITION = 7;

// ─────────── Date helpers ───────────

const mondayOf = (d: Date) => {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const day = out.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  out.setDate(out.getDate() + diff);
  return out;
};

const isoWeek = (date: Date): { week: number; year: number } => {
  const tmp = new Date(date);
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const week1 = new Date(tmp.getFullYear(), 0, 4);
  const week =
    1 + Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return { week, year: tmp.getFullYear() };
};

const formatRange = (mon: Date) => {
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "short" });
  return `${fmt.format(mon)}–${fmt.format(sun)}`;
};

const seasonOf = (mon: Date): { key: Season; label: string } => {
  const m = mon.getMonth(); // 0–11
  if (m >= 2 && m <= 4) return { key: "fruehling", label: "Frühling" };
  if (m >= 5 && m <= 7) return { key: "sommer", label: "Sommer" };
  if (m >= 8 && m <= 10) return { key: "herbst", label: "Herbst" };
  return { key: "winter", label: "Winter" };
};

// Welt → bevorzugte Saisons (höhere Punktzahl = bessere Passung)
const WELT_SEASON_AFFINITY: Record<string, Partial<Record<Season, number>>> = {
  sommer:    { sommer: 3, fruehling: 1 },
  hemden:    { sommer: 2, fruehling: 2 },
  freizeit:  { sommer: 1, fruehling: 1, herbst: 1, winter: 1 }, // ganzjährig
  business:  { herbst: 2, winter: 2, fruehling: 1 },
  jacken:    { herbst: 3, winter: 3 },
  abend:     { winter: 2, herbst: 1 },
};

const matchScore = (look: CuratedLookRow, season: Season): number => {
  if (!look.welt) return 0;
  return WELT_SEASON_AFFINITY[look.welt]?.[season] ?? 0;
};

export const WeeklyEditions = () => {
  const [looks, setLooks] = useState<CuratedLookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("curated_looks")
        .select("slug,title,subtitle,welt,hero_image_url,product_handles,published_at,created_at")
        .eq("status", "published")
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setLooks((data as CuratedLookRow[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Build editions: ab dieser Woche zurück, jede Woche eine Ausgabe,
  // solange wir noch genug Looks haben. Saisonal sortiert.
  const editions = useMemo<Edition[]>(() => {
    if (looks.length === 0) return [];

    const maxEditions = Math.ceil(looks.length / LOOKS_PER_EDITION);
    const editions: Edition[] = [];
    const usedSlugs = new Set<string>();

    const thisMonday = mondayOf(new Date());

    for (let i = 0; i < maxEditions; i++) {
      const weekStart = new Date(thisMonday);
      weekStart.setDate(thisMonday.getDate() - i * 7);
      const { week, year } = isoWeek(weekStart);
      const season = seasonOf(weekStart);

      const available = looks.filter((l) => !usedSlugs.has(l.slug));
      if (available.length === 0) break;

      // Looks nach Welt gruppieren, innerhalb jeder Welt saisonal sortiert
      const byWelt = new Map<string, CuratedLookRow[]>();
      for (const l of available) {
        const key = l.welt ?? "andere";
        if (!byWelt.has(key)) byWelt.set(key, []);
        byWelt.get(key)!.push(l);
      }
      for (const arr of byWelt.values()) {
        arr.sort((a, b) => matchScore(b, season.key) - matchScore(a, season.key));
      }

      // Welten-Reihenfolge: saisonal stärkste zuerst — aber Round-Robin pickt
      // reihum aus jeder Welt, damit jede Ausgabe einen Mix enthält
      // (Casual, Business, Hemden, Jacken …).
      const weltOrder = Array.from(byWelt.keys()).sort((a, b) => {
        const sa = WELT_SEASON_AFFINITY[a]?.[season.key] ?? 0;
        const sb = WELT_SEASON_AFFINITY[b]?.[season.key] ?? 0;
        return sb - sa;
      });

      const chosen: CuratedLookRow[] = [];
      let safety = 0;
      while (chosen.length < LOOKS_PER_EDITION && safety < LOOKS_PER_EDITION * 4) {
        let pickedThisRound = false;
        for (const welt of weltOrder) {
          if (chosen.length >= LOOKS_PER_EDITION) break;
          const next = byWelt.get(welt)!.shift();
          if (next) {
            chosen.push(next);
            pickedThisRound = true;
          }
        }
        if (!pickedThisRound) break;
        safety++;
      }

      chosen.forEach((l) => usedSlugs.add(l.slug));

      if (chosen.length === LOOKS_PER_EDITION || i === 0) {
        editions.push({
          number: i + 1,
          weekNumber: week,
          year,
          weekStart,
          range: formatRange(weekStart),
          season: season.key,
          seasonLabel: season.label,
          looks: chosen,
        });
      }
    }

    return editions;
  }, [looks]);

  const current = editions[activeIdx] ?? editions[0];

  return (
    <section className="border-y border-border/60 bg-background py-16 md:py-24">
      <div className="container-editorial">
        <div className="grid gap-10 lg:grid-cols-[auto_1fr] lg:gap-16">
          {/* ───────── Kalender LINKS ───────── */}
          <aside className="lg:sticky lg:top-24 lg:self-start lg:order-first">
            <p className="mb-4 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Archiv
            </p>
            <div
              className="flex max-h-[600px] flex-row gap-1 overflow-x-auto overflow-y-hidden lg:flex-col lg:gap-0 lg:overflow-x-hidden lg:overflow-y-auto lg:pr-2 lg:[scrollbar-width:thin]"
              role="tablist"
              aria-label="Wochenausgaben-Archiv"
            >
              {editions.map((ed, idx) => {
                const active = idx === activeIdx;
                return (
                  <button
                    key={`${ed.year}-${ed.weekNumber}`}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveIdx(idx)}
                    className={cn(
                      "group flex shrink-0 items-baseline gap-3 border-l-2 px-3 py-2.5 text-left transition-colors lg:w-[180px]",
                      active
                        ? "border-foreground"
                        : "border-transparent hover:border-border",
                    )}
                  >
                    <span
                      className={cn(
                        "font-display tabular-nums leading-none",
                        active ? "text-2xl text-foreground" : "text-base text-muted-foreground group-hover:text-foreground/80",
                      )}
                    >
                      {String(ed.weekNumber).padStart(2, "0")}
                    </span>
                    <span className="hidden flex-col leading-tight lg:flex">
                      <span
                        className={cn(
                          "text-[10px] uppercase tracking-[0.18em]",
                          active ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        KW · {ed.seasonLabel}
                      </span>
                      <span
                        className={cn(
                          "text-[10px]",
                          active ? "text-foreground/70" : "text-muted-foreground/70",
                        )}
                      >
                        {ed.range}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* ───────── Hauptinhalt ───────── */}
          <div className="min-w-0">
            <div className="mb-10 flex flex-col gap-3 md:mb-14">
              <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                {current && (
                  <>
                    Ausgabe KW {String(current.weekNumber).padStart(2, "0")} · {current.seasonLabel} {current.year} · {current.range}
                  </>
                )}
              </p>
              <h2 className="font-display text-4xl leading-[1.05] md:text-6xl">
                7 Tage, 7 Looks.
              </h2>
              <p className="mt-2 max-w-xl text-muted-foreground">
                Jeden Montag eine neue Ausgabe — sieben kuratierte Looks für sieben Tage,
                abgestimmt auf die Jahreszeit. Stöbere links durchs Archiv.
              </p>
            </div>

            {loading ? (
              <div className="flex h-[500px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !current ? (
              <p className="py-20 text-center text-sm text-muted-foreground">
                Noch keine Ausgaben verfügbar.
              </p>
            ) : (
              <MosaicGrid looks={current.looks} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

// ─────────────────────────── Mosaic ───────────────────────────

const MosaicGrid = ({ looks }: { looks: CuratedLookRow[] }) => {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-6 md:gap-4">
      {looks[0] && <LookTile look={looks[0]} className="col-span-2 row-span-2 md:col-span-3 md:row-span-2 aspect-[3/4]" />}
      {looks[1] && <LookTile look={looks[1]} className="col-span-1 md:col-span-3 aspect-square md:aspect-[3/2]" />}
      {looks[2] && <LookTile look={looks[2]} className="col-span-1 md:col-span-3 aspect-square md:aspect-[3/2]" />}
      {looks[3] && <LookTile look={looks[3]} className="col-span-1 md:col-span-2 aspect-[3/4]" />}
      {looks[4] && <LookTile look={looks[4]} className="col-span-1 md:col-span-2 aspect-[3/4]" />}
      {looks[5] && <LookTile look={looks[5]} className="col-span-1 md:col-span-2 aspect-[3/4]" />}
      {looks[6] && <LookTile look={looks[6]} className="col-span-2 md:col-span-6 aspect-[2/1] md:aspect-[3/1]" />}
    </div>
  );
};

const LookTile = ({
  look,
  className,
}: {
  look: CuratedLookRow;
  className?: string;
}) => (
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
    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
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
