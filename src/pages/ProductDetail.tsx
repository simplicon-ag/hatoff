import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Loader2, Minus, Plus, Heart, Share2 } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductDescription } from "@/components/ProductDescription";
import { TrustBadges } from "@/components/TrustBadges";
import { ProductCard } from "@/components/ProductCard";
import { AiStyleGenerator } from "@/components/AiStyleGenerator";
import { SizeAdvisorTrigger } from "@/components/SizeAdvisor";
import {
  fetchProductByHandle,
  fetchProducts,
  formatPrice,
  type ShopifyProduct,
} from "@/lib/shopify";
import { useLivePrice, formatLivePrice } from "@/hooks/useLivePrice";
import { useCartStore } from "@/stores/cartStore";
import { looks } from "@/data/looks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Variant {
  id: string;
  title: string;
  price: { amount: string; currencyCode: string };
  compareAtPrice?: { amount: string; currencyCode: string } | null;
  availableForSale: boolean;
  selectedOptions: Array<{ name: string; value: string }>;
  image?: { url: string; altText: string | null } | null;
}

interface Product {
  id: string;
  title: string;
  description: string;
  handle: string;
  vendor: string;
  productType: string;
  tags: string[];
  images: { edges: Array<{ node: { url: string; altText: string | null } }> };
  variants: { edges: Array<{ node: Variant }> };
  options: Array<{ name: string; values: string[] }>;
  badges?: { value: string; type: string } | null;
}

/** Find an image index that best matches the chosen variant — uses variant.image.url first, then altText/colour-name fallback. */
function findVariantImageIndex(
  images: Array<{ url: string; altText: string | null }>,
  variant: Variant | undefined,
): number | null {
  if (!variant) return null;
  if (variant.image?.url) {
    const idx = images.findIndex((i) => i.url === variant.image!.url);
    if (idx >= 0) return idx;
  }
  // Fallback: match by colour name in altText
  const colour = variant.selectedOptions.find((o) => o.name === "Farbe" || o.name === "Color")?.value;
  if (colour) {
    const idx = images.findIndex((i) => (i.altText ?? "").toLowerCase().includes(colour.toLowerCase()));
    if (idx >= 0) return idx;
  }
  return null;
}

function shopifySizedImage(url: string, width: number) {
  try {
    const sized = new URL(url);
    sized.searchParams.set("width", String(width));
    return sized.toString();
  } catch {
    return url;
  }
}

