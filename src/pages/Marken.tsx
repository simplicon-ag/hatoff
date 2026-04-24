import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductCard } from "@/components/ProductCard";
import { marken } from "@/data/looks";
import { fetchProducts, type ShopifyProduct } from "@/lib/shopify";

const MarkenIndex = () => (
  <SiteLayout>
    <section className="container-editorial py-16 md:py-24">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Marken</p>
      <h1 className="mt-2 font-display text-5xl md:text-6xl">Sorgfältig ausgewählt.</h1>
      <div className="mt-12 grid gap-8 md:grid-cols-2">
        {marken.map((m) => (
          <Link key={m.slug} to={`/marken/${m.slug}`} className="group block border border-border bg-background p-8 transition hover:border-primary">
            <h2 className="font-display text-3xl group-hover:text-primary">{m.name}</h2>
            <p className="mt-2 text-sm uppercase tracking-wide text-muted-foreground">{m.tagline}</p>
            <p className="mt-4 text-foreground/80">{m.story}</p>
          </Link>
        ))}
      </div>
    </section>
  </SiteLayout>
);

const MarkenDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const marke = marken.find((m) => m.slug === slug);
  const [products, setProducts] = useState<ShopifyProduct[]>([]);

  useEffect(() => {
    if (!marke) return;
    fetchProducts(50, `vendor:${marke.name}`).then(setProducts);
  }, [marke]);

  if (!marke) {
    return (
      <SiteLayout>
        <div className="container-editorial py-32 text-center">
          <h1 className="font-display text-3xl">Marke nicht gefunden</h1>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <section className="container-editorial py-16 md:py-24">
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Marke</p>
        <h1 className="mt-2 font-display text-5xl md:text-6xl">{marke.name}</h1>
        <p className="mt-2 text-xl text-muted-foreground">{marke.tagline}</p>
        <p className="mt-6 max-w-2xl text-foreground/85">{marke.story}</p>
      </section>
      <section className="container-editorial pb-16">
        {products.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">Bald: Stücke von {marke.name}</p>
        ) : (
          <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => <ProductCard key={p.node.id} product={p} />)}
          </div>
        )}
      </section>
    </SiteLayout>
  );
};

export { MarkenIndex, MarkenDetail };
