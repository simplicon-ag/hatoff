import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Loader2, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/stores/cartStore";
import { formatPrice } from "@/lib/shopify";

const Warenkorb = () => {
  const {
    items,
    isLoading,
    isSyncing,
    updateQuantity,
    removeItem,
    getCheckoutUrl,
    syncCart,
  } = useCartStore();

  useEffect(() => {
    syncCart();
  }, [syncCart]);

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce(
    (s, i) => s + parseFloat(i.price.amount) * i.quantity,
    0,
  );
  const currency = items[0]?.price.currencyCode ?? "CHF";

  const handleCheckout = () => {
    const url = getCheckoutUrl();
    if (url) window.open(url, "_blank");
  };

  return (
    <SiteLayout>
      <section className="container-page py-10 md:py-16">
        <div className="mb-8 md:mb-12">
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            Schritt 1 von 2
          </p>
          <h1 className="mt-2 font-display text-3xl md:text-5xl">Warenkorb</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {totalItems === 0
              ? "Dein Warenkorb ist leer."
              : `${totalItems} Artikel im Warenkorb`}
          </p>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center border border-border py-20 text-center">
            <ShoppingBag className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="mb-6 text-muted-foreground">
              Noch keine Stücke ausgewählt.
            </p>
            <Button asChild>
              <Link to="/shop">Zum Shop</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
            {/* Item-Liste */}
            <ul className="divide-y divide-border border-y border-border">
              {items.map((item) => (
                <li
                  key={item.variantId}
                  className="flex gap-4 py-5 md:gap-6 md:py-6"
                >
                  <Link
                    to={`/product/${item.productHandle ?? ""}`}
                    className="h-28 w-24 flex-shrink-0 overflow-hidden bg-secondary md:h-36 md:w-32"
                  >
                    {item.productImage && (
                      <img
                        src={item.productImage}
                        alt={item.productTitle}
                        className="product-img h-full w-full object-contain"
                      />
                    )}
                  </Link>

                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          to={`/product/${item.productHandle ?? ""}`}
                          className="block truncate text-base font-medium hover:underline md:text-lg"
                        >
                          {item.productTitle}
                        </Link>
                        {item.selectedOptions.length > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground md:text-sm">
                            {item.selectedOptions
                              .map((o) => `${o.name}: ${o.value}`)
                              .join(" · ")}
                          </p>
                        )}
                        <p className="mt-2 text-sm text-muted-foreground md:hidden">
                          {formatPrice(
                            parseFloat(item.price.amount),
                            item.price.currencyCode,
                          )}{" "}
                          / Stk.
                        </p>
                      </div>
                      <button
                        onClick={() => removeItem(item.variantId)}
                        className="text-muted-foreground transition hover:text-destructive"
                        aria-label="Entfernen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-auto flex items-end justify-between pt-4">
                      <div className="inline-flex items-center border border-border">
                        <button
                          className="flex h-9 w-9 items-center justify-center hover:bg-secondary"
                          onClick={() =>
                            updateQuantity(item.variantId, item.quantity - 1)
                          }
                          aria-label="Weniger"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-9 text-center text-sm">
                          {item.quantity}
                        </span>
                        <button
                          className="flex h-9 w-9 items-center justify-center hover:bg-secondary"
                          onClick={() =>
                            updateQuantity(item.variantId, item.quantity + 1)
                          }
                          aria-label="Mehr"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="font-display text-lg md:text-xl">
                        {formatPrice(
                          parseFloat(item.price.amount) * item.quantity,
                          item.price.currencyCode,
                        )}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Summary */}
            <aside className="lg:sticky lg:top-28 lg:self-start">
              <div className="border border-border bg-secondary/30 p-6">
                <h2 className="font-display text-xl">Zusammenfassung</h2>

                <dl className="mt-5 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Zwischensumme</dt>
                    <dd>{formatPrice(totalPrice, currency)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Versand</dt>
                    <dd className="text-muted-foreground">
                      Wird im Checkout berechnet
                    </dd>
                  </div>
                </dl>

                <div className="mt-5 flex items-baseline justify-between border-t border-border pt-5">
                  <span className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                    Total
                  </span>
                  <span className="font-display text-2xl">
                    {formatPrice(totalPrice, currency)}
                  </span>
                </div>

                <Button
                  className="mt-6 w-full"
                  size="lg"
                  onClick={handleCheckout}
                  disabled={isLoading || isSyncing || items.length === 0}
                >
                  {isLoading || isSyncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Zur Kasse
                    </>
                  )}
                </Button>

                <Button
                  variant="ghost"
                  className="mt-2 w-full"
                  asChild
                >
                  <Link to="/shop">Weiter einkaufen</Link>
                </Button>

                <p className="mt-4 text-center text-[11px] text-muted-foreground">
                  Sichere Bezahlung über Shopify · MwSt. & Versand auf der
                  nächsten Seite
                </p>
              </div>
            </aside>
          </div>
        )}
      </section>
    </SiteLayout>
  );
};

export default Warenkorb;
