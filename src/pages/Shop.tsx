import { useEffect, useMemo, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductCard } from "@/components/ProductCard";
import { fetchProducts, type ShopifyProduct } from "@/lib/shopify";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

type SortKey = "featured" | "price-asc" | "price-desc" | "title-asc";

const Shop = () => {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("featured");
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    fetchProducts(100)
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  const vendors = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => {
      const v = p.node.vendor || "Sonstige";
      map.set(v, (map.get(v) ?? 0) + 1);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [products]);

  const filtered = useMemo(() => {
    let list = products;
    if (selectedVendors.size > 0) {
      list = list.filter((p) => selectedVendors.has(p.node.vendor || "Sonstige"));
    }
    if (onlyAvailable) {
      list = list.filter((p) => p.node.variants.edges.some((v) => v.node.availableForSale));
    }
    const sorted = [...list];
    if (sort === "price-asc") {
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
  }, [products, selectedVendors, onlyAvailable, sort]);

  const toggleVendor = (v: string) => {
    setSelectedVendors((prev) => {
      const next = new Set(prev);
      next.has(v) ? next.delete(v) : next.add(v);
      return next;
    });
  };

  const clearFilters = () => {
    setSelectedVendors(new Set());
    setOnlyAvailable(false);
  };

  const activeCount = selectedVendors.size + (onlyAvailable ? 1 : 0);

  const FilterPanel = () => (
    <div className="space-y-8">
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Verfügbarkeit</p>
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <Checkbox checked={onlyAvailable} onCheckedChange={(c) => setOnlyAvailable(!!c)} />
          Nur verfügbare Artikel
        </label>
      </div>

      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Marke</p>
        <ScrollArea className="h-72 pr-3">
          <div className="space-y-2">
            {vendors.map(([v, count]) => (
              <label key={v} className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-3">
                  <Checkbox checked={selectedVendors.has(v)} onCheckedChange={() => toggleVendor(v)} />
                  {v}
                </span>
                <span className="text-xs text-muted-foreground">{count}</span>
              </label>
            ))}
          </div>
        </ScrollArea>
      </div>

      {activeCount > 0 && (
        <Button variant="outline" size="sm" onClick={clearFilters} className="w-full">
          <X className="h-3.5 w-3.5" /> Filter zurücksetzen
        </Button>
      )}
    </div>
  );

  return (
    <SiteLayout>
      <section className="container-editorial pt-16 md:pt-24">
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Shop</p>
        <h1 className="mt-2 max-w-2xl font-display text-5xl leading-[1.05] md:text-6xl">Einzelne Stücke.</h1>
      </section>

      <section className="container-editorial py-12">
        {/* Toolbar */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-y border-border py-4">
          <div className="flex items-center gap-3">
            {/* Mobile filter trigger */}
            <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filter {activeCount > 0 && <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{activeCount}</span>}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <SheetHeader>
                  <SheetTitle>Filter</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <FilterPanel />
                </div>
              </SheetContent>
            </Sheet>

            <p className="text-xs text-muted-foreground">
              {loading ? "—" : `${filtered.length} ${filtered.length === 1 ? "Artikel" : "Artikel"}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden text-xs uppercase tracking-[0.18em] text-muted-foreground sm:inline">Sortieren</span>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-9 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="featured">Empfohlen</SelectItem>
                <SelectItem value="price-asc">Preis aufsteigend</SelectItem>
                <SelectItem value="price-desc">Preis absteigend</SelectItem>
                <SelectItem value="title-asc">A – Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
          {/* Desktop filters */}
          <aside className="hidden lg:block">
            <FilterPanel />
          </aside>

          <div>
            {loading ? (
              <p className="py-16 text-center text-muted-foreground">Produkte werden geladen …</p>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-muted-foreground">Keine Produkte gefunden.</p>
                {activeCount > 0 && (
                  <Button variant="link" onClick={clearFilters} className="mt-2">
                    Filter zurücksetzen
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((p, i) => <ProductCard key={p.node.id} product={p} priority={i < 6} />)}
              </div>
            )}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
};

export default Shop;
