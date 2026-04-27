import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SiteLayout } from "@/components/SiteLayout";
import { HeroCarousel } from "@/components/HeroCarousel";
import { FeaturedLook } from "@/components/FeaturedLook";
import { ProductCard } from "@/components/ProductCard";
import { TestimonialsSection } from "@/components/TestimonialsSection";
import { magazinArtikel, marken } from "@/data/looks";
import { useCuratedLooks } from "@/hooks/useCuratedLooks";
import { fetchProducts, fetchProductsByHandles, type ShopifyProduct } from "@/lib/shopify";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [saleProducts, setSaleProducts] = useState<ShopifyProduct[]>([]);

  useEffect(() => {
    fetchProducts(8).then(setProducts).catch((e) => console.error(e));

    (async () => {
      const { data } = await supabase
        .from("product_price_cache")
        .select("handle, display_price_chf, original_price_chf")
        .eq("on_sale", true)
        .neq("status", "mismatch")
        .not("original_price_chf", "is", null);
      if (!data || data.length === 0) return;
      const ranked = data
        .map((r) => ({
          handle: r.handle,
          discount:
            r.original_price_chf && Number(r.original_price_chf) > 0
              ? (Number(r.original_price_chf) - Number(r.display_price_chf)) /
                Number(r.original_price_chf)
              : 0,
        }))
        .sort((a, b) => b.discount - a.discount)
        .slice(0, 8)
        .map((r) => r.handle);
      const items = await fetchProductsByHandles(ranked);
      setSaleProducts(items.slice(0, 4));
    })().catch((e) => console.error("sale highlights", e));
  }, []);

  const { looks } = useCuratedLooks();
  const featuredLooks = looks.slice(0, 3);

  return (
    <SiteLayout>
      {/* ───────── Hero ───────── */}
      <HeroCarousel />

      {/* ───────── Schnell-Kategorien (PKZ-artige Tiles) ───────── */}
      <section className="container-editorial py-10 md:py-14">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {[
            { label: "New In", to: "/neuheiten" },
            { label: "Hemden", to: "/shop?kategorie=Hemden" },
            { label: "Looks", to: "/looks" },
            { label: "Sale", to: "/sale", accent: true },
          ].map((tile) => (
            <Link
              key={tile.label}
              to={tile.to}
              className={`flex h-20 items-center justify-center border text-sm font-bold uppercase tracking-[0.15em] transition md:h-28 md:text-base ${
                tile.accent
                  ? "border-destructive bg-destructive/5 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  : "border-border bg-secondary/40 text-foreground hover:border-foreground hover:bg-secondary"
              }`}
            >
              {tile.label}
            </Link>
          ))}
        </div>
      </section>

      {/* ───────── New In Produktraster ───────── */}
      <section className="container-editorial py-8 md:py-12">
        <div className="mb-6 flex items-end justify-between border-b border-border pb-4">
          <h2 className="text-xl font-bold uppercase tracking-[0.15em] text-foreground md:text-2xl">
            New In
          </h2>
          <Link
            to="/neuheiten"
            className="text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            Alle Neuheiten →
          </Link>
        </div>
        {products.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">Produkte werden geladen …</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
            {products.slice(0, 4).map((p) => (
              <ProductCard key={p.node.id} product={p} priority />
            ))}
          </div>
        )}
      </section>

      {/* ───────── Brand Strip ───────── */}
      <section className="border-y border-border bg-secondary/40">
        <div className="container-editorial py-8">
          <p className="mb-6 text-center text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Unsere Marken
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-foreground/70">
            {marken.map((m) => (
              <Link
                key={m.slug}
                to={`/marken/${m.slug}`}
                className="font-display text-base tracking-wide transition-colors hover:text-foreground md:text-lg"
              >
                {m.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Sale ───────── */}
      {saleProducts.length > 0 && (
        <section className="container-editorial py-8 md:py-12">
          <div className="mb-6 flex items-end justify-between border-b border-border pb-4">
            <div>
              <h2 className="text-xl font-bold uppercase tracking-[0.15em] text-destructive md:text-2xl">
                Sale
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Die grössten Deals — solange Vorrat reicht.
              </p>
            </div>
            <Link
              to="/sale"
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Alle Sale-Stücke →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
            {saleProducts.map((p) => (
              <ProductCard key={p.node.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* ───────── Looks ───────── */}
      <section className="container-editorial py-8 md:py-12">
        <div className="mb-6 flex items-end justify-between border-b border-border pb-4">
          <div>
            <h2 className="text-xl font-bold uppercase tracking-[0.15em] text-foreground md:text-2xl">
              Looks der Woche
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Komplette Outfits — ein Tap, fertig.
            </p>
          </div>
          <Link
            to="/looks"
            className="text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            Alle Looks →
          </Link>
        </div>
        <div className="grid gap-x-6 gap-y-10 md:grid-cols-3">
          {featuredLooks.map((l) => (
            <FeaturedLook key={l.slug} look={l} />
          ))}
        </div>
      </section>

      {/* ───────── Testimonials ───────── */}
      <TestimonialsSection />

      {/* ───────── Magazin ───────── */}
      <section className="container-editorial py-8 md:py-12">
        <div className="mb-6 flex items-end justify-between border-b border-border pb-4">
          <h2 className="text-xl font-bold uppercase tracking-[0.15em] text-foreground md:text-2xl">
            Stories
          </h2>
          <Link
            to="/magazin"
            className="text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            Zum Magazin →
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {magazinArtikel.map((a) => (
            <Link key={a.slug} to={`/magazin/${a.slug}`} className="group block">
              <div className="aspect-[4/3] overflow-hidden bg-secondary/70">
                <img
                  src={a.image}
                  alt={a.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                {a.readingTime} · HATOFF Redaktion
              </p>
              <h3 className="mt-1 font-display text-xl leading-tight transition-colors group-hover:text-primary">
                {a.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{a.teaser}</p>
            </Link>
          ))}
        </div>
      </section>
    </SiteLayout>
  );
};

export default Index;
