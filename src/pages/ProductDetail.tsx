import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, Minus, Plus, Heart, Share2 } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ProductGallery } from "@/components/ProductGallery";
import { TrustBadges } from "@/components/TrustBadges";
import { ProductCard } from "@/components/ProductCard";
import {
  fetchProductByHandle,
  fetchProducts,
  formatPrice,
  type ShopifyProduct,
} from "@/lib/shopify";
import { useCartStore } from "@/stores/cartStore";
import { looks } from "@/data/looks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Variant {
  id: string;
  title: string;
  price: { amount: string; currencyCode: string };
  availableForSale: boolean;
  selectedOptions: Array<{ name: string; value: string }>;
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
}

const ProductDetail = () => {
  const { handle } = useParams<{ handle: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [related, setRelated] = useState<ShopifyProduct[]>([]);
  const addItem = useCartStore((s) => s.addItem);
  const isLoading = useCartStore((s) => s.isLoading);

  useEffect(() => {
    if (!handle) return;
    setLoading(true);
    setQuantity(1);
    window.scrollTo({ top: 0, behavior: "instant" });
    fetchProductByHandle(handle)
      .then((p: Product | null) => {
        setProduct(p);
        const firstAvailable = p?.variants.edges.find((e) => e.node.availableForSale)?.node;
        setSelectedVariantId(firstAvailable?.id ?? p?.variants.edges[0]?.node.id ?? null);

        if (p?.vendor) {
          fetchProducts(8, `vendor:"${p.vendor}"`).then((items) => {
            setRelated(items.filter((i) => i.node.handle !== p.handle).slice(0, 4));
          });
        }
      })
      .finally(() => setLoading(false));
  }, [handle]);

  const selectedVariant = useMemo(
    () => product?.variants.edges.find((e) => e.node.id === selectedVariantId)?.node,
    [product, selectedVariantId],
  );

  const relatedLooks = useMemo(() => {
    if (!product) return [];
    return looks.filter((l) => l.productHandles.includes(product.handle));
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
        <ProductGallery images={images} title={product.title} />

        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">{product.vendor}</p>
              <h1 className="mt-2 font-display text-4xl leading-tight md:text-5xl">{product.title}</h1>
            </div>
            <div className="flex gap-1">
              <button
                onClick={handleShare}
                className="flex h-10 w-10 items-center justify-center border border-border text-foreground/70 hover:border-primary hover:text-primary"
                aria-label="Teilen"
              >
                <Share2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => toast("In Wunschliste gespeichert", { position: "top-right" })}
                className="flex h-10 w-10 items-center justify-center border border-border text-foreground/70 hover:border-primary hover:text-primary"
                aria-label="Zur Wunschliste"
              >
                <Heart className="h-4 w-4" />
              </button>
            </div>
          </div>

          {selectedVariant && (
            <div className="mt-5 flex items-baseline gap-3">
              <p className="text-2xl font-medium">
                {formatPrice(selectedVariant.price.amount, selectedVariant.price.currencyCode)}
              </p>
              <span className="text-xs text-muted-foreground">inkl. MwSt., zzgl. Versand</span>
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
            return (
              <div key={opt.name} className="mt-7">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{opt.name}</p>
                  {selectedVariant && (
                    <p className="text-xs text-muted-foreground">
                      Gewählt: {selectedVariant.selectedOptions.find((o) => o.name === opt.name)?.value}
                    </p>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.variants.edges.map(({ node: v }) => {
                    const value = v.selectedOptions.find((o) => o.name === opt.name)?.value;
                    if (!value) return null;
                    const active = v.id === selectedVariantId;
                    return (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariantId(v.id)}
                        disabled={!v.availableForSale}
                        className={cn(
                          "min-w-12 border px-4 py-2 text-sm transition",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:border-primary",
                          !v.availableForSale && "line-through opacity-40",
                        )}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

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
              <AccordionTrigger>Beschreibung</AccordionTrigger>
              <AccordionContent>
                <p className="whitespace-pre-line leading-relaxed text-foreground/85">
                  {product.description || "Keine Beschreibung vorhanden."}
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="details">
              <AccordionTrigger>Details & Pflege</AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-1 text-sm text-foreground/80">
                  <li><span className="text-muted-foreground">Marke:</span> {product.vendor}</li>
                  {product.productType && <li><span className="text-muted-foreground">Kategorie:</span> {product.productType}</li>}
                  {product.tags?.length > 0 && (
                    <li><span className="text-muted-foreground">Tags:</span> {product.tags.join(", ")}</li>
                  )}
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="ship">
              <AccordionTrigger>Versand & Rückgabe</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-foreground/80">
                  <p>Versand innerhalb der Schweiz in 3–5 Werktagen.</p>
                  <p>Kostenloser Versand ab CHF 200.</p>
                  <p>30 Tage Rückgaberecht — unkomplizierte Retoure.</p>
                </div>
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
              <p className="text-sm font-medium">
                {formatPrice(selectedVariant.price.amount, selectedVariant.price.currencyCode)}
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
