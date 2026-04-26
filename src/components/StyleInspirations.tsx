import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  productTitle: string;
  productHandle: string;
  productImageUrl?: string | null;
}

type Slot = "office" | "weekend" | "evening";

const SLOT_META: Record<Slot, { eyebrow: string; title: string; text: string }> = {
  office: {
    eyebrow: "Im Büro",
    title: "Klassisch zum Sakko",
    text: "Kombiniert mit Blazer und feiner Anzughose — ein souveräner Auftritt für den Arbeitsalltag.",
  },
  weekend: {
    eyebrow: "Am Wochenende",
    title: "Lässig zur Chino",
    text: "Locker getragen mit Chino oder Jeans und Sneakern — entspannt, ohne nachlässig zu wirken.",
  },
  evening: {
    eyebrow: "Für den Abend",
    title: "Elegant zum Dinner",
    text: "Mit dunkler Hose und edlem Sakko — perfekt für Restaurant, Bar oder besondere Anlässe.",
  },
};

const SLOTS: Slot[] = ["office", "weekend", "evening"];

export const StyleInspirations = ({ productTitle, productHandle, productImageUrl }: Props) => {
  const [images, setImages] = useState<Record<Slot, string | null>>({
    office: null,
    weekend: null,
    evening: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!productHandle || !productImageUrl) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    supabase.functions
      .invoke("style-inspirations", {
        body: { productHandle, sourceImageUrl: productImageUrl },
      })
      .then(({ data, error: invokeErr }) => {
        if (cancelled) return;
        if (invokeErr) {
          setError(invokeErr.message);
          return;
        }
        const next: Record<Slot, string | null> = {
          office: null,
          weekend: null,
          evening: null,
        };
        (data?.images ?? []).forEach((img: { slot: Slot; url: string }) => {
          next[img.slot] = img.url;
        });
        setImages(next);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [productHandle, productImageUrl]);

  return (
    <section className="container-editorial border-t border-border py-16">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Style-Ideen</p>
      <h2 className="mt-2 font-display text-3xl md:text-4xl">So trägst du es</h2>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        Drei Outfit-Ideen, mit denen <span className="text-foreground">{productTitle}</span> bestens zur Geltung kommt.
      </p>

      <div className="mt-10 grid gap-x-6 gap-y-10 md:grid-cols-3">
        {SLOTS.map((slot) => {
          const meta = SLOT_META[slot];
          const url = images[slot];
          return (
            <article key={slot} className="group">
              <div className="aspect-[4/5] overflow-hidden bg-secondary">
                {url ? (
                  <img
                    src={url}
                    alt={`${meta.title} – ${productTitle}`}
                    loading="lazy"
                    width={768}
                    height={960}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : loading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center p-6 text-center text-xs text-muted-foreground">
                    Bild konnte nicht geladen werden
                  </div>
                )}
              </div>
              <div className="mt-4">
                <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">{meta.eyebrow}</p>
                <h3 className="mt-1 font-display text-xl">{meta.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground/75">{meta.text}</p>
              </div>
            </article>
          );
        })}
      </div>

      {error && (
        <p className="mt-6 text-xs text-muted-foreground">
          Style-Bilder konnten nicht geladen werden ({error}).
        </p>
      )}
    </section>
  );
};
