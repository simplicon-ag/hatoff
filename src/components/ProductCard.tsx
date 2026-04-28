import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, ShoppingBag } from "lucide-react";
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
  initialColor?: string;
  /** kompakter Modus: Cart-Button neben Preis statt Hover-Overlay (z.B. in Sidebars). */
  compactCart?: boolean;
}

/**
 * Produktkarte im PKZ-Stil:
 *  - ruhige helle Sand-Bildkachel (bg-secondary), Bild zentriert
 *  - kleines Wishlist-Heart oben rechts (immer sichtbar)
 *  - Status-Badges links unten (Neu / -XX% / Ausverkauft)
 *  - Hover: zweites Bild kreuzfaded
 *  - Unterhalb des Bildes: Marke (CAPS), Produkttitel, Preis
 */
export const ProductCard = ({ product, priority, initialColor, compactCart = false }: Props) => {
  const p = product.node;
  const price = p.priceRange.minVariantPrice;
  const shopifyAmount = parseFloat(price.amount);
  const { price: livePrice } = useLivePrice(
    p.handle,
    Number.isFinite(shopifyAmount) && shopifyAmount > 0 ? shopifyAmount : undefined,
  );
  const displayPrice = formatLivePrice(livePrice) ?? formatPrice(price.amount, price.currencyCode);

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

  const isNew = useMemo(
    () =>
      (p.tags ?? []).some((t) =>
        /^(neu|new|neuheit)$/i.test(t.replace(/^[a-z]+:/i, "")),
      ),
    [p.tags],
  );

  const colorOption = p.options.find((o) => /farbe|color|colour/i.test(o.name));

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

  const colorImage = useMemo(() => {
    if (!initialColor) return null;
    const withImg = variantsForColor.find((v) => v.image?.url);
    return withImg?.image ?? null;
  }, [initialColor, variantsForColor]);

  const images = p.images.edges;

  // Zweites Bild derselben Farbe finden (gleicher Casa-Moda-Prefix wie image-1).
  // Beispiel: 12165-148-image-1-... → suche 12165-148-image-2-...
  const colorSecondaryImage = useMemo(() => {
    if (!colorImage?.url) return null;
    const all = images.map((e) => e.node);
    const prefix = colorImage.url.match(/\/([^/?]+-image-)\d+-/)?.[1];
    if (prefix) {
      const second = all.find((g) => g.url.includes(`/${prefix}2-`));
      if (second && second.url !== colorImage.url) return second;
    }
    // Fallback: erstes anderes Bild der Farb-Varianten
    const variantUrls = new Set(
      variantsForColor.map((v) => v.image?.url).filter(Boolean) as string[],
    );
    const other = all.find((g) => variantUrls.has(g.url) && g.url !== colorImage.url);
    return other ?? null;
  }, [colorImage, images, variantsForColor]);

  // Heuristik: Rückseite / Detail-Aufnahmen aus dem Alt-Text erkennen und überspringen.
  // So landen Front-Aufnahmen zuverlässig als Hauptbild.
  const isBackOrDetail = (alt?: string | null) => {
    if (!alt) return false;
    return /(back|rück|hinten|reverse|detail|close[-\s]?up|sleeve|ärmel|aermel|button|kragen|collar|inside|innen)/i.test(
      alt,
    );
  };
  const isFront = (alt?: string | null) => {
    if (!alt) return false;
    return /(front|vorne|vorder)/i.test(alt);
  };

  const orderedImages = useMemo(() => {
    const list = images.map((e) => e.node);
    if (list.length <= 1) return list;
    // Erst explizite Front-Bilder, dann neutrale, dann Rück/Detail.
    return [...list].sort((a, b) => {
      const score = (img: typeof a) =>
        isFront(img.altText) ? 0 : isBackOrDetail(img.altText) ? 2 : 1;
      return score(a) - score(b);
    });
  }, [images]);

  const primary = colorImage ?? orderedImages[0] ?? null;
  const secondary = colorImage
    ? colorSecondaryImage
    : orderedImages[1] ?? null;

  // Farb-Indikator als kleine Punkte unter dem Bild (PKZ-Stil)
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

  const colorCount = colorSwatches.length;
  const showColorHint = !initialColor && colorCount > 1;

  const firstAvailable =
    variantsForColor.find((v) => v.availableForSale) ??
    p.variants.edges.find((e) => e.node.availableForSale)?.node;
  const soldOut = !firstAvailable;

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

  return (
    <>
      <Link to={detailHref} className="group block">
        {/* Bildkachel im hellen Sand-Ton */}
        <div className="relative aspect-[4/5] overflow-hidden bg-secondary/70">
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

          {/* Status-Badges oben links */}
          <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
            {soldOut && (
              <span className="bg-foreground/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-background">
                Ausverkauft
              </span>
            )}
            {!soldOut && isNew && !onSale && (
              <span className="bg-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-background">
                New
              </span>
            )}
            {!soldOut && onSale && discount && (
              <span className="bg-destructive px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-destructive-foreground">
                −{discount}%
              </span>
            )}
          </div>

          {/* Wishlist Heart oben rechts (immer sichtbar, dezent) */}
          <div className="absolute right-2 top-2">
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
          </div>
        </div>

        {/* Info-Block unter dem Bild */}
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-foreground">
              {p.vendor}
            </p>
            <h3 className="mt-1 truncate text-sm font-normal text-foreground/85">
              {p.title}
              {initialColor && (
                <span className="ml-1 text-foreground/50">· {initialColor}</span>
              )}
            </h3>
            <div className="mt-2 flex items-baseline gap-2">
              {onSale ? (
                <>
                  <span className="text-sm font-bold text-destructive">{displayPrice}</span>
                  <span className="text-xs text-foreground/45 line-through">{originalPrice}</span>
                </>
              ) : (
                <span className="text-sm font-bold text-foreground">{displayPrice}</span>
              )}
            </div>
            {showColorHint && (
              <div className="mt-2 flex items-center gap-1.5">
                {colorSwatches.slice(0, 5).map((s) => (
                  <span
                    key={s.value}
                    title={s.value}
                    className="h-3 w-3 overflow-hidden rounded-full border border-border bg-background"
                  >
                    {s.image && (
                      <img
                        src={s.image}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </span>
                ))}
                {colorCount > 5 && (
                  <span className="text-[10px] text-muted-foreground">+{colorCount - 5}</span>
                )}
              </div>
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
