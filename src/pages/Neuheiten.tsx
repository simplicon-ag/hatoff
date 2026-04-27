import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductCard } from "@/components/ProductCard";
import { LookCard } from "@/components/LookCard";
import { fetchAllProducts, expandProductsByColor, type ShopifyProduct } from "@/lib/shopify";
import { useCuratedLooks } from "@/hooks/useCuratedLooks";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

const HERO_COUNT = 3;
const GRID_COUNT = 18;
const LOOKS_COUNT = 3;

type CategoryId = string; // entspricht jetzt direkt dem Shopify productType (oder "alle")

const ALL_CATEGORY: CategoryId = "alle";

function getProductType(p: ShopifyProduct): string | null {
  const t = p.node.productType?.trim();
  return t && t.length > 0 ? t : null;
}

const Neuheiten = () => {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<CategoryId>("alle");

  useEffect(() => {
    fetchAllProducts()
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  // Nur Produkte mit Tag `neu` / `new` / `neuheit` (Präfixe wie `art:` ignorieren)
  // UND ohne `sale`-Tag — Sale-Artikel gehören in den Sale-Bereich, nicht zu Neuheiten.
  const newest = useMemo(() => {
    const onlyNew = products.filter((p) => {
      const tags = p.node.tags ?? [];
      const isNew = tags.some((t) =>
        /^(neu|new|neuheit)$/i.test(t.replace(/^[a-z]+:/i, "")),
      );
      const isSale = tags.some((t) => t.toLowerCase() === "sale");
      return isNew && !isSale;
    });
    // Sortierung: Shopify-GIDs sind monoton steigend → höchste ID = neuestes Produkt
    return [...onlyNew].sort((a, b) => b.node.id.localeCompare(a.node.id));
  }, [products]);

  // Liste aller in den Neuheiten vorkommenden Product Types, alphabetisch sortiert.
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    newest.forEach((p) => {
      const t = getProductType(p);
      if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "de"))
      .map(([id, count]) => ({ id, label: id, count }));
  }, [newest]);

  const filtered = useMemo(() => {
    if (activeCategory === ALL_CATEGORY) return newest;
    return newest.filter((p) => getProductType(p) === activeCategory);
  }, [newest, activeCategory]);


  const heroPicks = filtered.slice(0, HERO_COUNT);
  const gridPicks = filtered.slice(HERO_COUNT, HERO_COUNT + GRID_COUNT);
  const { looks: allLooks } = useCuratedLooks();
  const featuredLooks = allLooks.slice(0, LOOKS_COUNT);

  return (
    <SiteLayout>
      {/* Hero */}
      <section className="container-editorial pt-16 md:pt-24">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Neuheiten
        </div>
        <h1 className="mt-2 max-w-3xl font-display text-5xl leading-[1.05] md:text-6xl">
          Frisch eingetroffen.
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted-foreground">
          Die jüngsten Stücke und Looks im HATOFF-Sortiment — kuratiert nach Eingang.
        </p>
      </section>

      {/* Kategorie-Filter */}
      <section className="container-editorial mt-10 border-b border-border pb-6">
        <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          Kategorie
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory("alle")}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              activeCategory === "alle"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:border-primary"
            }`}
          >
            Alle <span className="ml-1 text-xs opacity-70">{newest.length}</span>
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                activeCategory === cat.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:border-primary"
              }`}
            >
              {cat.label} <span className="ml-1 text-xs opacity-70">{cat.count}</span>
            </button>
          ))}
        </div>
      </section>


      {loading ? (
        <section className="container-editorial py-24 text-center text-muted-foreground">
          Neuheiten werden geladen …
        </section>
      ) : filtered.length === 0 ? (
        <section className="container-editorial py-24 text-center">
          <p className="text-muted-foreground">Keine Neuheiten für diese Auswahl.</p>
          <Button
            variant="link"
            onClick={() => setActiveCategory("alle")}
            className="mt-2"
          >
            Filter zurücksetzen
          </Button>
        </section>

      ) : (
        <>
          {/* Hero spotlight */}
          {heroPicks.length > 0 && (
            <section className="container-editorial py-16">
              <p className="mb-8 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                Im Spotlight
              </p>
              <div className="grid gap-x-6 gap-y-12 md:grid-cols-3">
                {heroPicks.map((p, i) => (
                  <ProductCard key={p.node.id} product={p} priority={i < 3} />
                ))}
              </div>
            </section>
          )}

          {/* Looks block in between */}
          {featuredLooks.length > 0 && (
            <section className="border-y border-border bg-secondary/30 py-16">
              <div className="container-editorial">
                <div className="mb-8 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                      Neue Looks
                    </p>
                    <h2 className="mt-2 font-display text-3xl md:text-4xl">
                      Fertig kombiniert.
                    </h2>
                  </div>
                  <Link
                    to="/looks"
                    className="text-sm font-medium underline underline-offset-4 hover:text-primary"
                  >
                    Alle Looks →
                  </Link>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {featuredLooks.map((l) => (
                    <LookCard key={l.slug} look={l} />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Rest of new arrivals */}
          {gridPicks.length > 0 && (
            <section className="container-editorial py-16">
              <p className="mb-8 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                Weitere Neuheiten
              </p>
              <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                {expandProductsByColor(gridPicks).map((p) => (
                  <ProductCard
                    key={`${p.node.id}-${p.initialColor ?? "default"}`}
                    product={p}
                    initialColor={p.initialColor}
                  />
                ))}
              </div>

              <div className="mt-16 flex justify-center">
                <Button asChild variant="outline" size="lg">
                  <Link to="/shop">Gesamtes Sortiment ansehen</Link>
                </Button>
              </div>
            </section>
          )}
        </>
      )}
    </SiteLayout>
  );
};

export default Neuheiten;
