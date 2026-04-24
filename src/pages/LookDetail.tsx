import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, Check, ArrowRight } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductCard } from "@/components/ProductCard";
import { LookSetBuilder } from "@/components/LookSetBuilder";
import { looks } from "@/data/looks";
import { fetchProductsByHandles, type ShopifyProduct } from "@/lib/shopify";

const LookDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const look = looks.find((l) => l.slug === slug);
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!look) return;
    setLoading(true);
    fetchProductsByHandles(look.productHandles)
      .then(setProducts)
      .finally(() => setLoading(false));
  }, [look]);

  if (!look) {
    return (
      <SiteLayout>
        <div className="container-editorial py-32 text-center">
          <h1 className="font-display text-4xl">Look nicht gefunden</h1>
          <Link to="/looks" className="mt-4 inline-block text-primary hover:underline">
            Zurück zu allen Looks
          </Link>
        </div>
      </SiteLayout>
    );
  }

  const heroImage = look.hero ?? products[0]?.node.images.edges[0]?.node.url;

  return (
    <SiteLayout>
      {/* Hero */}
      <section className="relative h-[60vh] min-h-[420px] w-full overflow-hidden">
        {heroImage && (
          <img
            src={heroImage}
            alt={look.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-foreground/10 to-foreground/70" />
        <div className="container-editorial relative flex h-full flex-col justify-end pb-12 text-primary-foreground">
          <p className="text-[11px] uppercase tracking-[0.3em] opacity-90">Look</p>
          <h1 className="mt-3 max-w-3xl font-display text-5xl md:text-6xl">{look.title}</h1>
          <p className="mt-2 text-lg opacity-90">{look.subtitle}</p>
        </div>
      </section>

      {/* Hauptbereich: Set-Builder rechts (gross), Story links */}
      <section className="container-editorial grid gap-12 py-16 md:grid-cols-[1fr_1.6fr]">
        {/* Story + Highlights — sekundär */}
        <aside className="md:sticky md:top-24 md:self-start">
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Story</p>
          <p className="mt-4 leading-relaxed text-foreground/85">{look.story}</p>

          {look.highlights && look.highlights.length > 0 && (
            <ul className="mt-8 space-y-3 border-t border-border pt-6">
              {look.highlights.map((h, i) => {
                const [head, ...rest] = h.split(":");
                const tail = rest.join(":").trim();
                return (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <span>
                      {tail ? (
                        <>
                          <span className="font-medium text-foreground">{head}.</span>{" "}
                          <span className="text-muted-foreground">{tail}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">{h}</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Set-Builder — primärer CTA-Block */}
        <div>
          {loading ? (
            <div className="flex h-72 items-center justify-center rounded-lg border border-border bg-card">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
              Produkte konnten nicht geladen werden.
            </div>
          ) : (
            <LookSetBuilder products={products} lookTitle={look.title} />
          )}
        </div>
      </section>

      {/* Einzelteile — bewusst zurückhaltend, ganz unten */}
      {!loading && products.length > 0 && (
        <section className="border-t border-border bg-secondary/30">
          <div className="container-editorial py-16">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                  Lieber einzeln?
                </p>
                <h2 className="mt-2 font-display text-2xl md:text-3xl">
                  Auch einzeln bestellbar
                </h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Du willst nur ein Stück aus dem Look? Kein Problem — jedes Teil
                  öffnet seine eigene Detailseite.
                </p>
              </div>
              <Link
                to="/looks"
                className="text-sm text-primary hover:underline"
              >
                Weitere Looks ansehen <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <ProductCard key={p.node.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}
    </SiteLayout>
  );
};

export default LookDetail;
