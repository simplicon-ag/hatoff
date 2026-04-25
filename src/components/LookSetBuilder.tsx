import { useEffect, useMemo, useState } from "react";
import { Loader2, ShoppingBag, Check, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice, type ShopifyProduct } from "@/lib/shopify";
import { useLivePrices, formatLivePrice } from "@/hooks/useLivePrice";
import { useCartStore } from "@/stores/cartStore";
import { toast } from "sonner";

interface Props {
  products: ShopifyProduct[];
  lookTitle: string;
  /** When true, each item shows a remove button (used in AI-generated sets). */
  allowRemove?: boolean;
}

type Selections = Record<string, Record<string, string>>; // productId -> { optionName -> value }

/**
 * Find the variant whose selectedOptions match the chosen values for a product.
 */
function findVariant(product: ShopifyProduct, chosen: Record<string, string>) {
  const variants = product.node.variants.edges;
  return variants.find((v) =>
    v.node.selectedOptions.every((opt) => chosen[opt.name] === opt.value),
  )?.node;
}

/**
 * For a given product + currently chosen options for OTHER option dimensions,
 * decide if a candidate value for `optionName` is available (any matching variant in stock).
 */
function isOptionAvailable(
  product: ShopifyProduct,
  optionName: string,
  candidate: string,
  chosen: Record<string, string>,
): boolean {
  return product.node.variants.edges.some((v) => {
    const opts = v.node.selectedOptions;
    const matchesCandidate = opts.some((o) => o.name === optionName && o.value === candidate);
    if (!matchesCandidate) return false;
    // Match all other already-chosen dimensions
    const otherMatch = opts.every((o) => {
      if (o.name === optionName) return true;
      const c = chosen[o.name];
      return c === undefined || c === o.value;
    });
    return otherMatch && v.node.availableForSale;
  });
}

