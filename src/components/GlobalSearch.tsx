import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2 } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { fetchAllProducts, formatPrice, type ShopifyProduct } from "@/lib/shopify";
import { supabase } from "@/integrations/supabase/client";

interface LookHit {
  slug: string;
  title: string;
  subtitle: string | null;
  hero_image_url: string | null;
}

const tagValue = (tag: string, prefix: string) =>
  tag.toLowerCase().startsWith(prefix.toLowerCase() + ":")
    ? tag.slice(prefix.length + 1).trim()
    : null;

export const GlobalSearch = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [looks, setLooks] = useState<LookHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const navigate = useNavigate();

  // Cmd/Ctrl+K to toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((s) => !s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Lazy-load data on first open
  useEffect(() => {
    if (!open || loaded) return;
    setLoading(true);
    Promise.all([
      fetchAllProducts().catch(() => [] as ShopifyProduct[]),
      supabase
        .from("curated_looks")
        .select("slug,title,subtitle,hero_image_url")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(100)
        .then(({ data }) => (data ?? []) as LookHit[]),
    ])
      .then(([p, l]) => {
        setProducts(p);
        setLooks(l);
        setLoaded(true);
      })
      .finally(() => setLoading(false));
  }, [open, loaded]);

  const q = query.trim().toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);

  const { productHits, lookHits, vendorHits, weltHits } = useMemo(() => {
    if (!q) {
      return {
        productHits: products.slice(0, 6),
        lookHits: looks.slice(0, 4),
        vendorHits: [] as string[],
        weltHits: [] as string[],
      };
    }

    // Score each product; only keep clearly relevant hits.
    const scoreProduct = (p: ShopifyProduct): number => {
      const title = p.node.title.toLowerCase();
      const titleWords = title.split(/[\s\-/]+/).filter(Boolean);
      const vendor = (p.node.vendor ?? "").toLowerCase();
      const type = (p.node.productType ?? "").toLowerCase();
      const handle = p.node.handle.toLowerCase();
      const rawTags = p.node.tags.map((t) => t.toLowerCase());
      // Split tags on ":" so "art:126430023" also matches just "126430023".
      const tagParts = new Set<string>();
      rawTags.forEach((t) => {
        tagParts.add(t);
        t.split(/[:\-_/\s]+/)
          .filter(Boolean)
          .forEach((part) => tagParts.add(part));
      });
      const variantValues = p.node.variants.edges.flatMap((v) =>
        v.node.selectedOptions.map((o) => o.value.toLowerCase()),
      );
      // Article numbers in description (e.g. "Artikelnummer: 126430023").
      const description = (p.node.description ?? "").toLowerCase();
      const descNumbers = new Set(description.match(/\b\d{5,}\b/g) ?? []);

      // Each token must match somewhere relevant; sum the best score per token.
      let total = 0;
      for (const t of tokens) {
        let best = 0;
        const isNumeric = /^\d{4,}$/.test(t);
        if (
          handle === t ||
          tagParts.has(t) ||
          variantValues.includes(t) ||
          descNumbers.has(t)
        )
          best = 100;
        else if (handle.includes(t)) best = Math.max(best, 60);
        else if (titleWords.includes(t)) best = Math.max(best, 80);
        else if (title.startsWith(t)) best = Math.max(best, 50);
        else if (title.includes(t)) best = Math.max(best, 35);
        else if (vendor === t) best = Math.max(best, 70);
        else if (vendor.includes(t)) best = Math.max(best, 25);
        else if (type.includes(t)) best = Math.max(best, 20);
        else if (rawTags.some((tag) => tag.includes(t)))
          best = Math.max(best, 15);
        else if (isNumeric && description.includes(t)) best = 100;
        if (best === 0) return 0;
        total += best;
      }
      return total;
    };

    const ph = products
      .map((p) => ({ p, s: scoreProduct(p) }))
      .filter((x) => x.s >= 35)
      .sort((a, b) => b.s - a.s)
      .slice(0, 8)
      .map((x) => x.p);

    const lh = looks
      .filter((l) => {
        const hay = `${l.title} ${l.subtitle ?? ""}`.toLowerCase();
        return tokens.every((t) => hay.includes(t));
      })
      .slice(0, 5);

    const vendors = new Set<string>();
    const welten = new Set<string>();
    products.forEach((p) => {
      const v = (p.node.vendor ?? "").toLowerCase();
      if (v && tokens.every((t) => v.includes(t))) {
        vendors.add(p.node.vendor as string);
      }
      p.node.tags.forEach((tag) => {
        const w = tagValue(tag, "welt");
        if (w && tokens.every((t) => w.toLowerCase().includes(t))) welten.add(w);
      });
    });
    return {
      productHits: ph,
      lookHits: lh,
      vendorHits: Array.from(vendors).slice(0, 4),
      weltHits: Array.from(welten).slice(0, 4),
    };
  }, [q, tokens, products, looks]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const go = (path: string) => {
    close();
    navigate(path);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Suche öffnen"
        className="inline-flex h-10 items-center gap-2 rounded-md px-2 text-foreground hover:bg-secondary md:px-3"
      >
        <Search className="h-5 w-5" />
        <span className="hidden text-xs uppercase tracking-[0.18em] text-muted-foreground md:inline">
          Suche
        </span>
        <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground md:inline">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Produkte, Marken, Looks, Welten suchen…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Wird geladen…
            </div>
          )}

          {!loading && (
            <CommandEmpty>Keine Treffer für „{query}".</CommandEmpty>
          )}

          {!loading && lookHits.length > 0 && (
            <CommandGroup heading="Looks">
              {lookHits.map((l) => (
                <CommandItem
                  key={l.slug}
                  value={`look-${l.slug}-${l.title}`}
                  onSelect={() => go(`/looks/${l.slug}`)}
                >
                  {l.hero_image_url && (
                    <img
                      src={l.hero_image_url}
                      alt=""
                      className="mr-3 h-10 w-10 rounded-sm object-cover"
                      loading="lazy"
                    />
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm">{l.title}</span>
                    {l.subtitle && (
                      <span className="text-xs text-muted-foreground">
                        {l.subtitle}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!loading && (vendorHits.length > 0 || weltHits.length > 0) && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Vorschläge">
                {vendorHits.map((v) => (
                  <CommandItem
                    key={`vendor-${v}`}
                    value={`vendor-${v}`}
                    onSelect={() =>
                      go(`/shop?marke=${encodeURIComponent(v)}`)
                    }
                  >
                    <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Marke
                    </span>
                    <span className="ml-2 text-sm">{v}</span>
                  </CommandItem>
                ))}
                {weltHits.map((w) => (
                  <CommandItem
                    key={`welt-${w}`}
                    value={`welt-${w}`}
                    onSelect={() =>
                      go(`/shop?welt=${encodeURIComponent(w)}`)
                    }
                  >
                    <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Welt
                    </span>
                    <span className="ml-2 text-sm capitalize">{w}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {!loading && productHits.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Produkte">
                {productHits.map((p) => {
                  const img = p.node.images.edges[0]?.node.url;
                  const price = p.node.priceRange.minVariantPrice.amount;
                  return (
                    <CommandItem
                      key={p.node.id}
                      value={`product-${p.node.handle}-${p.node.title}-${p.node.vendor}`}
                      onSelect={() => go(`/produkte/${p.node.handle}`)}
                    >
                      {img && (
                        <img
                          src={img}
                          alt=""
                          className="mr-3 h-10 w-10 rounded-sm object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className="flex flex-1 flex-col">
                        <span className="text-sm">{p.node.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {p.node.vendor}
                        </span>
                      </div>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {formatPrice(price)}
                      </span>
                    </CommandItem>
                  );
                })}
                {q && (
                  <CommandItem
                    value={`all-results-${q}`}
                    onSelect={() => go(`/shop?q=${encodeURIComponent(q)}`)}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    <span className="text-sm">
                      Alle Ergebnisse für „{query}" im Shop ansehen
                    </span>
                  </CommandItem>
                )}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
};
