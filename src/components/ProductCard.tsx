import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Loader2, ShoppingBag } from "lucide-react";
import type { ShopifyProduct } from "@/lib/shopify";
import { formatPrice } from "@/lib/shopify";
import { useLivePrice, formatLivePrice } from "@/hooks/useLivePrice";
import { useCartStore } from "@/stores/cartStore";
import { WishlistButton } from "./WishlistButton";
import { QuickViewDialog } from "./QuickViewDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  product: ShopifyProduct;
  priority?: boolean;
  /**
   * Wenn gesetzt, rendert die Karte das Produkt fokussiert auf diese Farbe:
   * Bild, Titel-Suffix und Quick-Add-Variant beziehen sich auf diese Farbe.
   * Wird genutzt, um Mehrfarb-Produkte als mehrere Karten in der Liste darzustellen.
   */
  initialColor?: string;
}

export const ProductCard = ({ product, priority, initialColor }: Props) => {
  const p = product.node;
  const price = p.priceRange.minVariantPrice;
  const { price: livePrice } = useLivePrice(p.handle);
  const displayPrice = formatLivePrice(livePrice) ?? formatPrice(price.amount, price.currencyCode);

  // Sale-Logik: nur wenn das Produkt explizit den Tag `sale` trägt UND ein
  // compareAtPrice an der ersten Variante hinterlegt ist. Damit pflegst du
  // Sales ausschliesslich über den Shopify-Tag (Set/Unset = Sale an/aus).
  const hasSaleTag = useMemo(
    () => (p.tags ?? []).some((t) => t.toLowerCase() === "sale"),
    [p.tags],
  );
  const variantSale = useMemo(() => {
    if (!hasSaleTag) return null;
    const variant = p.variants.edges
      .map((e) => e.node)
      .find((v) => {
        const cmp = v.compareAtPrice?.amount;
        if (!cmp) return false;
        return parseFloat(cmp) > parseFloat(v.price.amount);
      });
    if (!variant?.compareAtPrice) return null;
    const compare = parseFloat(variant.compareAtPrice.amount);
    const current = parseFloat(variant.price.amount);
    return {
      original: formatPrice(variant.compareAtPrice.amount, variant.compareAtPrice.currencyCode),
      discount: Math.round(((compare - current) / compare) * 100),
    };
  }, [hasSaleTag, p.variants.edges]);
  const onSale = !!variantSale;
  const originalPrice = variantSale?.original;
  const discount = variantSale?.discount;

  // Neuheit: Tag `neu` / `new` / `neuheit` (case-insensitive, ignoriert Präfixe wie `art:`)
  const isNew = useMemo(
    () =>
      (p.tags ?? []).some((t) =>
        /^(neu|new|neuheit)$/i.test(t.replace(/^[a-z]+:/i, "")),
      ),
    [p.tags],
  );

  const colorOption = p.options.find((o) => /farbe|color|colour/i.test(o.name));

  // Alle Varianten dieser Farbe (oder alle Varianten, wenn keine Farbfokussierung)
  const variantsForColor = useMemo(() => {
    if (!initialColor) return p.variants.edges.map((e) => e.node);
    return p.variants.edges
      .map((e) => e.node)
      .filter((v) =>
        v.selectedOptions.some(
          (o) => /farbe|color|colour/i.test(o.name) && o.value === initialColor,
        ),
      );
  }, [p.variants.edges, initialColor]);

  // Bild für die ausgewählte Farbe: erst Variant-Bild, sonst Galerie-Fallback
  const colorImage = useMemo(() => {
    if (!initialColor) return null;
    const withImg = variantsForColor.find((v) => v.image?.url);
    return withImg?.image ?? null;
  }, [initialColor, variantsForColor]);

  const images = p.images.edges;
  const primary = colorImage ?? images[0]?.node ?? null;
  const secondary = colorImage ? null : images[1]?.node ?? null;

  const firstAvailable =
    variantsForColor.find((v) => v.availableForSale) ??
    p.variants.edges.find((e) => e.node.availableForSale)?.node;
  const soldOut = !firstAvailable;

  // Anzahl unterschiedlicher Grössen für diese Farbe → bestimmt, ob noch Auswahl nötig
  const sizeCountForColor = useMemo(() => {
    const sizes = new Set<string>();
    variantsForColor.forEach((v) => {
      v.selectedOptions.forEach((o) => {
        if (/gr(ö|oe|o)sse|size/i.test(o.name)) sizes.add(o.value);
      });
    });
    return sizes.size;
  }, [variantsForColor]);

  const addItem = useCartStore((s) => s.addItem);
  const isLoading = useCartStore((s) => s.isLoading);
  const [adding, setAdding] = useState(false);

  const detailHref = initialColor
    ? `/product/${p.handle}?farbe=${encodeURIComponent(initialColor)}`
    : `/product/${p.handle}`;

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!firstAvailable) return;
    // Wenn noch eine Grösse gewählt werden muss → zur Detailseite
    const needsChoice = initialColor
      ? sizeCountForColor > 1
      : p.variants.edges.length > 1;
    if (needsChoice) {
      window.location.href = detailHref;
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

  // "+N Farben" nur anzeigen, wenn KEINE Farb-Expansion (initialColor) aktiv ist
  const colorCount = colorOption?.values.length ?? 0;
  const showColorHint = !initialColor && colorCount > 1;

  return (
    <Link to={detailHref} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden">
        {primary ? (
          <>
            <img
              src={primary.url}
              alt={primary.altText ?? p.title}
              loading={priority ? "eager" : "lazy"}
              className={cn(
                "absolute inset-0 h-full w-full object-contain p-4 mix-blend-multiply transition-opacity duration-500",
                secondary ? "group-hover:opacity-0" : "",
              )}
            />
            {secondary && (
              <img
                src={secondary.url}
                alt={secondary.altText ?? p.title}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-contain p-4 mix-blend-multiply opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              />
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

        {!soldOut && !onSale && isNew && (
          <span className="absolute left-3 top-3 bg-foreground px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-background">
            Neu
          </span>
        )}

        {!soldOut && onSale && discount && (
          <span className="absolute left-3 top-3 bg-destructive px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-destructive-foreground">
            -{discount}%
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
            {(initialColor ? sizeCountForColor > 1 : p.variants.edges.length > 1)
              ? "Optionen wählen"
              : "In den Warenkorb"}
          </button>
        )}
      </div>
      <div className="mt-4 space-y-1">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{p.vendor}</p>
        <h3 className="font-display text-lg leading-tight">
          {p.title}
          {initialColor && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              · {initialColor}
            </span>
          )}
        </h3>
        {onSale ? (
          <p className="flex items-baseline gap-2 text-sm">
            <span className="font-medium text-destructive">{displayPrice}</span>
            <span className="text-foreground/50 line-through">{originalPrice}</span>
          </p>
        ) : (
          <p className="text-sm text-foreground/80">{displayPrice}</p>
        )}
        {showColorHint && (
          <p className="pt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            +{colorCount} {colorCount === 2 ? "Farbe" : "Farben"}
          </p>
        )}
      </div>
    </Link>
  );
};
