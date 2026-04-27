import { Heart } from "lucide-react";
import { useLookLikes } from "@/hooks/useLookLikes";
import { cn } from "@/lib/utils";

interface Props {
  slug: string;
  variant?: "card" | "hero";
  stopNavigation?: boolean;
  className?: string;
}

export const LookLikeButton = ({
  slug,
  variant = "card",
  stopNavigation,
  className,
}: Props) => {
  const { liked, count, toggle } = useLookLikes(slug);

  if (variant === "hero") {
    return (
      <button
        type="button"
        onClick={(e) => {
          if (stopNavigation) {
            e.preventDefault();
            e.stopPropagation();
          }
          void toggle();
        }}
        aria-pressed={liked}
        aria-label={liked ? "Like entfernen" : "Look liken"}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium backdrop-blur-sm transition",
          liked
            ? "border-destructive/60 bg-destructive/15 text-destructive-foreground"
            : "border-primary-foreground/30 bg-foreground/30 text-primary-foreground hover:bg-foreground/40",
          className,
        )}
      >
        <Heart
          className={cn(
            "h-4 w-4 transition-transform",
            liked && "scale-110 fill-destructive text-destructive",
          )}
        />
        <span className="tabular-nums">{count}</span>
        <span className="opacity-80">{count === 1 ? "Like" : "Likes"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        if (stopNavigation) {
          e.preventDefault();
          e.stopPropagation();
        }
        void toggle();
      }}
      aria-pressed={liked}
      aria-label={liked ? "Like entfernen" : "Look liken"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-background/90 px-2.5 py-1 text-xs font-medium backdrop-blur-sm transition",
        liked
          ? "border-destructive/60 text-destructive"
          : "border-border text-foreground/80 hover:border-primary hover:text-primary",
        className,
      )}
    >
      <Heart className={cn("h-3.5 w-3.5", liked && "fill-destructive")} />
      <span className="tabular-nums">{count}</span>
    </button>
  );
};
