import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingStarsProps {
  value: number;
  size?: "xs" | "sm" | "md" | "lg";
  interactive?: boolean;
  onChange?: (value: number) => void;
  className?: string;
}

const sizeMap = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-6 w-6",
};

export const RatingStars = ({
  value,
  size = "sm",
  interactive = false,
  onChange,
  className,
}: RatingStarsProps) => {
  return (
    <div className={cn("inline-flex items-center gap-0.5", className)} role={interactive ? "radiogroup" : "img"} aria-label={`${value} von 5 Sternen`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(value);
        const StarEl = (
          <Star
            className={cn(
              sizeMap[size],
              filled ? "fill-foreground text-foreground" : "fill-transparent text-foreground/25",
              interactive && "transition-transform hover:scale-110",
            )}
            strokeWidth={1.5}
          />
        );
        if (!interactive) return <span key={star}>{StarEl}</span>;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            onClick={() => onChange?.(star)}
            className="p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            aria-label={`${star} Sterne`}
          >
            {StarEl}
          </button>
        );
      })}
    </div>
  );
};
