import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductCard } from "@/components/ProductCard";
import { fetchProducts, type ShopifyProduct } from "@/lib/shopify";

const Shop = () => {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts(50)
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  return (
    <SiteLayout>
      <section className="container-editorial pt-16 md:pt-24">
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Shop</p>
        <h1 className="mt-2 max-w-2xl font-display text-5xl leading-[1.05] md:text-6xl">Einzelne Stücke.</h1>
      </section>
      <section className="container-editorial py-16">
        {loading ? (
          <p className="py-16 text-center text-muted-foreground">Produkte werden geladen …</p>
        ) : products.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">No products found</p>
        ) : (
          <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => <ProductCard key={p.node.id} product={p} />)}
          </div>
        )}
      </section>
    </SiteLayout>
  );
};

export default Shop;
