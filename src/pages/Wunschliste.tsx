import { Link } from "react-router-dom";
import { Heart, Trash2 } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { useWishlist } from "@/hooks/useWishlist";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const Wunschliste = () => {
  const { user } = useAuth();
  const { items, loading, remove } = useWishlist();

  return (
    <SiteLayout>
      <section className="container-editorial pt-16 md:pt-24">
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Mein Konto</p>
        <h1 className="mt-2 max-w-2xl font-display text-5xl leading-[1.05] md:text-6xl">
          Wunschliste
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Deine markierten Stücke an einem Ort.
        </p>
      </section>

      <section className="container-editorial py-12">
        {!user ? (
          <div className="border border-border bg-secondary/40 p-8 text-center">
            <Heart className="mx-auto h-6 w-6 text-muted-foreground" />
            <h2 className="mt-4 font-display text-2xl">Logge dich ein, um deine Wunschliste zu sehen</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Speichere Lieblingsstücke geräteübergreifend und erhalte als CLUB-Mitglied 100 Punkte zur Begrüssung.
            </p>
            <Button asChild className="mt-6">
              <Link to="/auth">Anmelden</Link>
            </Button>
          </div>
        ) : loading ? (
          <p className="py-16 text-center text-muted-foreground">Wunschliste wird geladen …</p>
        ) : items.length === 0 ? (
          <div className="border border-border bg-secondary/40 p-8 text-center">
            <Heart className="mx-auto h-6 w-6 text-muted-foreground" />
            <h2 className="mt-4 font-display text-2xl">Noch nichts gespeichert</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tippe auf das Herz bei einem Produkt, um es hier wiederzufinden.
            </p>
            <Button asChild className="mt-6" variant="outline">
              <Link to="/shop">Zum Shop</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it) => (
              <div key={it.id} className="group">
                <Link to={`/product/${it.product_handle}`} className="block">
                  <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
                    {it.product_image ? (
                      <img
                        src={it.product_image}
                        alt={it.product_title}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-contain p-4 mix-blend-multiply"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                        Kein Bild
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void remove(it.product_handle);
                      }}
                      aria-label="Aus Wunschliste entfernen"
                      className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center border border-border bg-background/90 text-foreground/70 backdrop-blur transition hover:border-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-4 space-y-1">
                    {it.vendor && (
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{it.vendor}</p>
                    )}
                    <h3 className="font-display text-lg leading-tight">{it.product_title}</h3>
                    {it.price_amount != null && (
                      <p className="text-sm text-foreground/80">
                        CHF {Number(it.price_amount).toFixed(2)}
                      </p>
                    )}
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </SiteLayout>
  );
};

export default Wunschliste;
