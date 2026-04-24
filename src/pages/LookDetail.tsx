import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { looks } from "@/data/looks";
import { fetchProductsByHandles, type ShopifyProduct } from "@/lib/shopify";
import { useCartStore } from "@/stores/cartStore";

const LookDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const look = looks.find((l) => l.slug === slug);
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const addItems = useCartStore((s) => s.addItems);
  const isLoading = useCartStore((s) => s.isLoading);

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
          <Link to="/looks" className="mt-4 inline-block text-primary hover:underline">Zurück zu allen Looks</Link>
        </div>
      </SiteLayout>
    );
  }

  const handleAddAll = async () => {
    const items = products
      .map((p) => {
        const v = p.node.variants.edges[0]?.node;
        if (!v) return null;
        return {
          productHandle: p.node.handle,
          productTitle: p.node.title,
          productImage: p.node.images.edges[0]?.node.url ?? null,
          variantId: v.id,
          variantTitle: v.title,
          price: v.price,
          quantity: 1,
          selectedOptions: v.selectedOptions ?? [],
        };
      })
      .filter(Boolean) as Parameters<typeof addItems>[0];
    await addItems(items);
  };

  return (
    <SiteLayout>
      <section className="relative h-[60vh] min-h-[420px] w-full overflow-hidden">
        {(look.hero ?? products[0]?.node.images.edges[0]?.node.url) && (
          <img src={look.hero ?? products[0]?.node.images.edges[0]?.node.url} alt={look.title} className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-foreground/10 to-foreground/70" />
        <div className="container-editorial relative flex h-full flex-col justify-end pb-12 text-primary-foreground">
          <p className="text-[11px] uppercase tracking-[0.3em] opacity-90">Look</p>
          <h1 className="mt-3 max-w-3xl font-display text-5xl md:text-6xl">{look.title}</h1>
          <p className="mt-2 text-lg opacity-90">{look.subtitle}</p>
        </div>
      </section>

      <section className="container-editorial grid gap-12 py-16 md:grid-cols-[1fr_2fr]">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Story</p>
          <p className="mt-4 leading-relaxed text-foreground/85">{look.story}</p>
          <Button onClick={handleAddAll} disabled={loading || isLoading || products.length === 0} className="mt-8" size="lg">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kompletten Look in den Warenkorb"}
          </Button>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Stücke im Look</p>
          {loading ? (
            <p className="py-12 text-center text-muted-foreground">Lade Produkte …</p>
          ) : (
            <div className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2">
              {products.map((p) => <ProductCard key={p.node.id} product={p} />)}
            </div>
          )}
        </div>
      </section>
    </SiteLayout>
  );
};

export default LookDetail;
