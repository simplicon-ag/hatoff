import { useMemo, useState } from "react";
import { ShieldCheck, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProductReviews } from "@/hooks/useProductReviews";
import { RatingStars } from "./RatingStars";
import { ReviewForm } from "./ReviewForm";
import { cn } from "@/lib/utils";

interface ProductReviewsProps {
  productHandle: string;
  productTitle: string;
  sizeOptions?: string[];
}

const fitLabel: Record<string, string> = {
  small: "Fällt klein aus",
  true: "Passt genau",
  large: "Fällt gross aus",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("de-CH", { day: "2-digit", month: "short", year: "numeric" });

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const ProductReviews = ({ productHandle, productTitle, sizeOptions }: ProductReviewsProps) => {
  const { reviews, stats, loading, reload } = useProductReviews(productHandle);
  const [sort, setSort] = useState<"recent" | "best" | "worst">("recent");

  const sorted = useMemo(() => {
    const arr = [...reviews];
    if (sort === "best") arr.sort((a, b) => b.rating - a.rating);
    else if (sort === "worst") arr.sort((a, b) => a.rating - b.rating);
    else arr.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return arr;
  }, [reviews, sort]);

  const total = stats?.count ?? 0;
  const avg = stats?.avg_rating ? Number(stats.avg_rating) : 0;

  return (
    <section id="bewertungen" className="border-t border-border/60 bg-background py-16 md:py-24">
      <div className="container-editorial">
        {/* Header */}
        <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Kundenstimmen</p>
            <h2 className="mt-2 font-display text-3xl md:text-4xl">Bewertungen</h2>
          </div>
          <ReviewForm
            productHandle={productHandle}
            productTitle={productTitle}
            sizeOptions={sizeOptions}
          />
        </div>

        {/* Trust-Hinweis */}
        <div className="mb-8 flex items-start gap-3 border border-border/60 bg-secondary/40 px-4 py-3 text-xs text-foreground/75">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <span className="font-medium text-foreground">Verifizierte Bewertungen.</span> Bei Hatoff können
            ausschliesslich Kund:innen bewerten, die den Artikel tatsächlich gekauft haben. Wir prüfen jede
            Bewertung gegen unsere Bestellhistorie — keine bezahlten oder erfundenen Stimmen.
          </p>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Bewertungen werden geladen…</div>
        ) : total === 0 ? (
          <div className="border border-dashed border-border/70 px-6 py-16 text-center">
            <p className="font-display text-2xl">Noch keine Bewertungen.</p>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
              Sei der/die Erste — sobald du diesen Artikel gekauft hast, kannst du deine Erfahrung mit anderen
              Hatoff-Kund:innen teilen.
            </p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid gap-8 border-y border-border/60 py-8 md:grid-cols-[auto_1fr] md:gap-16">
              <div className="text-center md:text-left">
                <p className="font-display text-5xl leading-none">{avg.toFixed(1)}</p>
                <RatingStars value={avg} size="md" className="mt-2" />
                <p className="mt-2 text-xs text-muted-foreground">
                  Basierend auf {total} {total === 1 ? "Bewertung" : "Bewertungen"}
                </p>
                {stats && stats.count_recommend > 0 && (
                  <p className="mt-1 text-xs text-foreground/70">
                    {Math.round((stats.count_recommend / total) * 100)}% empfehlen das Produkt weiter
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                {[5, 4, 3, 2, 1].map((star) => {
                  const c = (stats as unknown as Record<string, number>)?.[`count_${star}`] ?? 0;
                  const pct = total > 0 ? (c / total) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-3 text-xs">
                      <span className="w-3 text-foreground/70">{star}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-foreground/80" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-8 text-right tabular-nums text-muted-foreground">{c}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sort */}
            <div className="mt-8 flex items-center justify-end">
              <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
                <SelectTrigger className="w-[180px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Neueste zuerst</SelectItem>
                  <SelectItem value="best">Beste zuerst</SelectItem>
                  <SelectItem value="worst">Schlechteste zuerst</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* List */}
            <ul className="mt-6 divide-y divide-border/50">
              {sorted.map((r) => (
                <li key={r.id} className="grid gap-4 py-6 md:grid-cols-[160px_1fr]">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium">
                      {initials(r.reviewer_name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.reviewer_name}</p>
                      <p className="text-[11px] text-muted-foreground">{formatDate(r.created_at)}</p>
                      {r.verified_purchase && (
                        <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-foreground/70">
                          <BadgeCheck className="h-3 w-3" />
                          Verifizierter Kauf
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <RatingStars value={r.rating} size="sm" />
                    <h3 className="mt-2 font-medium">{r.title}</h3>
                    <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground/80">
                      {r.body}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                      {r.size_purchased && <span>Grösse: <span className="text-foreground/80">{r.size_purchased}</span></span>}
                      {r.size_fit && <span>Passform: <span className="text-foreground/80">{fitLabel[r.size_fit]}</span></span>}
                      <span className={cn(r.would_recommend ? "text-foreground/80" : "text-foreground/60")}>
                        {r.would_recommend ? "✓ Würde weiterempfehlen" : "Würde nicht weiterempfehlen"}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
};
