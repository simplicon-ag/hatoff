import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, ShoppingBag, ArrowRight } from "lucide-react";
import type { CuratedLook } from "@/data/looks";
import { fetchProductsByHandles, type ShopifyProduct } from "@/lib/shopify";
import { useLivePrices } from "@/hooks/useLivePrice";
import { useCartStore } from "@/stores/cartStore";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  look: CuratedLook;
}

export const FeaturedLook = ({ look }: Props) => {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const addItems = useCartStore((s) => s.addItems);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchProductsByHandles(look.productHandles)
      .then((res) => {
        if (active) setProducts(res);
      })
      .catch((e) => console.error(e))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [look]);

  const heroImage = look.hero ?? products[0]?.node.images.edges[0]?.node.url ?? null;
  const handles = useMemo(() => products.map((p) => p.node.handle), [products]);
  const { prices: livePrices } = useLivePrices(handles);
  const total = products.reduce((sum, p) => {
    const live = livePrices[p.node.handle];
    if (live) return sum + live.display_price_chf;
    const v = p.node.variants.edges.find((e) => e.node.availableForSale)?.node;
    return v ? sum + parseFloat(v.price.amount) : sum;
  }, 0);

  const handleAddAll = async () => {
    const items = products
      .map((p) => {
        const v = p.node.variants.edges.find((e) => e.node.availableForSale)?.node;
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
    if (items.length === 0) return;
    setAdding(true);
    await addItems(items);
    setAdding(false);
    toast.success("Look in den Warenkorb", {
      description: `${items.length} Stücke · ${look.title}`,
      position: "top-right",
    });
  };

  return (
    <article className="group flex flex-col">
      {/* Hero */}
      <Link to={`/looks/${look.slug}`} className="relative block aspect-[4/5] overflow-hidden bg-secondary">
        {heroImage ? (
          <img
            src={heroImage}
            alt={look.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full animate-pulse bg-secondary" />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-foreground/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6 text-primary-foreground">
          <p className="text-[11px] uppercase tracking-[0.2em] opacity-80">Look</p>
          <h3 className="mt-1 font-display text-2xl leading-tight">{look.title}</h3>
          <p className="mt-1 text-sm opacity-90">{look.subtitle}</p>
        </div>
      </Link>

      {/* Stücke im Look — clickable thumbnails */}
      <div className="mt-4 flex gap-3">
        {loading
          ? Array.from({ length: look.productHandles.length }).map((_, i) => (
              <div key={i} className="aspect-square flex-1 animate-pulse bg-secondary" />
            ))
          : products.map((p) => (
              <Link
                key={p.node.id}
                to={`/product/${p.node.handle}`}
                className="group/item relative block aspect-square flex-1 overflow-hidden bg-secondary"
                title={p.node.title}
              >
                {p.node.images.edges[0]?.node.url && (
                  <img
                    src={p.node.images.edges[0].node.url}
                    alt={p.node.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover/item:scale-110"
                  />
                )}
                <div className="absolute inset-0 bg-foreground/0 transition-colors duration-300 group-hover/item:bg-foreground/20" />
              </Link>
            ))}
      </div>

      {/* Preis + CTA */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-sm">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {products.length} Stücke
          </p>
          <p className="font-display text-lg">
            {loading ? "—" : `CHF ${total.toFixed(2)}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/looks/${look.slug}`}>
              Details <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button onClick={handleAddAll} disabled={loading || adding || products.length === 0} size="sm">
            {adding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <ShoppingBag className="mr-1 h-3.5 w-3.5" />
                Look kaufen
              </>
            )}
          </Button>
        </div>
      </div>
    </article>
  );
};
