import { useEffect, useMemo, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductCard } from "@/components/ProductCard";
import { fetchAllProducts, expandProductsByColor, type ShopifyProduct } from "@/lib/shopify";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SortKey = "discount-desc" | "price-asc" | "price-desc" | "title-asc";

/**
 * Berechnet den höchsten Rabatt (in Prozent, 0–1) eines Produkts auf Basis
 * von Shopify Variant-Preisen (`price` vs. `compareAtPrice`).
 * Liefert 0, wenn keine Variante reduziert ist.
 */
function maxVariantDiscount(p: ShopifyProduct): number {
  let max = 0;
  for (const e of p.node.variants.edges) {
    const v = e.node;
    const compare = v.compareAtPrice?.amount ? parseFloat(v.compareAtPrice.amount) : 0;
    const price = parseFloat(v.price.amount);
    if (compare > price && compare > 0) {
      const d = (compare - price) / compare;
      if (d > max) max = d;
    }
  }
  return max;
}

const Sale = () => {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("discount-desc");

  useEffect(() => {
    fetchAllProducts()
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  const onSaleProducts = useMemo(() => {
    // Sale-Produkte: müssen Tag `sale` tragen UND mind. eine reduzierte Variante haben.
    const list = products.filter((p) => {
      const hasSaleTag = (p.node.tags ?? []).some((t) => t.toLowerCase() === "sale");
      if (!hasSaleTag) return false;
      return maxVariantDiscount(p) > 0;
    });

    const sorted = [...list];
    if (sort === "discount-desc") {
      sorted.sort((a, b) => maxVariantDiscount(b) - maxVariantDiscount(a));
    } else if (sort === "price-asc") {
      sorted.sort(
        (a, b) =>
          parseFloat(a.node.priceRange.minVariantPrice.amount) -
          parseFloat(b.node.priceRange.minVariantPrice.amount),
      );
    } else if (sort === "price-desc") {
      sorted.sort(
        (a, b) =>
          parseFloat(b.node.priceRange.minVariantPrice.amount) -
          parseFloat(a.node.priceRange.minVariantPrice.amount),
      );
    } else if (sort === "title-asc") {
      sorted.sort((a, b) => a.node.title.localeCompare(b.node.title));
    }
    return sorted;
  }, [products, sort]);

  return (
    <SiteLayout>
      <section className="container-editorial pt-16 md:pt-24">
        <p className="text-[11px] uppercase tracking-[0.3em] text-destructive">
          Sale
        </p>
        <h1 className="mt-2 max-w-2xl font-display text-5xl leading-[1.05] md:text-6xl">
          Reduziert.
        </h1>
        <p className="mt-4 max-w-xl text-foreground/70">
          Ausgewählte Stücke aus den aktuellen Aktionen — solange Vorrat reicht.
        </p>
      </section>

      <section className="container-editorial py-12">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-y border-border py-4">
          <p className="text-xs text-muted-foreground">
            {loading
              ? "Aktionen werden geladen …"
              : `${onSaleProducts.length} ${onSaleProducts.length === 1 ? "Artikel" : "Artikel"} im Sale`}
          </p>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs uppercase tracking-[0.18em] text-muted-foreground sm:inline">
              Sortieren
            </span>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-9 w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="discount-desc">Höchster Rabatt</SelectItem>
                <SelectItem value="price-asc">Preis aufsteigend</SelectItem>
                <SelectItem value="price-desc">Preis absteigend</SelectItem>
                <SelectItem value="title-asc">A – Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <p className="py-16 text-center text-muted-foreground">
            Aktionen werden geladen …
          </p>
        ) : onSaleProducts.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-muted-foreground">
              Aktuell keine Aktionen verfügbar.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Schau bald wieder vorbei — neue Aktionen werden laufend ergänzt.
            </p>
          </div>
        ) : (
          <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {expandProductsByColor(onSaleProducts).map((p, i) => (
              <ProductCard
                key={`${p.node.id}-${p.initialColor ?? "default"}`}
                product={p}
                initialColor={p.initialColor}
                priority={i < 6}
              />
            ))}
          </div>
        )}
      </section>
    </SiteLayout>
  );
};

export default Sale;
