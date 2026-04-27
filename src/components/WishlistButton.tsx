import { Heart } from "lucide-react";
import { useWishlist, type WishlistAddInput } from "@/hooks/useWishlist";
import { cn } from "@/lib/utils";

interface Props extends WishlistAddInput {
  className?: string;
  size?: "sm" | "md";
  ariaLabel?: string;
  stopNavigation?: boolean;
}

export const WishlistButton = ({
  className,
  size = "md",
  ariaLabel,
  stopNavigation,
  ...input
}: Props) => {
  const { has, toggle } = useWishlist();
  const active = has(input.productHandle);

  return (
    <button
      type="button"
      onClick={(e) => {
        if (stopNavigation) {
          e.preventDefault();
          e.stopPropagation();
        }
        void toggle(input);
      }}
      aria-label={ariaLabel ?? (active ? "Aus Wunschliste entfernen" : "Zur Wunschliste")}
      aria-pressed={active}
      className={cn(
        "flex items-center justify-center border border-border bg-background/90 text-foreground/70 backdrop-blur transition hover:border-primary hover:text-primary",
        size === "sm" ? "h-8 w-8" : "h-9 w-9",
        active && "border-destructive bg-destructive/5 text-destructive hover:border-destructive hover:text-destructive",
        className,
      )}
    >
      <Heart
        className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4", active && "fill-destructive")}
      />
    </button>
  );
};
