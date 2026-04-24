import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, ShoppingBag } from "lucide-react";
import type { ShopifyProduct } from "@/lib/shopify";
import { formatPrice } from "@/lib/shopify";
import { useLivePrice, formatLivePrice } from "@/hooks/useLivePrice";
import { useCartStore } from "@/stores/cartStore";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  product: ShopifyProduct;
  priority?: boolean;
}

export const ProductCard = ({ product, priority }: Props) => {
  const p = product.node;
  const images = p.images.edges;
  const primary = images[0]?.node;
  const secondary = images[1]?.node;
  const price = p.priceRange.minVariantPrice;
  const { price: livePrice } = useLivePrice(p.handle);
  const displayPrice = formatLivePrice(livePrice) ?? formatPrice(price.amount, price.currencyCode);

  const firstAvailable = p.variants.edges.find((e) => e.node.availableForSale)?.node;
  const soldOut = !firstAvailable;

  const addItem = useCartStore((s) => s.addItem);
  const isLoading = useCartStore((s) => s.isLoading);
  const [adding, setAdding] = useState(false);

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!firstAvailable) return;
    // If product has size/colour options and >1 variant, route to detail page
    const needsChoice = p.variants.edges.length > 1;
    if (needsChoice) {
      window.location.href = `/product/${p.handle}`;
      return;
    }
    setAdding(true);
    await addItem({
      productHandle: p.handle,
      productTitle: p.title,
      productImage: primary?.url ?? null,
      variantId: firstAvailable.id,
      variantTitle: firstAvailable.title,
      price: firstAvailable.price,
      quantity: 1,
      selectedOptions: firstAvailable.selectedOptions,
    });
    setAdding(false);
    toast.success("Zum Warenkorb hinzugefügt", { description: p.title, position: "top-right" });
  };

  return (
    <Link to={`/product/${p.handle}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
        {primary ? (
          <>
            <img
              src={primary.url}
              alt={primary.altText ?? p.title}
              loading={priority ? "eager" : "lazy"}
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
                secondary ? "group-hover:opacity-0" : "",
              )}
            />
            {secondary && (
              <img
                src={secondary.url}
                alt={secondary.altText ?? p.title}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              />
            )}
            {!secondary && (
              <div className="absolute inset-0 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105" />
            )}
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            Kein Bild
          </div>
        )}

        {soldOut && (
          <span className="absolute left-3 top-3 bg-foreground/90 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-background">
            Ausverkauft
          </span>
        )}

        {!soldOut && (
          <button
            onClick={handleQuickAdd}
            disabled={adding || isLoading}
            className="absolute bottom-0 left-0 right-0 flex translate-y-full items-center justify-center gap-2 bg-foreground px-4 py-3 text-xs uppercase tracking-[0.2em] text-background transition-transform duration-300 group-hover:translate-y-0 disabled:opacity-60"
            aria-label="Schnell zum Warenkorb hinzufügen"
          >
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingBag className="h-3.5 w-3.5" />}
            {p.variants.edges.length > 1 ? "Optionen wählen" : "In den Warenkorb"}
          </button>
        )}
      </div>
      <div className="mt-4 space-y-1">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{p.vendor}</p>
        <h3 className="font-display text-lg leading-tight">{p.title}</h3>
        <p className="text-sm text-foreground/80">{displayPrice}</p>
      </div>
    </Link>
  );
};
