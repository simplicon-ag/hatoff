import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Flame,
  Sparkles,
  Star,
  Truck,
  MapPin,
  Compass,
  MousePointerClick,
  ShoppingBag,
} from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { FeaturedLook } from "@/components/FeaturedLook";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { magazinArtikel, marken, welten } from "@/data/looks";
import { useCuratedLooks } from "@/hooks/useCuratedLooks";
import { fetchProducts, fetchProductsByHandles, type ShopifyProduct } from "@/lib/shopify";
import { supabase } from "@/integrations/supabase/client";
import heroImg from "@/assets/hero.jpg";

const weltLabel: Record<string, string> = {
  business: "Für's Büro",
  hemden: "Smart Casual",
  jacken: "Weekend",
  sommer: "Sommer",
  freizeit: "Alltag",
  "smart-casual": "Date Night",
};

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
  const heroLook = featuredLooks[0];
  const sideLooks = featuredLooks.slice(1, 3);

  // Social-Wall: bis zu 8 Look-Hero-Bilder
  const wallLooks = looks
    .filter((l) => l.hero)
    .slice(0, 8);

  return (
    <SiteLayout>
      {/* ───────── Hero ───────── */}
      <section className="relative h-[88vh] min-h-[640px] w-full overflow-hidden">
        <img
          src={heroImg}
          alt="Mann in cognacfarbenem Hemd"
          className="absolute inset-0 h-full w-full object-cover animate-ken-burns"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-foreground/10 via-foreground/30 to-foreground/75" />
        <div className="container-editorial relative flex h-full flex-col justify-end pb-16 text-primary-foreground animate-fade-up md:pb-20">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-background/30 bg-background/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.25em] backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            Neue Frühlings-Looks live
          </div>
          <h1 className="mt-5 max-w-3xl text-balance font-display text-5xl leading-[1.05] md:text-7xl">
            Finde deinen Look.
            <br />
            <span className="relative inline-block">
              Einfach kombiniert.
              <span className="absolute -bottom-1 left-0 h-[3px] w-full bg-accent/80" />
            </span>{" "}
            Stilvoll getragen.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed opacity-90 md:text-lg">
            HATOFF kuratiert komplette Looks für jeden Anlass — du findest, kombinierst und trägst.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-background text-foreground hover:bg-background/90">
              <Link to="/looks">
                Looks entdecken <ArrowRight className="ml-1 h-4 w-4" />
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
            <a
              href="#so-funktionierts"
              className="hidden items-center gap-1.5 self-center text-sm tracking-wide opacity-80 underline-offset-4 hover:opacity-100 hover:underline md:inline-flex"
            >
              Wie funktioniert HATOFF? ↓
            </a>
          </div>

          {/* Trust-Bar */}
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] tracking-wide opacity-90">
            <span className="flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 fill-accent text-accent" /> 4.9 / 5 Kundenzufriedenheit
            </span>
            <span className="hidden h-3 w-px bg-background/40 md:inline-block" />
            <span className="flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5" /> Gratis Versand & Retoure
            </span>
            <span className="hidden h-3 w-px bg-background/40 md:inline-block" />
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Versand aus der Schweiz
            </span>
          </div>
        </div>
      </section>

      {/* ───────── So funktioniert HATOFF ───────── */}
      <section id="so-funktionierts" className="container-editorial py-16 md:py-20">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">So einfach</p>
          <h2 className="mt-2 font-display text-3xl md:text-4xl">In drei Schritten gut angezogen.</h2>
        </div>
        <div className="grid gap-8 md:grid-cols-3 md:gap-12">
          {[
            {
              icon: Compass,
              title: "Look entdecken",
              text: "Kuratiert für jeden Anlass — Büro, Wochenende, Date.",
              num: "01",
            },
            {
              icon: MousePointerClick,
              title: "Mit einem Tap kombinieren",
              text: "Ganzes Outfit in den Warenkorb. Keine Stilfragen offen.",
              num: "02",
            },
            {
              icon: ShoppingBag,
              title: "Stilvoll tragen",
              text: "Schweizer Versand, kostenlose Retoure, jederzeit Beratung.",
              num: "03",
            },
          ].map((step) => (
            <div key={step.num} className="group relative">
              <span className="absolute -top-2 right-0 font-display text-6xl text-accent/20 md:text-7xl">
                {step.num}
              </span>
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-secondary text-primary transition-colors group-hover:border-accent group-hover:bg-accent/10 group-hover:text-accent">
                <step.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-display text-xl">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── Style-Welten (asymmetrisch + Hover-Reveal) ───────── */}
      <section className="container-editorial py-16 md:py-24">
        <div className="mb-12 flex items-end justify-between gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Style-Welten</p>
            <h2 className="mt-2 font-display text-4xl md:text-5xl">Sechs Welten, ein Stil.</h2>
          </div>
          <Link to="/looks" className="hidden text-sm text-primary hover:underline md:inline">
            Alle Looks →
          </Link>
        </div>
        <div className="grid auto-rows-[260px] grid-cols-2 gap-3 md:auto-rows-[320px] md:grid-cols-4 md:gap-4">
          {welten.map((w, i) => {
            const lookCount = looks.filter((l) => l.welt === w.id).length;
            const featured = i === 0;
            return (
              <Link
                key={w.id}
                to={`/looks?welt=${w.id}`}
                className={`group relative overflow-hidden bg-secondary ${
                  featured ? "col-span-2 row-span-2" : ""
                }`}
              >
                <img
                  src={w.image}
                  alt={w.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-primary-foreground md:p-6">
                  <p className="text-[10px] uppercase tracking-[0.25em] opacity-80">
                    {lookCount > 0 ? `${lookCount} ${lookCount === 1 ? "Look" : "Looks"}` : "Demnächst"}
                  </p>
                  <h3 className={`mt-1 font-display ${featured ? "text-3xl md:text-5xl" : "text-xl md:text-2xl"}`}>
                    {w.title}
                  </h3>
                  <p
                    className={`mt-1 text-xs opacity-90 ${
                      featured ? "max-w-md md:text-sm" : "line-clamp-1"
                    }`}
                  >
                    {w.description}
                  </p>
                  <span className="mt-3 inline-flex translate-y-2 items-center gap-1 text-xs font-medium tracking-wide opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                    Entdecken <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ───────── Featured Looks (asymmetrisch) ───────── */}
      {heroLook && (
        <section className="container-editorial py-16 md:py-24">
          <div className="mb-12 flex items-end justify-between gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Aktuelle Looks</p>
              <h2 className="mt-2 font-display text-4xl md:text-5xl">Diese Woche im Spotlight.</h2>
              <p className="mt-3 max-w-xl text-muted-foreground">
                Echte Stücke aus dem Shop — klick aufs Bild zum Einzelteil oder hol dir den ganzen Look mit einem Tap.
              </p>
            </div>
            <Link to="/looks" className="hidden text-sm text-primary hover:underline md:inline">
              Alle Looks →
            </Link>
          </div>

          <div className="grid gap-x-8 gap-y-12 lg:grid-cols-5">
            {/* Hero-Look links (groß) */}
            <div className="relative lg:col-span-3">
              <span className="absolute -top-3 left-4 z-10 inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-foreground shadow-soft">
                <Star className="h-3 w-3 fill-current" /> Look der Woche
              </span>
              {weltLabel[heroLook.welt] && (
                <span className="absolute -top-3 right-4 z-10 rounded-full bg-foreground px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-background">
                  {weltLabel[heroLook.welt]}
                </span>
              )}
              <FeaturedLook look={heroLook} />
            </div>

            {/* Zwei kleinere rechts */}
            <div className="grid gap-y-12 lg:col-span-2">
              {sideLooks.map((l) => (
                <div key={l.slug} className="relative">
                  {weltLabel[l.welt] && (
                    <span className="absolute -top-3 right-4 z-10 rounded-full bg-foreground px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-background">
                      {weltLabel[l.welt]}
                    </span>
                  )}
                  <FeaturedLook look={l} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ───────── Brand Strip ───────── */}
      <section className="border-y border-border bg-background">
        <div className="container-editorial flex flex-wrap items-center justify-center gap-x-12 gap-y-4 py-10 text-muted-foreground">
          {marken.map((m) => (
            <Link
              key={m.slug}
              to={`/marken/${m.slug}`}
              className="font-display text-lg tracking-wide transition-colors hover:text-primary"
            >
              {m.name}
            </Link>
          ))}
        </div>
      </section>

      {/* ───────── Social Proof Wall ───────── */}
      {wallLooks.length >= 4 && (
        <section className="container-editorial py-16 md:py-24">
          <div className="mb-10 flex items-end justify-between gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Aus dem Look-Universum</p>
              <h2 className="mt-2 font-display text-4xl md:text-5xl">So tragen sie HATOFF.</h2>
              <p className="mt-3 max-w-xl text-muted-foreground">
                Echte Outfits, echte Kombinationen — direkt in deinen Warenkorb.
              </p>
            </div>
            <Link to="/looks" className="hidden text-sm text-primary hover:underline md:inline">
              Alle Looks →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
            {wallLooks.map((l) => (
              <Link
                key={l.slug}
                to={`/looks/${l.slug}`}
                className="group relative aspect-square overflow-hidden bg-secondary"
              >
                <img
                  src={l.hero}
                  alt={l.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-foreground/0 transition-colors duration-300 group-hover:bg-foreground/40" />
                <div className="absolute inset-x-0 bottom-0 translate-y-2 p-3 text-primary-foreground opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                  <p className="text-[10px] uppercase tracking-[0.2em] opacity-80">Look</p>
                  <h3 className="font-display text-sm leading-tight md:text-base">{l.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ───────── Neu eingetroffen ───────── */}
      <section className="container-editorial py-16 md:py-24">
        <div className="mb-12 flex items-end justify-between">
          <div>
            <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
              <Sparkles className="h-3 w-3" /> Neu eingetroffen
            </p>
            <h2 className="mt-2 font-display text-4xl md:text-5xl">Frisch im Sortiment.</h2>
          </div>
          <Link to="/shop" className="hidden text-sm text-primary hover:underline md:inline">
            Alle Produkte →
          </Link>
        </div>
        {products.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">Produkte werden geladen …</p>
        ) : (
          <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {products.slice(0, 4).map((p) => (
              <ProductCard key={p.node.id} product={p} />
            ))}
          </div>
        )}
      </section>

      {/* ───────── Sale-Highlights (warmer Sand statt Destructive) ───────── */}
      {saleProducts.length > 0 && (
        <section className="border-y border-border bg-secondary/60">
          <div className="container-editorial py-16 md:py-24">
            <div className="mb-12 flex items-end justify-between gap-6">
              <div>
                <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-accent">
                  <Flame className="h-3 w-3" /> Aktuelle Deals
                </p>
                <h2 className="mt-2 font-display text-4xl md:text-5xl">
                  Sale-<span className="text-accent">Highlights.</span>
                </h2>
                <p className="mt-3 max-w-xl text-muted-foreground">
                  Die grössten Ersparnisse aus den aktuellen Aktionen unserer Marken — solange Vorrat reicht.
                </p>
              </div>
              <Link
                to="/sale"
                className="hidden text-sm font-medium text-accent hover:underline md:inline"
              >
                Alle Sale-Stücke →
              </Link>
            </div>
            <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
              {saleProducts.map((p) => (
                <ProductCard key={p.node.id} product={p} />
              ))}
            </div>
            <div className="mt-10 text-center md:hidden">
              <Link to="/sale" className="text-sm font-medium text-accent hover:underline">
                Alle Sale-Stücke →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ───────── Magazin Teaser ───────── */}
      <section className="container-editorial py-16 md:py-24">
        <div className="mb-12 flex items-end justify-between gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Magazin</p>
            <h2 className="mt-2 font-display text-4xl md:text-5xl">Lesen, lernen, besser kombinieren.</h2>
          </div>
          <Link to="/magazin" className="hidden text-sm text-primary hover:underline md:inline">
            Alle Artikel →
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-3 md:gap-8">
          {magazinArtikel.map((a, i) => (
            <Link
              key={a.slug}
              to={`/magazin/${a.slug}`}
              className={`group block ${i === 0 ? "md:col-span-2 md:row-span-1" : ""}`}
            >
              <div
                className={`relative overflow-hidden bg-secondary ${
                  i === 0 ? "aspect-[16/10]" : "aspect-[4/3]"
                }`}
              >
                <img
                  src={a.image}
                  alt={a.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-foreground backdrop-blur-sm">
                  Styling-Guide
                </span>
              </div>
              <p className="mt-4 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {a.readingTime} · Von der HATOFF Redaktion
              </p>
              <h3
                className={`mt-1 font-display leading-tight transition-colors group-hover:text-primary ${
                  i === 0 ? "text-3xl" : "text-2xl"
                }`}
              >
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
