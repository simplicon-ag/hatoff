import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductCard } from "@/components/ProductCard";
import { anlaesse } from "@/data/looks";
import { fetchProducts, type ShopifyProduct } from "@/lib/shopify";

const AnlassPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const anlass = anlaesse.find((a) => a.slug === slug);
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetchProducts(50, `tag:anlass:${slug}`)
      .then(setProducts)
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <SiteLayout>
      <section className="container-editorial pt-16 md:pt-24">
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Anlass</p>
        <h1 className="mt-2 font-display text-5xl md:text-6xl">{anlass?.title ?? "Anlass"}</h1>

        <div className="mt-8 flex flex-wrap gap-2">
          {anlaesse.map((a) => (
            <Link
              key={a.slug}
              to={`/anlass/${a.slug}`}
              className={`rounded-full border px-4 py-2 text-sm ${
                a.slug === slug ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"
              }`}
            >
              {a.title}
            </Link>
          ))}
        </div>
      </section>

      <section className="container-editorial py-16">
        {loading ? (
          <p className="py-16 text-center text-muted-foreground">Lade Produkte …</p>
        ) : products.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">No products found</p>
        ) : (
          <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => <ProductCard key={p.node.id} product={p} />)}
          </div>
        )}
      </section>
    </SiteLayout>
  );
};

export default AnlassPage;