export const LookSetBuilder = ({ products, lookTitle, allowRemove = false }: Props) => {
  const addItems = useCartStore((s) => s.addItems);
  const isLoading = useCartStore((s) => s.isLoading);
  const [adding, setAdding] = useState(false);

  // Items the user hid from the set (only relevant when allowRemove)
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  // Reset removed set if the products list changes (e.g. new AI generation)
  useEffect(() => {
    setRemovedIds(new Set());
  }, [products]);

  const visibleProducts = useMemo(
    () => products.filter((p) => !removedIds.has(p.node.id)),
    [products, removedIds],
  );

  // Initialize: pre-select first available variant's options per product
  const [selections, setSelections] = useState<Selections>({});

  useEffect(() => {
    setSelections((prev) => {
      const next: Selections = { ...prev };
      for (const p of products) {
        if (next[p.node.id]) continue;
        const firstAvail =
          p.node.variants.edges.find((v) => v.node.availableForSale)?.node ??
          p.node.variants.edges[0]?.node;
        if (!firstAvail) continue;
        const init: Record<string, string> = {};
        for (const opt of firstAvail.selectedOptions) init[opt.name] = opt.value;
        next[p.node.id] = init;
      }
      return next;
    });
  }, [products]);

  const setOption = (productId: string, optionName: string, value: string) => {
    setSelections((prev) => ({
      ...prev,
      [productId]: { ...(prev[productId] ?? {}), [optionName]: value },
    }));
  };

  const removeItem = (productId: string) => {
    setRemovedIds((prev) => {
      const next = new Set(prev);
      next.add(productId);
      return next;
    });
  };

  // Compute selected variant + availability per product (only visible ones count)
  const resolved = useMemo(
    () =>
      visibleProducts.map((p) => {
        const chosen = selections[p.node.id] ?? {};
        const variant = findVariant(p, chosen);
        return { product: p, chosen, variant };
      }),
    [visibleProducts, selections],
  );

  const allReady = resolved.every(
    (r) => r.variant && r.variant.availableForSale,
  );

  const handles = useMemo(() => visibleProducts.map((p) => p.node.handle), [visibleProducts]);
  const { prices: livePrices } = useLivePrices(handles);

  const total = resolved.reduce((sum, r) => {
    const live = livePrices[r.product.node.handle];
    if (live) return sum + live.display_price_chf;
    return sum + (r.variant ? parseFloat(r.variant.price.amount) : 0);
  }, 0);
  const currency = "CHF";

  const handleAddSet = async () => {
    if (!allReady) {
      toast.error("Bitte für jedes Stück eine verfügbare Grösse wählen.");
      return;
    }
    const items = resolved
      .map((r) =>
        r.variant
          ? {
              productHandle: r.product.node.handle,
              productTitle: r.product.node.title,
              productImage:
                r.product.node.images.edges[0]?.node.url ?? null,
              variantId: r.variant.id,
              variantTitle: r.variant.title,
              price: r.variant.price,
              quantity: 1,
              selectedOptions: r.variant.selectedOptions ?? [],
            }
          : null,
      )
      .filter(Boolean) as Parameters<typeof addItems>[0];
    setAdding(true);
    await addItems(items);
    setAdding(false);
    toast.success("Set im Warenkorb", {
      description: `${items.length} Stücke · ${lookTitle}`,
      position: "top-right",
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6 md:p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
            Komplettes Set
          </p>
          <p className="mt-1 font-display text-2xl">{visibleProducts.length} Stücke · {`CHF ${total.toFixed(2)}`}</p>
        </div>
        <div className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-primary">
          Set sparen — alles aus einer Bestellung
        </div>
      </div>

      <div className="mt-6 divide-y divide-border">
        {resolved.map((r, idx) => {
          const p = r.product;
          const opts = p.node.options ?? [];
          const img = p.node.images.edges[0]?.node.url;
          const cleanTitle = p.node.title
            .replace(/\s*–\s*Var\.?\s*\d+$/i, "")
            .trim();
          return (
            <div
              key={p.node.id}
              className="flex flex-col gap-4 py-5 sm:flex-row sm:items-start"
            >
              <div className="flex items-start gap-4 sm:w-64">
                <div className="h-20 w-16 flex-shrink-0 overflow-hidden bg-secondary">
                  {img && (
                    <img
                      src={img}
                      alt={cleanTitle}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Stück {idx + 1}
                  </p>
                  <p className="text-sm font-medium leading-tight">
                    {cleanTitle}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatLivePrice(livePrices[p.node.handle]) ??
                      (r.variant
                        ? formatPrice(r.variant.price.amount, r.variant.price.currencyCode)
                        : "—")}
                  </p>
                </div>
              </div>

              <div className="flex flex-1 flex-wrap gap-3">
                {opts.length === 0 || (opts.length === 1 && opts[0].values.length <= 1) ? (
                  <p className="self-center text-xs text-muted-foreground">
                    Einheitsgrösse
                  </p>
                ) : (
                  opts.map((opt) => {
                    const chosen = r.chosen[opt.name];
                    return (
                      <div key={opt.name} className="flex flex-col gap-1.5">
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {opt.name}
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {opt.values.map((val) => {
                            const available = isOptionAvailable(
                              p,
                              opt.name,
                              val,
                              r.chosen,
                            );
                            const isSelected = chosen === val;
                            return (
                              <button
                                key={val}
                                type="button"
                                disabled={!available}
                                onClick={() => setOption(p.node.id, opt.name, val)}
                                className={[
                                  "min-w-[2.5rem] rounded-md border px-2.5 py-1 text-xs transition-colors",
                                  isSelected
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : available
                                      ? "border-border bg-background hover:border-primary"
                                      : "cursor-not-allowed border-border bg-muted text-muted-foreground line-through opacity-50",
                                ].join(" ")}
                                title={available ? val : `${val} — nicht verfügbar`}
                              >
                                {val}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Set-Total</p>
          <p className="font-display text-3xl">
            {`CHF ${total.toFixed(2)}`}
          </p>
        </div>
        <Button
          onClick={handleAddSet}
          disabled={!allReady || adding || isLoading}
          size="lg"
          className="w-full sm:w-auto sm:min-w-[260px]"
        >
          {adding || isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : allReady ? (
            <>
              <ShoppingBag className="mr-2 h-4 w-4" />
              Komplettes Set in den Warenkorb
            </>
          ) : (
            <>
              <AlertCircle className="mr-2 h-4 w-4" />
              Grössen wählen
            </>
          )}
        </Button>
      </div>

      {allReady && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5 text-primary" />
          Alle Grössen verfügbar — bereit zur Bestellung
        </p>
      )}
    </div>
  );
};
