import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductCard } from "@/components/ProductCard";
import { fetchAllProducts, expandProductsByColor, type ShopifyProduct } from "@/lib/shopify";
import { searchProducts } from "@/lib/product-search";
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
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SlidersHorizontal, X, Search } from "lucide-react";

type SortKey = "featured" | "price-asc" | "price-desc" | "title-asc" | "newest";

const titleCase = (s: string) =>
  s
    .split(/[-_\s]+/)
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w.toUpperCase()))
    .join(" ");

const tagValue = (tag: string, prefix: string) =>
  tag.toLowerCase().startsWith(prefix.toLowerCase() + ":")
    ? tag.slice(prefix.length + 1).trim()
    : null;

const Shop = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("featured");
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedWelten, setSelectedWelten] = useState<Set<string>>(new Set());
  
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());
  const [selectedSizes, setSelectedSizes] = useState<Set<string>>(new Set());
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    fetchAllProducts()
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  // URL → State (z. B. nach Klick aus globaler Suche)
  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    const marke = searchParams.get("marke");
    const welt = searchParams.get("welt");
    setSearch((prev) => (prev === q ? prev : q));
    if (marke) setSelectedVendors(new Set([marke]));
    if (welt) setSelectedWelten(new Set([welt]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // State → URL: Suche persistent in der Adresszeile halten (debounced)
  useEffect(() => {
    const handle = setTimeout(() => {
      const current = searchParams.get("q") ?? "";
      const next = search.trim();
      if (current === next) return;
      const params = new URLSearchParams(searchParams);
      if (next) params.set("q", next);
      else params.delete("q");
      setSearchParams(params, { replace: true });
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Compute derived facets from product data
  const facets = useMemo(() => {
    const vendors = new Map<string, number>();
    const categories = new Map<string, number>();
    const welten = new Map<string, number>();
    
    const colors = new Map<string, number>();
    const sizes = new Map<string, number>();
    let priceMin = Infinity;
    let priceMax = 0;

    products.forEach((p) => {
      const n = p.node;
      const v = n.vendor || "Sonstige";
      vendors.set(v, (vendors.get(v) ?? 0) + 1);

      if (n.productType) {
        categories.set(n.productType, (categories.get(n.productType) ?? 0) + 1);
      }

      n.tags.forEach((t) => {
        const w = tagValue(t, "welt");
        if (w) welten.set(w, (welten.get(w) ?? 0) + 1);
        const c = tagValue(t, "farbe");
        if (c) colors.set(c, (colors.get(c) ?? 0) + 1);
      });

      // Sizes from variant option "Grösse"/"Größe"/"Size"
      n.variants.edges.forEach((vt) => {
        vt.node.selectedOptions.forEach((o) => {
          if (/gr(ö|oe|o)sse|size/i.test(o.name)) {
            sizes.set(o.value, (sizes.get(o.value) ?? 0) + 1);
          }
        });
      });

      const price = parseFloat(n.priceRange.minVariantPrice.amount);
      if (!Number.isNaN(price)) {
        priceMin = Math.min(priceMin, price);
        priceMax = Math.max(priceMax, price);
      }
    });

    if (priceMin === Infinity) priceMin = 0;

    const sortNum = (a: string, b: string) => {
      const na = parseFloat(a);
      const nb = parseFloat(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    };

    return {
      vendors: Array.from(vendors.entries()).sort(([a], [b]) => a.localeCompare(b)),
      categories: Array.from(categories.entries()).sort(([a], [b]) => a.localeCompare(b)),
      welten: Array.from(welten.entries()).sort(([a], [b]) => a.localeCompare(b)),
      
      colors: Array.from(colors.entries()).sort(([a], [b]) => a.localeCompare(b)),
      sizes: Array.from(sizes.entries()).sort(([a], [b]) => sortNum(a, b)),
      priceMin: Math.floor(priceMin),
      priceMax: Math.ceil(priceMax),
    };
  }, [products]);

  // Initialise price range once after products loaded
  useEffect(() => {
    if (priceRange === null && products.length > 0 && facets.priceMax > 0) {
      setPriceRange([facets.priceMin, facets.priceMax]);
    }
  }, [products, facets.priceMin, facets.priceMax, priceRange]);

  const filtered = useMemo(() => {
    let list = products;

    if (search.trim()) {
      // Zentrale Suchlogik: durchsucht Titel, Marke, Typ, Tags (inkl. art:),
      // Variantenoptionen, Beschreibung (plain + HTML) und Artikelnummern.
      list = searchProducts(list, search);
    }

    if (selectedVendors.size > 0) {
      list = list.filter((p) => selectedVendors.has(p.node.vendor || "Sonstige"));
    }
    if (selectedCategories.size > 0) {
      list = list.filter((p) => selectedCategories.has(p.node.productType));
    }
    if (selectedWelten.size > 0) {
      list = list.filter((p) =>
        p.node.tags.some((t) => {
          const v = tagValue(t, "welt");
          return v ? selectedWelten.has(v) : false;
        }),
      );
    }
    if (selectedColors.size > 0) {
      list = list.filter((p) =>
        p.node.tags.some((t) => {
          const v = tagValue(t, "farbe");
          return v ? selectedColors.has(v) : false;
        }),
      );
    }
    if (selectedSizes.size > 0) {
      list = list.filter((p) =>
        p.node.variants.edges.some((vt) =>
          vt.node.selectedOptions.some(
            (o) => /gr(ö|oe|o)sse|size/i.test(o.name) && selectedSizes.has(o.value),
          ),
        ),
      );
    }
    if (priceRange) {
      list = list.filter((p) => {
        const price = parseFloat(p.node.priceRange.minVariantPrice.amount);
        return price >= priceRange[0] && price <= priceRange[1];
      });
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
    } else if (sort === "newest") {
      // Shopify gid IDs sind monoton steigend → höchste ID = neuestes Produkt
      sorted.sort((a, b) => b.node.id.localeCompare(a.node.id));
    }
    return sorted;
  }, [
    products,
    search,
    selectedVendors,
    selectedCategories,
    selectedWelten,
    
    selectedColors,
    selectedSizes,
    priceRange,
    onlyAvailable,
    sort,
  ]);

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void) => (value: string) => {
    const next = new Set(set);
    next.has(value) ? next.delete(value) : next.add(value);
    setter(next);
  };

  const clearFilters = () => {
    setSelectedVendors(new Set());
    setSelectedCategories(new Set());
    setSelectedWelten(new Set());
    
    setSelectedColors(new Set());
    setSelectedSizes(new Set());
    setPriceRange([facets.priceMin, facets.priceMax]);
    setOnlyAvailable(false);
    setSearch("");
  };

  const activeCount =
    selectedVendors.size +
    selectedCategories.size +
    selectedWelten.size +
    
    selectedColors.size +
    selectedSizes.size +
    (onlyAvailable ? 1 : 0) +
    (priceRange &&
    (priceRange[0] !== facets.priceMin || priceRange[1] !== facets.priceMax)
      ? 1
      : 0) +
    (search.trim() ? 1 : 0);

  const FacetGroup = ({
    title,
    items,
    selected,
    onToggle,
    capitalize = false,
    columns = 1,
  }: {
    title: string;
    items: Array<[string, number]>;
    selected: Set<string>;
    onToggle: (v: string) => void;
    capitalize?: boolean;
    columns?: 1 | 2;
  }) => {
    if (items.length === 0) return null;
    return (
      <AccordionItem value={title} className="border-border">
        <AccordionTrigger className="text-xs font-medium uppercase tracking-[0.2em] text-foreground hover:no-underline">
          {title}
          {Array.from(selected).length > 0 && (
            <span className="ml-auto mr-2 rounded-full bg-foreground px-2 text-[10px] text-background">
              {selected.size}
            </span>
          )}
        </AccordionTrigger>
        <AccordionContent>
          <div className={columns === 2 ? "grid grid-cols-2 gap-y-2" : "space-y-2"}>
            {items.map(([v, count]) => (
              <label key={v} className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2">
                  <Checkbox checked={selected.has(v)} onCheckedChange={() => onToggle(v)} />
                  <span>{capitalize ? titleCase(v) : v}</span>
                </span>
                <span className="text-xs text-muted-foreground">{count}</span>
              </label>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  };

  const FilterPanel = () => (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Verfügbarkeit
        </p>
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <Checkbox
            checked={onlyAvailable}
            onCheckedChange={(c) => setOnlyAvailable(!!c)}
          />
          Nur verfügbare Artikel
        </label>
      </div>

      {priceRange && facets.priceMax > facets.priceMin && (
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Preis
          </p>
          <Slider
            min={facets.priceMin}
            max={facets.priceMax}
            step={5}
            value={priceRange}
            onValueChange={(v) => setPriceRange([v[0], v[1]] as [number, number])}
            className="mt-3"
          />
          <div className="mt-3 flex justify-between text-xs text-muted-foreground">
            <span>CHF {priceRange[0]}</span>
            <span>CHF {priceRange[1]}</span>
          </div>
        </div>
      )}

      <Accordion
        type="multiple"
        defaultValue={["Marke", "Kategorie", "Welt"]}
        className="w-full"
      >
        <FacetGroup
          title="Marke"
          items={facets.vendors}
          selected={selectedVendors}
          onToggle={toggle(selectedVendors, setSelectedVendors)}
        />
        <FacetGroup
          title="Kategorie"
          items={facets.categories}
          selected={selectedCategories}
          onToggle={toggle(selectedCategories, setSelectedCategories)}
        />
        <FacetGroup
          title="Welt"
          items={facets.welten}
          selected={selectedWelten}
          onToggle={toggle(selectedWelten, setSelectedWelten)}
          capitalize
        />
        <FacetGroup
          title="Farbe"
          items={facets.colors}
          selected={selectedColors}
          onToggle={toggle(selectedColors, setSelectedColors)}
          capitalize
        />
        <FacetGroup
          title="Grösse"
          items={facets.sizes}
          selected={selectedSizes}
          onToggle={toggle(selectedSizes, setSelectedSizes)}
          columns={2}
        />
      </Accordion>

      {activeCount > 0 && (
        <Button variant="outline" size="sm" onClick={clearFilters} className="w-full">
          <X className="h-3.5 w-3.5" /> Alle Filter zurücksetzen
        </Button>
      )}
    </div>
  );

  return (
    <SiteLayout>
      <section className="container-editorial pt-16 md:pt-24">
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Shop</p>
        <h1 className="mt-2 max-w-2xl font-display text-5xl leading-[1.05] md:text-6xl">
          Einzelne Stücke.
        </h1>
      </section>

      <section className="container-editorial py-12">
        {/* Toolbar */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-y border-border py-4">
          <div className="flex flex-1 items-center gap-3">
            {/* Mobile filter trigger */}
            <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filter{" "}
                  {activeCount > 0 && (
                    <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                      {activeCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filter</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <FilterPanel />
                </div>
              </SheetContent>
            </Sheet>

            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Suche…"
                className="h-9 pl-9 text-sm"
              />
            </div>

            <p className="hidden text-xs text-muted-foreground sm:block">
              {loading ? "—" : `${filtered.length} ${filtered.length === 1 ? "Artikel" : "Artikel"}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden text-xs uppercase tracking-[0.18em] text-muted-foreground sm:inline">
              Sortieren
            </span>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-9 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="featured">Empfohlen</SelectItem>
                <SelectItem value="newest">Neueste zuerst</SelectItem>
                <SelectItem value="price-asc">Preis aufsteigend</SelectItem>
                <SelectItem value="price-desc">Preis absteigend</SelectItem>
                <SelectItem value="title-asc">A – Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[260px_1fr]">
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
                {expandProductsByColor(filtered).map((p, i) => (
                  <ProductCard
                    key={`${p.node.id}-${p.initialColor ?? "default"}`}
                    product={p}
                    initialColor={p.initialColor}
                    priority={i < 6}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
};

export default Shop;
