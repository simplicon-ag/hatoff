import { useEffect, useState } from "react";
import { fetchProducts, type ShopifyProduct } from "@/lib/shopify";
import { ProductCard } from "@/components/ProductCard";

interface Props {
  productHandle: string;
  productType?: string;
  vendor?: string;
  tags?: string[];
  excludeHandles?: string[];
}

/**
 * Heuristische Empfehlungen basierend auf dem aktuellen Produkt.
 * Reihenfolge:
 *  1) Gleicher productType, andere Marke
 *  2) Stil-/Anlass-Tag-Match (stil:*, anlass:*, saison:*)
 *  3) Beliebte Neuheiten als Auffüller
 */
export const YouMightAlsoLike = ({
  productHandle,
  productType,
  vendor,
  tags = [],
  excludeHandles = [],
}: Props) => {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);

  useEffect(() => {
    let cancelled = false;
    const exclude = new Set([productHandle, ...excludeHandles]);
    const collected = new Map<string, ShopifyProduct>();

    const collect = (items: ShopifyProduct[]) => {
      for (const item of items) {
        if (exclude.has(item.node.handle)) continue;
        if (collected.has(item.node.handle)) continue;
        collected.set(item.node.handle, item);
        if (collected.size >= 4) break;
      }
    };

    (async () => {
      try {
        // 1) gleicher productType, andere Marke
        if (productType) {
          const safeType = productType.replace(/"/g, "");
          const safeVendor = vendor?.replace(/"/g, "");
          const q = safeVendor
            ? `product_type:"${safeType}" AND -vendor:"${safeVendor}"`
            : `product_type:"${safeType}"`;
          const items = await fetchProducts(8, q);
          collect(items);
        }

        // 2) Stil-/Anlass-/Saison-Tag-Match
        if (collected.size < 4) {
          const styleTag = tags.find((t) => /^(stil|anlass|saison):/i.test(t));
          if (styleTag) {
            const items = await fetchProducts(8, `tag:"${styleTag}"`);
            collect(items);
          }
        }

        // 3) Auffüllen mit Neuheiten
        if (collected.size < 4) {
          const items = await fetchProducts(8, `tag:neu`);
          collect(items);
        }

        // 4) Letzter Fallback: beliebige Produkte
        if (collected.size < 4) {
          const items = await fetchProducts(8);
          collect(items);
        }

        if (!cancelled) {
          setProducts(Array.from(collected.values()).slice(0, 4));
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productHandle, productType, vendor, tags, excludeHandles]);

  if (products.length === 0) return null;

  return (
    <section className="container-editorial border-t border-border py-16">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Empfehlung</p>
      <h2 className="mt-2 font-display text-3xl">Das könnte dir auch gefallen</h2>
      <div className="mt-8 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.node.id} product={p} />
        ))}
      </div>
    </section>
  );
};
