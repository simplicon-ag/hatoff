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

/** Parse "handle#color=Dunkelblau" → { handle, color } */
function parseHandle(raw: string): { handle: string; color?: string } {
  const [handle, hash] = raw.split("#");
  if (!hash) return { handle };
  const m = hash.match(/color=([^&]+)/i);
  return { handle, color: m ? decodeURIComponent(m[1]) : undefined };
}

/** Find variant matching a color (case-insensitive). */
function variantForColor(
  product: ShopifyProduct["node"],
  color: string | undefined,
) {
  const variants = product.variants.edges.map((e) => e.node);
  if (!color) {
    return variants.find((v) => v.availableForSale) ?? variants[0];
  }
  const match =
    variants.find(
      (v) =>
        v.availableForSale &&
        v.selectedOptions.some(
          (o) => /farbe|color|colour/i.test(o.name) && o.value.toLowerCase() === color.toLowerCase(),
        ),
    ) ??
    variants.find((v) =>
      v.selectedOptions.some(
        (o) => /farbe|color|colour/i.test(o.name) && o.value.toLowerCase() === color.toLowerCase(),
      ),
    );
  return match ?? variants.find((v) => v.availableForSale) ?? variants[0];
}

export const FeaturedLook = ({ look }: Props) => {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const addItems = useCartStore((s) => s.addItems);

  // Pro Slot die gewünschte Farbe (aus dem #color=… Suffix der Handles)
  const slots = useMemo(() => look.productHandles.map(parseHandle), [look.productHandles]);

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

  // Mappe geladene Produkte zurück auf ihre Slots, damit wir die richtige Farbvariante kennen
  const productSlots = useMemo(() => {
    return slots
      .map((slot) => {
        const product = products.find((p) => p.node.handle === slot.handle);
        if (!product) return null;
        const variant = variantForColor(product.node, slot.color);
        // Thumbnail-Bild:
        //  - Wenn der Slot eine Farbe vorgibt → Variant-Bild dieser Farbe (Fallback: Hauptbild)
        //  - Sonst → Hauptbild des Produkts
        const image = slot.color
          ? variant?.image?.url ?? product.node.images.edges[0]?.node.url ?? null
          : product.node.images.edges[0]?.node.url ?? null;
        return { product, variant, image, color: slot.color };
      })
      .filter(Boolean) as Array<{
      product: ShopifyProduct;
      variant: ShopifyProduct["node"]["variants"]["edges"][number]["node"];
      image: string | null;
      color?: string;
    }>;
  }, [slots, products]);

  const heroImage = look.hero ?? productSlots[0]?.image ?? null;
  const handles = useMemo(() => products.map((p) => p.node.handle), [products]);
  const { prices: livePrices } = useLivePrices(handles);
  const total = productSlots.reduce((sum, s) => {
    const live = livePrices[s.product.node.handle];
    if (live) return sum + live.display_price_chf;
    return s.variant ? sum + parseFloat(s.variant.price.amount) : sum;
  }, 0);

  const handleAddAll = async () => {
    const items = productSlots
      .map((s) => {
        if (!s.variant) return null;
        return {
          productHandle: s.product.node.handle,
          productTitle: s.product.node.title,
          productImage: s.image,
          variantId: s.variant.id,
          variantTitle: s.variant.title,
          price: s.variant.price,
          quantity: 1,
          selectedOptions: s.variant.selectedOptions ?? [],
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

      {/* Stücke im Look — clickable thumbnails (Farb-Variant-Bild wenn vorhanden) */}
      <div className="mt-4 flex gap-3">
        {loading
          ? Array.from({ length: look.productHandles.length }).map((_, i) => (
              <div key={i} className="aspect-square flex-1 animate-pulse bg-secondary" />
            ))
          : productSlots.map((s, i) => {
              const href = s.color
                ? `/product/${s.product.node.handle}?farbe=${encodeURIComponent(s.color)}`
                : `/product/${s.product.node.handle}`;
              return (
                <Link
                  key={`${s.product.node.id}-${i}`}
                  to={href}
                  className="group/item relative block aspect-square flex-1 overflow-hidden bg-muted/60 ring-1 ring-border/40 transition-colors hover:bg-muted"
                  title={`${s.product.node.title}${s.color ? ` · ${s.color}` : ""}`}
                >
                  {s.image && (
                    <img
                      src={s.image}
                      alt={s.product.node.title}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-contain p-3 transition-transform duration-500 group-hover/item:scale-105"
                    />
                  )}
                </Link>
              );
            })}
      </div>

      {/* Preis + CTA */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-sm">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {productSlots.length} Stücke
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
          <Button onClick={handleAddAll} disabled={loading || adding || productSlots.length === 0} size="sm">
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
