import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { FeaturedLook } from "@/components/FeaturedLook";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { looks, magazinArtikel, marken, welten } from "@/data/looks";
import { fetchProducts, type ShopifyProduct } from "@/lib/shopify";
import heroImg from "@/assets/hero.jpg";

const Index = () => {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);

  useEffect(() => {
    fetchProducts(8).then(setProducts).catch((e) => console.error(e));
  }, []);

  const featuredLooks = looks.slice(0, 3);

  return (
    <SiteLayout>
      {/* Hero */}
      <section className="relative h-[88vh] min-h-[640px] w-full overflow-hidden">
        <img
          src={heroImg}
          alt="Mann in cognacfarbenem Hemd"
          className="absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-foreground/10 via-foreground/30 to-foreground/70" />
        <div className="container-editorial relative flex h-full flex-col justify-end pb-20 text-primary-foreground animate-fade-up">
          <p className="text-[11px] uppercase tracking-[0.3em] opacity-90">Kuratiertes Outfit-Universum</p>
          <h1 className="mt-4 max-w-3xl text-balance font-display text-5xl leading-[1.05] md:text-7xl">
            Finde deinen Look. Einfach kombiniert. Stilvoll getragen.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed opacity-90 md:text-lg">
            HATOFF kuratiert komplette Looks für jeden Anlass — du findest, kombinierst und trägst.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-background text-foreground hover:bg-background/90">
              <Link to="/looks">Looks entdecken <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-background/40 bg-transparent text-primary-foreground hover:bg-background/10">
              <Link to="/shop">Zum Shop</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Style-Welten */}
      <section className="container-editorial py-20 md:py-28">
        <div className="mb-12 flex items-end justify-between gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Style-Welten</p>
            <h2 className="mt-2 font-display text-4xl md:text-5xl">Sechs Welten, ein Stil.</h2>
          </div>
          <Link to="/looks" className="hidden text-sm text-primary hover:underline md:inline">Alle Looks →</Link>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
          {welten.map((w) => (
            <Link key={w.id} to={`/looks?welt=${w.id}`} className="group relative aspect-[4/5] overflow-hidden bg-secondary">
              <img src={w.image} alt={w.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-hero" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-primary-foreground">
                <h3 className="font-display text-2xl">{w.title}</h3>
                <p className="text-xs opacity-90">{w.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Looks */}
      <section className="container-editorial py-20 md:py-28">
        <div className="mb-12 flex items-end justify-between gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Aktuelle Looks</p>
            <h2 className="mt-2 font-display text-4xl md:text-5xl">Diese Woche im Spotlight.</h2>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Echte Stücke aus dem Shop — klick aufs Bild zum Einzelteil oder hol dir den ganzen Look mit einem Tap.
            </p>
          </div>
          <Link to="/looks" className="hidden text-sm text-primary hover:underline md:inline">Alle Looks →</Link>
        </div>
        <div className="grid gap-x-8 gap-y-12 md:grid-cols-3">
          {featuredLooks.map((l) => <FeaturedLook key={l.slug} look={l} />)}
        </div>
      </section>

      {/* Brand Strip */}
      <section className="border-y border-border bg-background">
        <div className="container-editorial flex flex-wrap items-center justify-center gap-x-12 gap-y-4 py-10 text-muted-foreground">
          {marken.map((m) => (
            <Link key={m.slug} to={`/marken/${m.slug}`} className="font-display text-lg tracking-wide hover:text-primary">
              {m.name}
            </Link>
          ))}
        </div>
      </section>

      {/* Shop preview */}
      <section className="container-editorial py-20 md:py-28">
        <div className="mb-12 flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Shop</p>
            <h2 className="mt-2 font-display text-4xl md:text-5xl">Einzelne Stücke.</h2>
          </div>
          <Link to="/shop" className="hidden text-sm text-primary hover:underline md:inline">Alle Produkte →</Link>
        </div>
        {products.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">Produkte werden geladen …</p>
        ) : (
          <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {products.slice(0, 4).map((p) => <ProductCard key={p.node.id} product={p} />)}
          </div>
        )}
      </section>

      {/* Magazin Teaser */}
      <section className="container-editorial py-20 md:py-28">
        <div className="mb-12">
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Magazin</p>
          <h2 className="mt-2 font-display text-4xl md:text-5xl">Lesen, lernen, besser kombinieren.</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {magazinArtikel.map((a) => (
            <Link key={a.slug} to={`/magazin/${a.slug}`} className="group block">
              <div className="aspect-[4/3] overflow-hidden bg-secondary">
                <img src={a.image} alt={a.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              </div>
              <p className="mt-4 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{a.readingTime}</p>
              <h3 className="mt-1 font-display text-2xl leading-tight group-hover:text-primary">{a.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{a.teaser}</p>
            </Link>
          ))}
        </div>
      </section>
    </SiteLayout>
  );
};

export default Index;
