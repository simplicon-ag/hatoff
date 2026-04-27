import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, ShoppingBag, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  fetchProductByHandle,
  formatPrice,
  type ShopifyProduct,
} from "@/lib/shopify";
import { useCartStore } from "@/stores/cartStore";
import { useLivePrice, formatLivePrice } from "@/hooks/useLivePrice";
import { WishlistButton } from "./WishlistButton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  product: ShopifyProduct["node"];
}

interface VariantNode {
  id: string;
  title: string;
  price: { amount: string; currencyCode: string };
  availableForSale: boolean;
  selectedOptions: Array<{ name: string; value: string }>;
  image?: { url: string; altText: string | null } | null;
}

interface FullProduct {
  id: string;
  title: string;
  description: string;
  handle: string;
  vendor: string;
  productType: string;
  images: { edges: Array<{ node: { url: string; altText: string | null } }> };
  variants: { edges: Array<{ node: VariantNode }> };
  options: Array<{ name: string; values: string[] }>;
}

export const QuickViewDialog = ({ open, onClose, product }: Props) => {
  const [full, setFull] = useState<FullProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [variantId, setVariantId] = useState<string | null>(null);
  const addItem = useCartStore((s) => s.addItem);
  const isLoading = useCartStore((s) => s.isLoading);
  const { price: livePrice } = useLivePrice(product.handle);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setFull(null);
    setVariantId(null);
    fetchProductByHandle(product.handle)
      .then((p) => {
        if (!p) return;
        setFull(p as FullProduct);
        const first = p.variants.edges.find((e) => e.node.availableForSale)?.node;
        setVariantId(first?.id ?? p.variants.edges[0]?.node.id ?? null);
      })
      .finally(() => setLoading(false));
  }, [open, product.handle]);

  const variant = useMemo(
    () => full?.variants.edges.find((e) => e.node.id === variantId)?.node,
    [full, variantId],
  );

  const colorOption = full?.options.find((o) => /farbe|color/i.test(o.name));
  const sizeOption = full?.options.find((o) => /gr(ö|oe|o)sse|size/i.test(o.name));

  const currentColor = variant?.selectedOptions.find((o) =>
    /farbe|color/i.test(o.name),
  )?.value;

  const sizesForColor = useMemo(() => {
    if (!full) return [] as Array<{ value: string; variantId: string; available: boolean }>;
    const seen = new Map<string, { variantId: string; available: boolean }>();
    for (const { node: v } of full.variants.edges) {
      const sz = v.selectedOptions.find((o) =>
        /gr(ö|oe|o)sse|size/i.test(o.name),
      )?.value;
      if (!sz) continue;
      if (currentColor) {
        const c = v.selectedOptions.find((o) => /farbe|color/i.test(o.name))?.value;
        if (c && c !== currentColor) continue;
      }
      const ex = seen.get(sz);
      if (!ex || (!ex.available && v.availableForSale)) {
        seen.set(sz, { variantId: v.id, available: v.availableForSale });
      }
    }
    return Array.from(seen.entries()).map(([value, info]) => ({ value, ...info }));
  }, [full, currentColor]);

  const colors = useMemo(() => {
    if (!full) return [] as Array<{ value: string; variantId: string; available: boolean; image: string | null }>;
    const seen = new Map<string, { variantId: string; available: boolean; image: string | null }>();
    for (const { node: v } of full.variants.edges) {
      const c = v.selectedOptions.find((o) => /farbe|color/i.test(o.name))?.value;
      if (!c) continue;
      const ex = seen.get(c);
      if (!ex) {
        seen.set(c, { variantId: v.id, available: v.availableForSale, image: v.image?.url ?? null });
      } else if (!ex.available && v.availableForSale) {
        seen.set(c, { variantId: v.id, available: true, image: v.image?.url ?? ex.image });
      }
    }
    return Array.from(seen.entries()).map(([value, info]) => ({ value, ...info }));
  }, [full]);

  const heroImage =
    variant?.image?.url ?? full?.images.edges[0]?.node.url ?? product.images.edges[0]?.node.url ?? null;

  const handleAdd = async () => {
    if (!full || !variant) return;
    await addItem({
      productHandle: full.handle,
      productTitle: full.title,
      productImage: heroImage,
      variantId: variant.id,
      variantTitle: variant.title,
      price: variant.price,
      quantity: 1,
      selectedOptions: variant.selectedOptions,
    });
    toast.success("Zum Warenkorb hinzugefügt", { description: full.title, position: "top-right" });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl gap-0 p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{product.title}</DialogTitle>
        </DialogHeader>
        <div className="grid md:grid-cols-2">
          <div className="relative aspect-[4/5] bg-secondary md:aspect-auto">
            {heroImage ? (
              <img src={heroImage} alt={product.title} className="absolute inset-0 h-full w-full object-contain p-6 mix-blend-multiply" />
            ) : null}
          </div>
          <div className="flex max-h-[80vh] flex-col overflow-y-auto p-6 md:p-8">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{product.vendor}</p>
                <h2 className="mt-1 font-display text-2xl leading-tight">{product.title}</h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Schliessen"
                className="-m-1 p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {variant && (
              <p className="mt-3 text-xl font-medium">
                {formatLivePrice(livePrice) ??
                  formatPrice(variant.price.amount, variant.price.currencyCode)}
              </p>
            )}

            {loading && (
              <div className="flex flex-1 items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {full && colorOption && colors.length > 1 && (
              <div className="mt-5">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Farbe</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {colors.map((c) => {
                    const active = c.value === currentColor;
                    return (
                      <button
                        key={c.value}
                        onClick={() => setVariantId(c.variantId)}
                        disabled={!c.available}
                        title={c.value}
                        className={cn(
                          "h-10 w-10 overflow-hidden border bg-secondary",
                          active ? "border-primary ring-1 ring-primary/30" : "border-border/70 hover:border-foreground/40",
                          !c.available && "opacity-40",
                        )}
                      >
                        {c.image ? (
                          <img src={c.image} alt={c.value} className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-[9px] uppercase">{c.value.slice(0, 3)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {full && sizeOption && sizesForColor.length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Grösse</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {sizesForColor.map((s) => {
                    const active = variant?.id === s.variantId ||
                      variant?.selectedOptions.some((o) => /gr(ö|oe|o)sse|size/i.test(o.name) && o.value === s.value);
                    return (
                      <button
                        key={s.value}
                        onClick={() => setVariantId(s.variantId)}
                        disabled={!s.available}
                        className={cn(
                          "min-w-12 border px-3 py-1.5 text-sm transition",
                          active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary",
                          !s.available && "line-through opacity-40",
                        )}
                      >
                        {s.value}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-auto pt-6 space-y-3">
              <Button
                onClick={handleAdd}
                disabled={isLoading || !variant?.availableForSale}
                size="lg"
                className="w-full"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <>
                    <ShoppingBag className="h-4 w-4" />
                    {variant?.availableForSale ? "In den Warenkorb" : "Ausverkauft"}
                  </>
                )}
              </Button>
              <div className="flex items-center justify-between gap-3">
                <Link
                  to={`/product/${product.handle}`}
                  onClick={onClose}
                  className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
                >
                  Alle Details ansehen →
                </Link>
                <WishlistButton
                  productHandle={product.handle}
                  productTitle={product.title}
                  productImage={heroImage}
                  vendor={product.vendor}
                  priceAmount={variant ? parseFloat(variant.price.amount) : null}
                  priceCurrency={variant?.price.currencyCode ?? null}
                  size="sm"
                />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
