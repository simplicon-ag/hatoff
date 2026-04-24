import { Link } from "react-router-dom";
import type { ShopifyProduct } from "@/lib/shopify";
import { formatPrice } from "@/lib/shopify";

interface Props {
  product: ShopifyProduct;
  priority?: boolean;
}

export const ProductCard = ({ product, priority }: Props) => {
  const p = product.node;
  const img = p.images.edges[0]?.node;
  const price = p.priceRange.minVariantPrice;

  return (
    <Link to={`/product/${p.handle}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
        {img ? (
          <img
            src={img.url}
            alt={img.altText ?? p.title}
            loading={priority ? "eager" : "lazy"}
            className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            Kein Bild
          </div>
        )}
      </div>
      <div className="mt-4 space-y-1">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{p.vendor}</p>
        <h3 className="font-display text-lg leading-tight">{p.title}</h3>
        <p className="text-sm text-foreground/80">{formatPrice(price.amount, price.currencyCode)}</p>
      </div>
    </Link>
  );
};
