import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { CuratedLook } from "@/data/looks";
import { fetchProductsByHandles } from "@/lib/shopify";

export const LookCard = ({ look }: { look: CuratedLook }) => {
  const [fallbackImage, setFallbackImage] = useState<string | null>(null);

  useEffect(() => {
    if (look.hero) return;
    let active = true;
    fetchProductsByHandles(look.productHandles.slice(0, 1))
      .then((res) => {
        if (active) setFallbackImage(res[0]?.node.images.edges[0]?.node.url ?? null);
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
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="absolute inset-x-0 bottom-0 p-6 text-primary-foreground">
          <p className="text-[11px] uppercase tracking-[0.2em] opacity-80">Look</p>
          <h3 className="mt-1 font-display text-2xl leading-tight">{look.title}</h3>
          <p className="mt-1 text-sm opacity-90">{look.subtitle}</p>
        </div>
      </div>
    </Link>
  );
};
