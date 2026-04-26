import { useEffect, useMemo, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductCard } from "@/components/ProductCard";
import { fetchAllProducts, expandProductsByColor, type ShopifyProduct } from "@/lib/shopify";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SortKey = "discount-desc" | "price-asc" | "price-desc" | "title-asc";

interface SaleEntry {
  handle: string;
  display_price_chf: number;
  original_price_chf: number;
}

const Sale = () => {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [saleMap, setSaleMap] = useState<Map<string, SaleEntry>>(new Map());
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("discount-desc");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: saleRows }, allProducts] = await Promise.all([
        supabase
          .from("product_price_cache")
          .select("handle, display_price_chf, original_price_chf")
          .eq("on_sale", true),
        fetchAllProducts(),
      ]);
      if (cancelled) return;

      const map = new Map<string, SaleEntry>();
      for (const r of saleRows ?? []) {
        if (r.original_price_chf == null) continue;
        map.set(r.handle, {
          handle: r.handle,
          display_price_chf: Number(r.display_price_chf),
          original_price_chf: Number(r.original_price_chf),
        });
      }
      setSaleMap(map);
      setProducts(allProducts);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSaleProducts = useMemo(() => {
    const list = products.filter((p) => saleMap.has(p.node.handle));

    const discount = (handle: string) => {
      const e = saleMap.get(handle);
      if (!e || !e.original_price_chf) return 0;
      return (e.original_price_chf - e.display_price_chf) / e.original_price_chf;
    };

    const sorted = [...list];
    if (sort === "discount-desc") {
      sorted.sort((a, b) => discount(b.node.handle) - discount(a.node.handle));
    } else if (sort === "price-asc") {
      sorted.sort(
        (a, b) =>
          (saleMap.get(a.node.handle)?.display_price_chf ?? 0) -
          (saleMap.get(b.node.handle)?.display_price_chf ?? 0),
      );
    } else if (sort === "price-desc") {
      sorted.sort(
        (a, b) =>
          (saleMap.get(b.node.handle)?.display_price_chf ?? 0) -
          (saleMap.get(a.node.handle)?.display_price_chf ?? 0),
      );
    } else if (sort === "title-asc") {
      sorted.sort((a, b) => a.node.title.localeCompare(b.node.title));
    }
    return sorted;
  }, [products, saleMap, sort]);

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
          Ausgewählte Stücke aus den aktuellen Aktionen unserer Marken — solange Vorrat reicht.
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
              Schau bald wieder vorbei — Sale-Preise werden täglich aktualisiert.
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
