import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductCard } from "@/components/ProductCard";
import { LookCard } from "@/components/LookCard";
import { fetchAllProducts, expandProductsByColor, type ShopifyProduct } from "@/lib/shopify";
import { looks } from "@/data/looks";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

const HERO_COUNT = 3;
const GRID_COUNT = 18;
const LOOKS_COUNT = 3;

const Neuheiten = () => {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBrand, setActiveBrand] = useState<string>("Alle");

  useEffect(() => {
    fetchAllProducts()
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  // Sort by Shopify GID (monotonic → newest first)
  const newest = useMemo(
    () => [...products].sort((a, b) => b.node.id.localeCompare(a.node.id)),
    [products],
  );

  const brands = useMemo(() => {
    const set = new Map<string, number>();
    newest.forEach((p) => {
      const v = p.node.vendor || "Sonstige";
      set.set(v, (set.get(v) ?? 0) + 1);
    });
    return Array.from(set.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [newest]);

  const filtered = useMemo(
    () =>
      activeBrand === "Alle"
        ? newest
        : newest.filter((p) => (p.node.vendor || "Sonstige") === activeBrand),
    [newest, activeBrand],
  );

  const heroPicks = filtered.slice(0, HERO_COUNT);
  const gridPicks = filtered.slice(HERO_COUNT, HERO_COUNT + GRID_COUNT);
  const featuredLooks = looks.slice(0, LOOKS_COUNT);

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

      {/* Brand filter */}
      <section className="container-editorial mt-10">
        <div className="flex flex-wrap gap-2 border-b border-border pb-6">
          <button
            onClick={() => setActiveBrand("Alle")}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              activeBrand === "Alle"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:border-primary"
            }`}
          >
            Alle <span className="ml-1 text-xs opacity-70">{newest.length}</span>
          </button>
          {brands.map(([name, count]) => (
            <button
              key={name}
              onClick={() => setActiveBrand(name)}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                activeBrand === name
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:border-primary"
              }`}
            >
              {name} <span className="ml-1 text-xs opacity-70">{count}</span>
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
          <p className="text-muted-foreground">Keine Neuheiten für „{activeBrand}".</p>
          <Button variant="link" onClick={() => setActiveBrand("Alle")} className="mt-2">
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
