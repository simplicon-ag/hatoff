import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { CuratedLook } from "@/data/looks";
import { fetchProductByHandle } from "@/lib/shopify";
import { parseLookHandle } from "@/lib/lookHandles";

export const LookCard = ({ look }: { look: CuratedLook }) => {
  const [fallbackImage, setFallbackImage] = useState<string | null>(null);

  useEffect(() => {
    if (look.hero) return;
    let active = true;
    const first = look.productHandles[0];
    if (!first) return;
    const { handle, color } = parseLookHandle(first);
    fetchProductByHandle(handle)
      .then((node) => {
        if (!active || !node) return;
        // Wenn eine Farbe gewünscht ist, suche das passende Variantenbild
        if (color) {
          const variant = node.variants?.edges?.find((v: { node: { selectedOptions: Array<{ name: string; value: string }>; image?: { url: string } | null } }) =>
            v.node.selectedOptions.some(
              (o) => /farbe|color|colour/i.test(o.name) && o.value.toLowerCase() === color.toLowerCase(),
            ),
          )?.node;
          const variantImg = variant?.image?.url;
          if (variantImg) {
            setFallbackImage(variantImg);
            return;
          }
        }
        setFallbackImage(node.images?.edges?.[0]?.node?.url ?? null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [look]);

  const image = look.hero ?? fallbackImage;

  return (
    <Link to={`/looks/${look.slug}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
        {image ? (
          <img
            src={image}
            alt={look.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full animate-pulse bg-secondary" />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-foreground/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6 text-primary-foreground">
          <p className="text-[11px] uppercase tracking-[0.2em] opacity-80">Look</p>
          <h3 className="mt-1 font-display text-2xl leading-tight">{look.title}</h3>
          <p className="mt-1 text-sm opacity-90">{look.subtitle}</p>
        </div>
      </div>
    </Link>
  );
};
