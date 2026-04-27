import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCartStore } from "@/stores/cartStore";
import { formatPrice } from "@/lib/shopify";

export const CartDrawer = () => {
  const [open, setOpen] = useState(false);
  const { items, isLoading, isSyncing, updateQuantity, removeItem, getCheckoutUrl, syncCart } = useCartStore();

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => s + parseFloat(i.price.amount) * i.quantity, 0);
  const currency = items[0]?.price.currencyCode ?? "CHF";

  useEffect(() => {
    if (open) syncCart();
  }, [open, syncCart]);

  const handleCheckout = () => {
    const url = getCheckoutUrl();
    if (url) {
      window.open(url, "_blank");
      setOpen(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10" aria-label="Warenkorb">
          <ShoppingBag className="h-5 w-5" />
          {totalItems > 0 && (
            <Badge className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent p-0 px-1 text-[10px] text-accent-foreground">
              {totalItems}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex h-full w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">Warenkorb</SheetTitle>
          <SheetDescription>
            {totalItems === 0 ? "Noch leer — Zeit für einen Look." : `${totalItems} Stück${totalItems !== 1 ? "" : ""} im Korb`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex min-h-0 flex-1 flex-col">
          {items.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-center">
              <div>
                <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">Dein Warenkorb ist leer.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto pr-1">
                <ul className="space-y-5">
                  {items.map((item) => (
                    <li key={item.variantId} className="flex gap-4 border-b border-border pb-5">
                      <div className="h-20 w-16 flex-shrink-0 overflow-hidden bg-secondary">
                        {item.productImage && (
                          <img src={item.productImage} alt={item.productTitle} className="product-img h-full w-full object-contain" />
                        )}
                      </div>
                      <div className="flex flex-1 flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{item.productTitle}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.selectedOptions.map((o) => o.value).join(" · ")}
                            </p>
                          </div>
                          <button
                            onClick={() => removeItem(item.variantId)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label="Entfernen"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="mt-3 flex items-end justify-between">
                          <div className="inline-flex items-center gap-1 border border-border">
                            <button
                              className="flex h-7 w-7 items-center justify-center hover:bg-secondary"
                              onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                              aria-label="Weniger"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-7 text-center text-sm">{item.quantity}</span>
                            <button
                              className="flex h-7 w-7 items-center justify-center hover:bg-secondary"
                              onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                              aria-label="Mehr"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <p className="text-sm font-medium">
                            {formatPrice(parseFloat(item.price.amount) * item.quantity, item.price.currencyCode)}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-border bg-background pt-5">
                <div className="mb-4 flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Zwischensumme</span>
                  <span className="font-display text-xl">{formatPrice(totalPrice, currency)}</span>
                </div>
                <Button
                  className="w-full"
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
                <p className="mt-3 text-center text-[11px] text-muted-foreground">
                  Sichere Bezahlung über Shopify · MwSt. & Versand auf der nächsten Seite
                </p>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
