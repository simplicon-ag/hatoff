import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchAllProducts, type ShopifyProduct } from "@/lib/shopify";
import {
  filterProductsForSaisonWithBrandData,
  saisons,
  saisonList,
  type SaisonSlug,
} from "@/data/saisons";
import { supabase } from "@/integrations/supabase/client";

type SortKey = "relevance" | "price-asc" | "price-desc" | "title-asc";

const isSaisonSlug = (s: string | undefined): s is SaisonSlug =>
  s === "fs-2026" || s === "hw-2026";

const Saison = () => {
  const { slug } = useParams<{ slug: string }>();
  const validSlug: SaisonSlug = isSaisonSlug(slug) ? slug : "fs-2026";
  const saison = saisons[validSlug];
  const cross = saisons[saison.cross];

  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [brandHandles, setBrandHandles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("relevance");

  useEffect(() => {
    fetchAllProducts()
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let active = true;
    supabase
      .from("brand_season_products")
      .select("handle")
      .eq("season", validSlug)
      .then(({ data }) => {
        if (!active) return;
        const set = new Set<string>(
          (data ?? []).map((r) => String(r.handle).toLowerCase()),
        );
        setBrandHandles(set);
      });
    return () => {
      active = false;
    };
  }, [validSlug]);

  const { brandMatched, heuristic, filtered } = useMemo(() => {
    const { brandMatched, heuristic } = filterProductsForSaisonWithBrandData(
      products,
      saison,
      brandHandles,
    );
    const list = [...brandMatched, ...heuristic];

    const sortList = (arr: ShopifyProduct[]) => {
      if (sort === "price-asc") {
        return [...arr].sort(
          (a, b) =>
            parseFloat(a.node.priceRange.minVariantPrice.amount) -
            parseFloat(b.node.priceRange.minVariantPrice.amount),
        );
      }
      if (sort === "price-desc") {
        return [...arr].sort(
          (a, b) =>
            parseFloat(b.node.priceRange.minVariantPrice.amount) -
            parseFloat(a.node.priceRange.minVariantPrice.amount),
        );
      }
      if (sort === "title-asc") {
        return [...arr].sort((a, b) =>
          a.node.title.localeCompare(b.node.title),
        );
      }
      return arr;
    };

    return {
      brandMatched,
      heuristic,
      filtered: sortList(list),
    };
  }, [products, saison, sort, brandHandles]);

  if (!isSaisonSlug(slug)) {
    return <Navigate to="/saison/fs-2026" replace />;
  }

  return (
    <SiteLayout>
      {/* Hero */}
      <section className="relative h-[70vh] min-h-[520px] w-full overflow-hidden">
        <img
          src={saison.heroImage}
          alt={saison.fullLabel}
          width={1920}
          height={1080}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/30 to-foreground/10" />
        <div className="container-editorial relative flex h-full flex-col justify-end pb-16 text-background">
          <p className="text-[11px] uppercase tracking-[0.32em] text-background/80">
            {saison.kicker}
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-5xl leading-[1.02] md:text-7xl">
            {saison.headline}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-background/85 md:text-lg">
            {saison.subline}
          </p>

          {/* Saison switcher */}
          <div className="mt-8 flex flex-wrap gap-2">
            {saisonList.map((s) => (
              <Link
                key={s.slug}
                to={`/saison/${s.slug}`}
                className={`rounded-full border px-5 py-2 text-xs uppercase tracking-[0.22em] transition-colors ${
                  s.slug === saison.slug
                    ? "border-background bg-background text-foreground"
                    : "border-background/50 text-background hover:border-background hover:bg-background/10"
                }`}
              >
                {s.shortLabel}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="container-editorial py-16 md:py-24">
        <div className="grid gap-10 md:grid-cols-[1fr_2fr]">
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
            Über die Saison
          </p>
          <p className="max-w-2xl font-display text-2xl leading-snug text-foreground md:text-3xl">
            {saison.story}
          </p>
        </div>
      </section>

      {/* Products */}
      <section className="container-editorial pb-20">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-y border-border py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
              Auswahl
            </p>
            <h2 className="mt-1 font-display text-2xl">
              {loading
                ? "Wird geladen …"
                : `${filtered.length} ${filtered.length === 1 ? "Stück" : "Stücke"} für ${saison.shortLabel}`}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs uppercase tracking-[0.18em] text-muted-foreground sm:inline">
              Sortieren
            </span>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-9 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">Relevanz</SelectItem>
                <SelectItem value="price-asc">Preis aufsteigend</SelectItem>
                <SelectItem value="price-desc">Preis absteigend</SelectItem>
                <SelectItem value="title-asc">A – Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <p className="py-16 text-center text-muted-foreground">Produkte werden geladen …</p>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-muted-foreground">
              Für diese Saison sind aktuell noch keine Stücke kuratiert.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/shop">Zum gesamten Shop</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p, i) => (
              <ProductCard key={p.node.id} product={p} priority={i < 3} />
            ))}
          </div>
        )}
      </section>

      {/* Cross-link to other season */}
      <section className="border-t border-border bg-secondary/40">
        <div className="container-editorial py-16">
          <Link
            to={`/saison/${cross.slug}`}
            className="group flex flex-col items-start justify-between gap-6 md:flex-row md:items-center"
          >
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                Andere Saison
              </p>
              <p className="mt-2 font-display text-3xl md:text-4xl">
                {cross.headline}
              </p>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                {cross.subline}
              </p>
            </div>
            <span className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.2em] text-foreground transition-transform group-hover:translate-x-1">
              {cross.shortLabel} ansehen <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
};

export default Saison;
