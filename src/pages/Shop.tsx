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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SlidersHorizontal, X, Search, ChevronDown, LayoutGrid, Grid2X2 } from "lucide-react";
import { cn } from "@/lib/utils";

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

const isNewProduct = (p: ShopifyProduct) => {
  const tags = p.node.tags ?? [];
  const isNew = tags.some((t) => /^(neu|new|neuheit)$/i.test(t.replace(/^[a-z]+:/i, "")));
  const isSale = tags.some((t) => t.toLowerCase() === "sale");
  return isNew && !isSale;
};

const isSaleProduct = (p: ShopifyProduct) => {
  const hasSaleTag = (p.node.tags ?? []).some((t) => t.toLowerCase() === "sale");
  if (!hasSaleTag) return false;
  return p.node.variants.edges.some((v) => {
    const cmp = v.node.compareAtPrice?.amount ? parseFloat(v.node.compareAtPrice.amount) : 0;
    const price = parseFloat(v.node.price.amount);
    return cmp > price;
  });
};

const STATUS_LABELS: Record<string, string> = { neu: "Neu", sale: "Sale" };

const FilterChip = ({ label, onRemove }: { label: string; onRemove: () => void }) => (
  <button
    type="button"
    onClick={onRemove}
    className="inline-flex items-center gap-1.5 border border-border bg-secondary/60 px-2.5 py-1 text-xs text-foreground/85 transition hover:border-foreground hover:bg-secondary"
  >
    <span>{label}</span>
    <X className="h-3 w-3" />
  </button>
);

// Modul-Level Cache-Spiegel, damit beim Re-Mount sofort gerendert werden kann
let cachedProducts: ShopifyProduct[] | null = null;