const ProductDetail = () => {
  const { handle } = useParams<{ handle: string }>();
  const [searchParams] = useSearchParams();
  const colorParam = searchParams.get("farbe");
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [related, setRelated] = useState<ShopifyProduct[]>([]);
  const [siblings, setSiblings] = useState<ShopifyProduct[]>([]);
  const addItem = useCartStore((s) => s.addItem);
  const isLoading = useCartStore((s) => s.isLoading);
  const { price: livePrice } = useLivePrice(handle);

  useEffect(() => {
    if (!handle) return;
    setLoading(true);
    setQuantity(1);
    window.scrollTo({ top: 0, behavior: "instant" });
    fetchProductByHandle(handle)
      .then((p: Product | null) => {
        setProduct(p);
        // Wenn ?farbe= in URL → erste verfügbare Variante dieser Farbe vorwählen
        let initial: Variant | undefined;
        if (colorParam && p) {
          initial = p.variants.edges
            .map((e) => e.node)
            .find(
              (v) =>
                v.availableForSale &&
                v.selectedOptions.some(
                  (o) =>
                    (o.name === "Farbe" || o.name === "Color") &&
                    o.value === colorParam,
                ),
            );
        }
        if (!initial) {
          initial = p?.variants.edges.find((e) => e.node.availableForSale)?.node;
        }
        setSelectedVariantId(initial?.id ?? p?.variants.edges[0]?.node.id ?? null);

        if (p?.vendor) {
          fetchProducts(8, `vendor:"${p.vendor}"`).then((items) => {
            setRelated(items.filter((i) => i.node.handle !== p.handle).slice(0, 4));
          });
        }

        // Cross-Linking: andere Produkte mit demselben Artikel-Tag (z.B. art:993106500)
        const articleTag = p?.tags?.find((t) => /^art:/i.test(t));
        if (articleTag) {
          fetchProducts(10, `tag:"${articleTag}"`).then((items) => {
            setSiblings(items.filter((i) => i.node.handle !== p.handle));
          });
        } else {
          setSiblings([]);
        }
      })
      .finally(() => setLoading(false));
  }, [handle, colorParam]);

  const selectedVariant = useMemo(
    () => product?.variants.edges.find((e) => e.node.id === selectedVariantId)?.node,
    [product, selectedVariantId],
  );

  // Eindeutige Farben (erste Variant pro Farbe → repräsentatives Bild)
  // Für Farbswatches bevorzugen wir das Kragen-Detailbild derselben Farbe
  // (bei Casa Moda typischerweise `...-image-3-...`) statt des Varianten-Ganzbilds.
  const colorOptions = useMemo(() => {
    if (!product) return [] as Array<{ value: string; variantId: string; image: string | null; available: boolean }>;
    const galleryImgs = product.images.edges.map((e) => e.node);

    const detailImageFor = (variantImageUrl: string | null | undefined): string | null => {
      if (!variantImageUrl) return galleryImgs[2]?.url ?? null;
      const prefix = variantImageUrl.match(/\/([^/?]+-image-)\d+-/)?.[1];
      if (prefix) {
        const sameColorCollar = galleryImgs.find((g) => g.url.includes(`/${prefix}3-`));
        if (sameColorCollar) return sameColorCollar.url;
        const sameColorDetail = galleryImgs.find((g) => g.url.includes(`/${prefix}4-`));
        if (sameColorDetail) return sameColorDetail.url;
      }
      return galleryImgs[2]?.url ?? variantImageUrl;
    };

    const seen = new Map<string, { value: string; variantId: string; image: string | null; available: boolean }>();
    for (const { node: v } of product.variants.edges) {
      const value = v.selectedOptions.find((o) => o.name === "Farbe" || o.name === "Color")?.value;
      if (!value) continue;
      const existing = seen.get(value);
      if (!existing) {
        seen.set(value, {
          value,
          variantId: v.id,
          image: detailImageFor(v.image?.url),
          available: v.availableForSale,
        });
      } else if (!existing.available && v.availableForSale) {
        // upgrade to available variant if previous was sold out
        seen.set(value, {
          ...existing,
          variantId: v.id,
          image: detailImageFor(v.image?.url) ?? existing.image,
          available: true,
        });
      }
    }
    return Array.from(seen.values());
  }, [product]);

  // Bild-Index in der Galerie für die aktuelle Variante
  const variantImageIndex = useMemo(() => {
    if (!product || !selectedVariant) return null;
    const imgs = product.images.edges.map((e) => e.node);
    return findVariantImageIndex(imgs, selectedVariant);
  }, [product, selectedVariant]);

  const relatedLooks = useMemo(() => {
    if (!product) return [];
    return looks.filter((l) => l.productHandles.includes(product.handle));
  }, [product]);

  // Sale wird nur angezeigt, wenn das Produkt den Shopify-Tag `sale` trägt
  // UND die gewählte Variante einen `compareAtPrice` > `price` hat.
  const hasSaleTag = useMemo(
    () => (product?.tags ?? []).some((t) => t.toLowerCase() === "sale"),
    [product?.tags],
  );

  const variantOnSale = useMemo(() => {
    if (!hasSaleTag) return false;
    if (!selectedVariant?.compareAtPrice) return false;
    const price = parseFloat(selectedVariant.price.amount);
    const compare = parseFloat(selectedVariant.compareAtPrice.amount);
    return isFinite(compare) && compare > price;
  }, [hasSaleTag, selectedVariant]);

  const variantDiscount = useMemo(() => {
    if (!variantOnSale || !selectedVariant?.compareAtPrice) return null;
    const price = parseFloat(selectedVariant.price.amount);
    const compare = parseFloat(selectedVariant.compareAtPrice.amount);
    return Math.round(((compare - price) / compare) * 100);
  }, [variantOnSale, selectedVariant]);

  const isNewArrival = useMemo(() => {
    if (!product) return false;
    return product.tags?.some((t) => /^(neu|new|neuheit)$/i.test(t.replace(/^[a-z]+:/i, "")));
  }, [product]);

  const handleAdd = async () => {
    if (!product || !selectedVariant) return;
    await addItem({
      productHandle: product.handle,
      productTitle: product.title,
      productImage: product.images.edges[0]?.node.url ?? null,
      variantId: selectedVariant.id,
      variantTitle: selectedVariant.title,
      price: selectedVariant.price,
      quantity,
      selectedOptions: selectedVariant.selectedOptions,
    });
    toast.success("Zum Warenkorb hinzugefügt", {
      description: `${product.title} · ${quantity}×`,
      position: "top-right",
    });
  };

  const handleShare = async () => {
    if (navigator.share && product) {
      try {
        await navigator.share({ title: product.title, url: window.location.href });
      } catch { /* ignored */ }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link kopiert", { position: "top-right" });
    }
  };

  if (loading) {
    return (
      <SiteLayout>
        <div className="container-editorial py-32 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </SiteLayout>
    );
  }

  if (!product) {
    return (
      <SiteLayout>
        <div className="container-editorial py-32 text-center">
          <h1 className="font-display text-3xl">Produkt nicht gefunden</h1>
          <Link to="/shop" className="mt-4 inline-block text-primary hover:underline">Zurück zum Shop</Link>
        </div>
      </SiteLayout>
    );
  }

  const images = product.images.edges.map((e) => e.node);
  const available = selectedVariant?.availableForSale ?? false;

  return (
    <SiteLayout>
      {/* Breadcrumb */}
      <div className="container-editorial pt-6 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        <Link to="/shop" className="hover:text-foreground">Shop</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground/70">{product.vendor}</span>
      </div>

      <section className="container-editorial grid gap-10 py-8 md:grid-cols-[1.1fr_1fr] md:gap-16 md:py-12">
        <ProductGallery images={images} title={product.title} activeIndex={variantImageIndex ?? undefined} />

        <div className="flex flex-col">
          {/* Top row: Badges aus Shopify-Metafield (custom.badges), Artikel-Nr. rechts */}
          {(() => {
            // Metafield kann list.single_line_text (JSON-Array) oder single_line_text (kommagetrennt) sein
            let badges: string[] = [];
            const raw = product.badges?.value?.trim();
            if (raw) {
              try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                  badges = parsed.map((s) => String(s).trim()).filter(Boolean);
                } else if (typeof parsed === "string") {
                  badges = parsed.split(",").map((s) => s.trim()).filter(Boolean);
                }
              } catch {
                // Kein JSON → als kommagetrennte Liste interpretieren
                badges = raw.split(",").map((s) => s.trim()).filter(Boolean);
              }
            }
            const artTag = (product.tags ?? []).find((t) => /^art:/i.test(t));
            const artNr = artTag ? artTag.replace(/^art:/i, "").trim() : product.id.split("/").pop();
            return (
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  {badges.map((t) => (
                    <span
                      key={t}
                      className="bg-secondary px-3 py-1 text-xs font-medium text-foreground/80"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <p className="whitespace-nowrap text-xs text-muted-foreground">
                    Artikel-Nr. {artNr}
                  </p>
                  <button
                    onClick={handleShare}
                    className="flex h-8 w-8 items-center justify-center border border-border text-foreground/70 hover:border-primary hover:text-primary"
                    aria-label="Teilen"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => toast("In Wunschliste gespeichert", { position: "top-right" })}
                    className="flex h-8 w-8 items-center justify-center border border-border text-foreground/70 hover:border-primary hover:text-primary"
                    aria-label="Zur Wunschliste"
                  >
                    <Heart className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Status-Label (NEU / Sale) als kleiner Text */}
          <div className="mt-5 flex items-center gap-2">
            {variantOnSale ? (
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-destructive">Sale</p>
            ) : isNewArrival ? (
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground">Neu</p>
            ) : (
              <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">{product.vendor}</p>
            )}
          </div>

          {/* Titel */}
          <h1 className="mt-2 font-display text-4xl leading-tight md:text-5xl">{product.title}</h1>

          {/* Preisblock */}
          {selectedVariant && (
            <div className="mt-4">
              <div className="flex flex-wrap items-baseline gap-3">
                {variantOnSale ? (
                  <>
                    <p className="text-2xl font-medium text-destructive">
                      {formatPrice(selectedVariant.price.amount, selectedVariant.price.currencyCode)}
                    </p>
                    <p className="text-base text-foreground/50 line-through">
                      {formatPrice(selectedVariant.compareAtPrice!.amount, selectedVariant.compareAtPrice!.currencyCode)}
                    </p>
                    {variantDiscount && (
                      <span className="rounded bg-destructive px-2 py-0.5 text-xs font-semibold text-destructive-foreground">
                        -{variantDiscount}%
                      </span>
                    )}
                  </>
                ) : (
                  <p className="text-2xl font-medium">
                    {formatLivePrice(livePrice) ??
                      formatPrice(selectedVariant.price.amount, selectedVariant.price.currencyCode)}
                  </p>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">inkl. MwSt., zzgl. Versand</p>
            </div>
          )}

          {/* Stock indicator */}
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span
              className={cn(
                "inline-block h-2 w-2 rounded-full",
                available ? "bg-success" : "bg-destructive",
              )}
            />
            <span className={available ? "text-foreground/80" : "text-destructive"}>
              {available ? "Verfügbar — Versand in 3–5 Tagen" : "Aktuell ausverkauft"}
            </span>
          </div>

          {/* Options */}
          {product.options.map((opt) => {
            // Skip default "Title" option that exists when product has no real variants
            if (opt.name === "Title" && opt.values.length === 1 && opt.values[0] === "Default Title") return null;

            const isColor = opt.name === "Farbe" || opt.name === "Color";
            const currentValue = selectedVariant?.selectedOptions.find((o) => o.name === opt.name)?.value;

            return (
              <div key={opt.name} className="mt-7">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {opt.name}
                    {isColor && currentValue && (
                      <span className="ml-2 font-normal text-muted-foreground">: {currentValue}</span>
                    )}
                  </p>
                  {!isColor ? (
                    <SizeAdvisorTrigger brand={product.vendor as never} label="Größenberater" />
                  ) : null}
                </div>

                {isColor ? (
                  // Bild-Swatches für Farben
                  <div className="mt-3 flex flex-wrap gap-2">
                    {colorOptions.map((c) => {
                      const active = c.value === currentValue;
                      return (
                        <button
                          key={c.value}
                          onClick={() => {
                            // Beim Farbwechsel die zuvor gewählte Grösse beibehalten, falls verfügbar
                            const currentSize = selectedVariant?.selectedOptions.find((o) => o.name === "Grösse" || o.name === "Size")?.value;
                            if (currentSize) {
                              const match = product.variants.edges.find(({ node: v }) => {
                                const col = v.selectedOptions.find((o) => o.name === "Farbe" || o.name === "Color")?.value;
                                const sz = v.selectedOptions.find((o) => o.name === "Grösse" || o.name === "Size")?.value;
                                return col === c.value && sz === currentSize;
                              });
                              if (match) {
                                setSelectedVariantId(match.node.id);
                                return;
                              }
                            }
                            setSelectedVariantId(c.variantId);
                          }}
                          disabled={!c.available}
                          title={c.value}
                          aria-label={c.value}
                          className={cn(
                            "relative h-14 w-14 overflow-hidden border bg-white transition sm:h-16 sm:w-16",
                            active ? "border-primary ring-1 ring-primary/30" : "border-border/70 hover:border-foreground/40",
                            !c.available && "opacity-40",
                          )}
                        >
                          {c.image ? (
                            <img
                              src={shopifySizedImage(c.image, 240)}
                              alt={c.value}
                              loading="eager"
                              className="h-full w-full object-cover mix-blend-multiply"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-[9px] uppercase tracking-wider text-muted-foreground">
                              {c.value.slice(0, 4)}
                            </span>
                          )}
                          {!c.available && (
                            <span className="absolute inset-0 flex items-center justify-center bg-background/40 text-[9px] font-semibold uppercase tracking-wider text-foreground">
                              ✕
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  // Text-Buttons für Grösse / sonstige Optionen
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(() => {
                      // Eindeutige Werte basierend auf Varianten, die zur aktuell gewählten Farbe passen
                      const colourValue = currentValue && isColor ? currentValue : selectedVariant?.selectedOptions.find((o) => o.name === "Farbe" || o.name === "Color")?.value;
                      const seen = new Map<string, { variantId: string; available: boolean }>();
                      for (const { node: v } of product.variants.edges) {
                        const value = v.selectedOptions.find((o) => o.name === opt.name)?.value;
                        if (!value) continue;
                        // Wenn es eine Farbe gibt, nur Varianten dieser Farbe für die Grössen-Buttons
                        if (colourValue) {
                          const vColor = v.selectedOptions.find((o) => o.name === "Farbe" || o.name === "Color")?.value;
                          if (vColor && vColor !== colourValue) continue;
                        }
                        const existing = seen.get(value);
                        if (!existing || (!existing.available && v.availableForSale)) {
                          seen.set(value, { variantId: v.id, available: v.availableForSale });
                        }
                      }
                      return Array.from(seen.entries()).map(([value, info]) => {
                        const active = value === currentValue;
                        return (
                          <button
                            key={value}
                            onClick={() => setSelectedVariantId(info.variantId)}
                            disabled={!info.available}
                            className={cn(
                              "min-w-12 border px-4 py-2 text-sm transition",
                              active
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background hover:border-primary",
                              !info.available && "line-through opacity-40",
                            )}
                          >
                            {value}
                          </button>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            );
          })}

          {/* Cross-Linking: dasselbe Modell als Sale/Neu */}
          {siblings.length > 0 && (
            <div className="mt-7 border border-border bg-secondary/40 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Auch erhältlich als
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {siblings.map((s) => {
                  const isSale = s.node.tags?.some((t) => /sale/i.test(t.replace(/^[a-z]+:/i, "")));
                  const isNew = s.node.tags?.some((t) => /^(neu|new|neuheit)$/i.test(t.replace(/^[a-z]+:/i, "")));
                  const label = isSale ? "Im Sale" : isNew ? "Als Neuheit" : s.node.title;
                  return (
                    <Link
                      key={s.node.handle}
                      to={`/product/${s.node.handle}`}
                      className="inline-flex items-center gap-2 border border-border bg-background px-3 py-1.5 text-xs font-medium hover:border-primary"
                    >
                      <span className={cn(
                        "px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                        isSale ? "bg-destructive text-destructive-foreground" : "bg-foreground text-background",
                      )}>
                        {isSale ? "Sale" : "Neu"}
                      </span>
                      → {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="mt-7">
            <p className="text-sm font-medium">Menge</p>
            <div className="mt-3 inline-flex items-center border border-border">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="flex h-10 w-10 items-center justify-center hover:bg-secondary"
                aria-label="Menge verringern"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-12 text-center text-sm">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="flex h-10 w-10 items-center justify-center hover:bg-secondary"
                aria-label="Menge erhöhen"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <Button
            onClick={handleAdd}
            disabled={isLoading || !available}
            size="lg"
            className="mt-8 w-full"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : available ? "In den Warenkorb" : "Ausverkauft"}
          </Button>

          <div className="mt-8">
            <TrustBadges />
          </div>

          {/* Description & Details */}
          <Accordion type="multiple" defaultValue={["desc"]} className="mt-8">
            <AccordionItem value="desc">
              <AccordionTrigger className="py-5 font-display text-base">Beschreibung</AccordionTrigger>
              <AccordionContent className="pb-6 pt-2">
                <ProductDescription description={product.description} />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="details">
              <AccordionTrigger className="py-5 font-display text-base">Details & Pflege</AccordionTrigger>
              <AccordionContent className="pb-6 pt-2">
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[120px_1fr]">
                  <dt className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Marke</dt>
                  <dd className="text-sm text-foreground/85">{product.vendor}</dd>
                  {product.productType && (
                    <>
                      <dt className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Kategorie</dt>
                      <dd className="text-sm text-foreground/85">{product.productType}</dd>
                    </>
                  )}
                </dl>
                {product.tags?.length > 0 && (
                  <div className="mt-5 border-t border-border pt-5">
                    <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {product.tags.map((t) => (
                        <span
                          key={t}
                          className="inline-flex bg-secondary px-2.5 py-1 text-xs text-foreground/75"
                        >
                          {t.replace(/^[a-z]+:/i, "")}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="ship">
              <AccordionTrigger className="py-5 font-display text-base">Versand & Rückgabe</AccordionTrigger>
              <AccordionContent className="pb-6 pt-2">
                <ul className="space-y-2.5 text-[15px] leading-relaxed text-foreground/85">
                  <li className="flex gap-3"><span className="text-primary">·</span> Versand innerhalb der Schweiz in 3–5 Werktagen.</li>
                  <li className="flex gap-3"><span className="text-primary">·</span> Kostenloser Versand ab CHF 200.</li>
                  <li className="flex gap-3"><span className="text-primary">·</span> 30 Tage Rückgaberecht — unkomplizierte Retoure.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Sticky mobile CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{product.vendor}</p>
            {selectedVariant && (
              <p className="flex items-baseline gap-2 text-sm font-medium">
                <span className={variantOnSale ? "text-destructive" : ""}>
                  {variantOnSale
                    ? formatPrice(selectedVariant.price.amount, selectedVariant.price.currencyCode)
                    : formatLivePrice(livePrice) ??
                      formatPrice(selectedVariant.price.amount, selectedVariant.price.currencyCode)}
                </span>
                {variantOnSale && selectedVariant.compareAtPrice && (
                  <span className="text-xs text-foreground/50 line-through">
                    {formatPrice(selectedVariant.compareAtPrice.amount, selectedVariant.compareAtPrice.currencyCode)}
                  </span>
                )}
              </p>
            )}
          </div>
          <Button onClick={handleAdd} disabled={isLoading || !available} size="lg" className="px-6">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : available ? "Hinzufügen" : "Ausverkauft"}
          </Button>
        </div>
      </div>
      {/* Spacer for mobile sticky bar */}
      <div className="h-20 md:hidden" />

      {/* AI Style Generator — nur für stilfähige Hauptstücke */}
      {(() => {
        const hay = `${product.productType ?? ""} ${(product.tags ?? []).join(" ")} ${product.title}`.toLowerCase();
        const isStyleable = /(hemd|polo|t-?shirt|shirt|pullover|pulli|sweater|strick|sakko|blazer|jacke|mantel|hose|chino|jeans|bermuda|short|kleid|anzug)/.test(hay);
        return isStyleable ? (
          <AiStyleGenerator productHandle={product.handle} productTitle={product.title} />
        ) : null;
      })()}

      {/* Related — same vendor */}
      {related.length > 0 && (
        <section className="container-editorial border-t border-border py-16">
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Mehr von</p>
          <h2 className="mt-2 font-display text-3xl">{product.vendor}</h2>
          <div className="mt-8 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((r) => <ProductCard key={r.node.id} product={r} />)}
          </div>
        </section>
      )}

      {relatedLooks.length > 0 && (
        <section className="container-editorial border-t border-border py-16">
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Passt besonders gut zu</p>
          <h2 className="mt-2 font-display text-3xl">In diesen Looks getragen</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {relatedLooks.map((l) => (
              <Link key={l.slug} to={`/looks/${l.slug}`} className="group block">
                <div className="aspect-[4/5] overflow-hidden bg-secondary">
                  <img src={l.hero} alt={l.title} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                </div>
                <h3 className="mt-3 font-display text-xl group-hover:text-primary">{l.title}</h3>
              </Link>
            ))}
          </div>
        </section>
      )}
    </SiteLayout>
  );
};

export default ProductDetail;
