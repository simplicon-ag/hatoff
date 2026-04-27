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
  /** Wenn true, wird der Cart-Button nicht im Bild, sondern unten neben dem Preis dargestellt. */
  compactCart?: boolean;
}

export const ProductCard = ({ product, priority, initialColor, compactCart = false }: Props) => {
  const p = product.node;
  const price = p.priceRange.minVariantPrice;
  const shopifyAmount = parseFloat(price.amount);
  const { price: livePrice } = useLivePrice(
    p.handle,
    Number.isFinite(shopifyAmount) && shopifyAmount > 0 ? shopifyAmount : undefined,
  );
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

  // Farb-Swatches: pro Farbe ein Variantenbild (für die Bubbles unten links)
  const colorSwatches = useMemo(() => {
    if (!colorOption) return [] as Array<{ value: string; image: string | null }>;
    const seen = new Map<string, string | null>();
    for (const { node: v } of p.variants.edges) {
      const value = v.selectedOptions.find((o) => /farbe|color|colour/i.test(o.name))?.value;
      if (!value || seen.has(value)) continue;
      seen.set(value, v.image?.url ?? null);
    }
    return Array.from(seen.entries()).map(([value, image]) => ({ value, image }));
  }, [colorOption, p.variants.edges]);

  // Wenn die Karte auf eine Farbe fokussiert ist → keine Bubbles (Sub-Card)
  // Sonst: andere Farben als Bubbles darstellen
  const otherSwatches = useMemo(
    () => (initialColor ? [] : colorSwatches),
    [initialColor, colorSwatches],
  );

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
  const [quickOpen, setQuickOpen] = useState(false);

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
    <>
      <Link to={detailHref} className="group block">
        <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
          {primary ? (
            <>
              <img
                src={primary.url}
                alt={primary.altText ?? p.title}
                loading={priority ? "eager" : "lazy"}
                className={cn(
                  "absolute inset-0 h-full w-full object-contain mix-blend-multiply transition-opacity duration-500",
                  secondary ? "group-hover:opacity-0" : "",
                )}
              />
              {secondary && (
                <img
                  src={secondary.url}
                  alt={secondary.altText ?? p.title}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-contain mix-blend-multiply opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                />
              )}
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              Kein Bild
            </div>
          )}

          {soldOut && (
            <span className="absolute left-3 top-3 bg-foreground/90 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-background sm:text-[10px]">
              Ausverkauft
            </span>
          )}

          {!soldOut && !onSale && isNew && (
            <span className="absolute left-3 top-3 bg-foreground px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-background sm:text-[10px]">
              Neu
            </span>
          )}

          {!soldOut && onSale && discount && (
            <span className="absolute left-3 top-3 bg-destructive px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-destructive-foreground sm:text-[10px]">
              -{discount}%
            </span>
          )}

          {/* Top-right action stack: Wishlist immer sichtbar, Quick-View nur Desktop on hover */}
          <div className="absolute right-3 top-3 flex flex-col gap-2">
            <WishlistButton
              productHandle={p.handle}
              productTitle={p.title}
              productImage={primary?.url ?? null}
              vendor={p.vendor}
              priceAmount={parseFloat(price.amount)}
              priceCurrency={price.currencyCode}
              size="sm"
              stopNavigation
            />
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setQuickOpen(true);
              }}
              aria-label="Schnellansicht"
              className="hidden h-8 w-8 items-center justify-center border border-border bg-background/90 text-foreground/70 opacity-0 backdrop-blur transition hover:border-primary hover:text-primary group-hover:opacity-100 md:flex"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Farb-Swatches unten links: kleine runde Vorschauen anderer Farben */}
          {otherSwatches.length > 1 && (
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
              {otherSwatches.slice(0, 4).map((s) => (
                <span
                  key={s.value}
                  title={s.value}
                  className="h-6 w-6 overflow-hidden rounded-full border border-border bg-background shadow-sm"
                >
                  {s.image ? (
                    <img src={s.image} alt={s.value} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="block h-full w-full bg-muted" />
                  )}
                </span>
              ))}
              {otherSwatches.length > 4 && (
                <span className="ml-1 text-[10px] font-medium text-foreground/70">
                  +{otherSwatches.length - 4}
                </span>
              )}
            </div>
          )}

          {!soldOut && !compactCart && (
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
        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground sm:text-[11px]">{p.vendor}</p>
            <h3 className="font-display text-xl leading-tight sm:text-lg">
              {p.title}
              {initialColor && (
                <span className="ml-2 text-base font-normal text-muted-foreground sm:text-sm">
                  · {initialColor}
                </span>
              )}
            </h3>
            {onSale ? (
              <p className="flex items-baseline gap-2 text-base sm:text-sm">
                <span className="font-medium text-destructive">{displayPrice}</span>
                <span className="text-foreground/50 line-through">{originalPrice}</span>
              </p>
            ) : (
              <p className="text-base text-foreground/80 sm:text-sm">{displayPrice}</p>
            )}
            {showColorHint && !compactCart && (
              <p className="pt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground sm:text-[11px]">
                +{colorCount} {colorCount === 2 ? "Farbe" : "Farben"}
              </p>
            )}
          </div>
          {compactCart && !soldOut && (
            <button
              onClick={handleQuickAdd}
              disabled={adding || isLoading}
              aria-label="Zum Warenkorb hinzufügen"
              className="flex h-9 w-9 shrink-0 items-center justify-center border border-border text-foreground/80 transition hover:border-foreground hover:bg-foreground hover:text-background disabled:opacity-60"
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
            </button>
          )}
        </div>
      </Link>
      {quickOpen && (
        <QuickViewDialog open={quickOpen} onClose={() => setQuickOpen(false)} product={p} />
      )}
    </>
  );
};