const Shop = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<ShopifyProduct[]>(() => cachedProducts ?? []);
  const [loading, setLoading] = useState(() => cachedProducts === null);
  const [sort, setSort] = useState<SortKey>("featured");
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedWelten, setSelectedWelten] = useState<Set<string>>(new Set());
  const [selectedStatus, setSelectedStatus] = useState<Set<string>>(new Set());
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());
  const [selectedSizes, setSelectedSizes] = useState<Set<string>>(new Set());
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [density, setDensity] = useState<3 | 4>(4);

  useEffect(() => {
    if (cachedProducts) return;
    fetchAllProducts()
      .then((p) => {
        cachedProducts = p;
        setProducts(p);
      })
      .finally(() => setLoading(false));
  }, []);

  // Scroll-Position pro Shop-URL persistieren, damit man beim Zurück-Navigieren
  // nicht wieder oben landet.
  const scrollKey = `shop-scroll:${searchParams.toString()}`;
  useEffect(() => {
    if (loading) return;
    const saved = sessionStorage.getItem(scrollKey);
    if (saved) {
      const y = parseInt(saved, 10);
      if (!Number.isNaN(y)) {
        // Nach Render-Frame, damit das Grid bereits Höhe hat
        requestAnimationFrame(() => window.scrollTo(0, y));
      }
    }
    const onScroll = () => {
      sessionStorage.setItem(scrollKey, String(window.scrollY));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, scrollKey]);


  // URL → State (z. B. nach Klick aus globaler Suche)
  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    const marke = searchParams.get("marke");
    const welt = searchParams.get("welt");
    const status = searchParams.get("status");
    setSearch((prev) => (prev === q ? prev : q));
    if (marke) setSelectedVendors(new Set([marke]));
    if (welt) setSelectedWelten(new Set([welt]));
    if (status) setSelectedStatus(new Set(status.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)));
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
    const status = new Map<string, number>();
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

      if (isNewProduct(p)) status.set("neu", (status.get("neu") ?? 0) + 1);
      if (isSaleProduct(p)) status.set("sale", (status.get("sale") ?? 0) + 1);
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
      status: (["neu", "sale"] as const)
        .filter((k) => (status.get(k) ?? 0) > 0)
        .map((k) => [k, status.get(k) ?? 0] as [string, number]),
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
    if (selectedStatus.size > 0) {
      list = list.filter((p) => {
        if (selectedStatus.has("neu") && isNewProduct(p)) return true;
        if (selectedStatus.has("sale") && isSaleProduct(p)) return true;
        return false;
      });
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
    selectedStatus,
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
    setSelectedStatus(new Set());
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
    selectedStatus.size +
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

  /** Inline-Popover-Filter wie auf klassischen Shop-Toolbars (Farbe ▾, Grösse ▾, …). */
  const FacetPopover = ({
    label,
    items,
    selected,
    onToggle,
    capitalize = false,
    columns = 1,
  }: {
    label: string;
    items: Array<[string, number]>;
    selected: Set<string>;
    onToggle: (v: string) => void;
    capitalize?: boolean;
    columns?: 1 | 2;
  }) => {
    if (items.length === 0) return null;
    const count = selected.size;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-9 items-center gap-1.5 whitespace-nowrap px-3 text-sm transition",
              count > 0
                ? "text-foreground"
                : "text-foreground/75 hover:text-foreground",
            )}
          >
            <span>{label}</span>
            {count > 0 && (
              <span className="rounded-full bg-foreground px-1.5 text-[10px] font-medium text-background">
                {count}
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <div className="border-b border-border px-4 py-2.5 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {label}
          </div>
          <ScrollArea className="max-h-72">
            <div className={cn("p-3", columns === 2 ? "grid grid-cols-2 gap-y-2" : "space-y-2")}>
              {items.map(([v, c]) => (
                <label
                  key={v}
                  className="flex cursor-pointer items-center justify-between gap-3 px-1.5 py-1 text-sm hover:bg-muted/50"
                >
                  <span className="flex items-center gap-2">
                    <Checkbox checked={selected.has(v)} onCheckedChange={() => onToggle(v)} />
                    <span>{capitalize ? titleCase(v) : v}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{c}</span>
                </label>
              ))}
            </div>
          </ScrollArea>
          {count > 0 && (
            <div className="border-t border-border p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => Array.from(selected).forEach(onToggle)}
              >
                <X className="h-3.5 w-3.5" /> Auswahl zurücksetzen
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
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
        defaultValue={["Status", "Marke", "Kategorie", "Welt"]}
        className="w-full"
      >
        <FacetGroup
          title="Status"
          items={facets.status}
          selected={selectedStatus}
          onToggle={toggle(selectedStatus, setSelectedStatus)}
          capitalize
        />
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

      <section className="container-editorial py-10">
        {/* Kategorie-Pills (Produkttypen) */}
        {facets.categories.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategories(new Set())}
                className={cn(
                  "min-h-10 border px-4 py-2 text-sm transition",
                  selectedCategories.size === 0
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-foreground/80 hover:border-foreground",
                )}
              >
                Alle
              </button>
              {facets.categories.map(([cat, count]) => {
                const active = selectedCategories.has(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => {
                      const next = new Set(selectedCategories);
                      next.has(cat) ? next.delete(cat) : next.add(cat);
                      setSelectedCategories(next);
                    }}
                    className={cn(
                      "min-h-10 border px-4 py-2 text-sm transition",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-foreground/80 hover:border-foreground",
                    )}
                  >
                    {cat}
                    <span className="ml-1.5 text-xs opacity-60">{count}</span>
                  </button>
                );
              })}
          </div>
        )}

        {/* Horizontale Filter-Toolbar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
          <div className="flex flex-wrap items-center gap-1">
            <span className="hidden items-center gap-2 pr-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground md:inline-flex">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtern nach:
            </span>

            {/* Mobile: gesamtes Filter-Sheet */}
            <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="md:hidden">
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

            {/* Desktop: einzelne Popover-Filter */}
            <div className="hidden flex-wrap items-center md:flex">
              <FacetPopover
                label="Marke"
                items={facets.vendors}
                selected={selectedVendors}
                onToggle={toggle(selectedVendors, setSelectedVendors)}
              />
              <FacetPopover
                label="Farbe"
                items={facets.colors}
                selected={selectedColors}
                onToggle={toggle(selectedColors, setSelectedColors)}
                capitalize
              />
              <FacetPopover
                label="Grösse"
                items={facets.sizes}
                selected={selectedSizes}
                onToggle={toggle(selectedSizes, setSelectedSizes)}
                columns={2}
              />
              <FacetPopover
                label="Welt"
                items={facets.welten}
                selected={selectedWelten}
                onToggle={toggle(selectedWelten, setSelectedWelten)}
                capitalize
              />
              <FacetPopover
                label="Status"
                items={facets.status}
                selected={selectedStatus}
                onToggle={toggle(selectedStatus, setSelectedStatus)}
                capitalize
              />

              {/* Preis als eigener Popover */}
              {priceRange && facets.priceMax > facets.priceMin && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "inline-flex h-9 items-center gap-1.5 whitespace-nowrap px-3 text-sm transition",
                        priceRange[0] !== facets.priceMin || priceRange[1] !== facets.priceMax
                          ? "text-foreground"
                          : "text-foreground/75 hover:text-foreground",
                      )}
                    >
                      <span>Preis</span>
                      <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-72">
                    <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Preis
                    </p>
                    <Slider
                      min={facets.priceMin}
                      max={facets.priceMax}
                      step={5}
                      value={priceRange}
                      onValueChange={(v) => setPriceRange([v[0], v[1]] as [number, number])}
                    />
                    <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                      <span>CHF {priceRange[0]}</span>
                      <span>CHF {priceRange[1]}</span>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Suche */}
            <div className="relative hidden w-48 sm:block">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Suche…"
                className="h-9 pl-9 text-sm"
              />
            </div>

            {/* Density-Toggle (Desktop) */}
            <div className="hidden items-center border border-border lg:flex">
              <button
                type="button"
                aria-label="4 Spalten"
                onClick={() => setDensity(4)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center transition",
                  density === 4 ? "bg-foreground text-background" : "text-foreground/60 hover:text-foreground",
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="3 Spalten"
                onClick={() => setDensity(3)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center transition",
                  density === 3 ? "bg-foreground text-background" : "text-foreground/60 hover:text-foreground",
                )}
              >
                <Grid2X2 className="h-4 w-4" />
              </button>
            </div>

            {/* Sortieren */}
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-9 w-44 border-border">
                <SelectValue placeholder="Sortieren" />
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

        {/* Aktive Filter-Chips */}
        {activeCount > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {loading ? "—" : `${filtered.length} Artikel`}
            </span>
            {search.trim() && (
              <FilterChip label={`„${search.trim()}"`} onRemove={() => setSearch("")} />
            )}
            {Array.from(selectedVendors).map((v) => (
              <FilterChip key={`v-${v}`} label={v} onRemove={() => {
                const n = new Set(selectedVendors); n.delete(v); setSelectedVendors(n);
              }} />
            ))}
            {Array.from(selectedCategories).map((c) => (
              <FilterChip key={`c-${c}`} label={c} onRemove={() => {
                const n = new Set(selectedCategories); n.delete(c); setSelectedCategories(n);
              }} />
            ))}
            {Array.from(selectedWelten).map((w) => (
              <FilterChip key={`w-${w}`} label={titleCase(w)} onRemove={() => {
                const n = new Set(selectedWelten); n.delete(w); setSelectedWelten(n);
              }} />
            ))}
            {Array.from(selectedStatus).map((s) => (
              <FilterChip key={`st-${s}`} label={STATUS_LABELS[s] ?? titleCase(s)} onRemove={() => {
                const n = new Set(selectedStatus); n.delete(s); setSelectedStatus(n);
              }} />
            ))}
            {Array.from(selectedColors).map((c) => (
              <FilterChip key={`col-${c}`} label={titleCase(c)} onRemove={() => {
                const n = new Set(selectedColors); n.delete(c); setSelectedColors(n);
              }} />
            ))}
            {Array.from(selectedSizes).map((s) => (
              <FilterChip key={`s-${s}`} label={`Grösse ${s}`} onRemove={() => {
                const n = new Set(selectedSizes); n.delete(s); setSelectedSizes(n);
              }} />
            ))}
            {priceRange &&
              (priceRange[0] !== facets.priceMin || priceRange[1] !== facets.priceMax) && (
                <FilterChip
                  label={`CHF ${priceRange[0]}–${priceRange[1]}`}
                  onRemove={() => setPriceRange([facets.priceMin, facets.priceMax])}
                />
              )}
            {onlyAvailable && (
              <FilterChip label="Nur verfügbar" onRemove={() => setOnlyAvailable(false)} />
            )}
            <button
              onClick={clearFilters}
              className="ml-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
            >
              Alle zurücksetzen
            </button>
          </div>
        )}

        {/* Produktraster */}
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
          <div
            className={cn(
              "grid gap-x-4 gap-y-10 sm:grid-cols-2 md:grid-cols-3",
              density === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3",
            )}
          >
            {expandProductsByColor(filtered).map((p, i) => (
              <ProductCard
                key={`${p.node.id}-${p.initialColor ?? "default"}`}
                product={p}
                initialColor={p.initialColor}
                priority={i < 6}
                compactCart
              />
            ))}
          </div>
        )}
      </section>
    </SiteLayout>
  );
};

export default Shop;
