import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { fetchProductByHandle, formatPrice } from "@/lib/shopify";
import { useCartStore } from "@/stores/cartStore";
import { looks } from "@/data/looks";

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
  images: { edges: Array<{ node: { url: string; altText: string | null } }> };
  variants: { edges: Array<{ node: Variant }> };
  options: Array<{ name: string; values: string[] }>;
}

const ProductDetail = () => {
  const { handle } = useParams<{ handle: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const addItem = useCartStore((s) => s.addItem);
  const isLoading = useCartStore((s) => s.isLoading);

  useEffect(() => {
    if (!handle) return;
    setLoading(true);
    fetchProductByHandle(handle)
      .then((p) => {
        setProduct(p);
        const firstAvailable = p?.variants.edges.find((e: { node: Variant }) => e.node.availableForSale)?.node;
        setSelectedVariantId(firstAvailable?.id ?? p?.variants.edges[0]?.node.id ?? null);
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
      quantity: 1,
      selectedOptions: selectedVariant.selectedOptions,
    });
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

  const img = product.images.edges[0]?.node;

  return (
    <SiteLayout>
      <section className="container-editorial grid gap-10 py-12 md:grid-cols-2 md:gap-16 md:py-16">
        <div className="aspect-[4/5] overflow-hidden bg-secondary">
          {img && <img src={img.url} alt={img.altText ?? product.title} className="h-full w-full object-cover" />}
        </div>

        <div className="flex flex-col">
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">{product.vendor}</p>
          <h1 className="mt-2 font-display text-4xl md:text-5xl">{product.title}</h1>
          {selectedVariant && (
            <p className="mt-4 text-xl">{formatPrice(selectedVariant.price.amount, selectedVariant.price.currencyCode)}</p>
          )}

          <p className="mt-6 leading-relaxed text-foreground/85">{product.description}</p>

          {product.options.map((opt) => (
            <div key={opt.name} className="mt-8">
              <p className="text-sm font-medium">{opt.name}</p>
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
                      className={`min-w-12 border px-4 py-2 text-sm transition ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:border-primary"
                      } ${!v.availableForSale ? "opacity-40" : ""}`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <Button onClick={handleAdd} disabled={isLoading || !selectedVariant?.availableForSale} size="lg" className="mt-10 w-full md:w-auto">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "In den Warenkorb"}
          </Button>
        </div>
      </section>

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
