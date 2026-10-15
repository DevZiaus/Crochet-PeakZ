import { Star, StarHalf } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  /** The rating value, from 1 to maxStars. Supports half star increments. */
  rating: number;
  /** Maximum number of stars. Defaults to 5. */
  maxStars?: number;
  /** Size of each star icon. */
  size?: "sm" | "md" | "lg";
  /** Whether to show the numeric value beside the stars. */
  showValue?: boolean;
  /** Additional CSS class names. */
  className?: string;
}

const sizeMap = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
} as const;

/**
 * Star rating display component. Renders filled, half, and empty stars
 * based on the rating value. Supports 1 to 5 with 0.5 increments.
 * Purely presentational (not interactive).
 */
function StarRating({
  rating,
  maxStars = 5,
  size = "md",
  showValue = false,
  className,
}: StarRatingProps) {
  const clampedRating = Math.max(1, Math.min(rating, maxStars));
  const fullStars = Math.floor(clampedRating);
  const hasHalfStar =
    clampedRating - fullStars >= 0.25 && clampedRating - fullStars < 0.75;
  const emptyStars = maxStars - fullStars - (hasHalfStar ? 1 : 0);

  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      role="img"
      aria-label={`${String(clampedRating)} out of ${String(maxStars)} stars`}
    >
      {/* Filled stars */}
      {Array.from({ length: fullStars }).map((_, i) => (
        <Star
          key={`filled-${String(i)}`}
          className={cn(sizeMap[size], "fill-accent text-accent")}
          aria-hidden="true"
        />
      ))}

      {/* Half star */}
      {hasHalfStar && (
        <div className="relative" aria-hidden="true">
          <Star className={cn(sizeMap[size], "text-muted-foreground/30")} />
          <StarHalf
            className={cn(
              sizeMap[size],
              "absolute inset-0 fill-accent text-accent",
            )}
          />
        </div>
      )}

      {/* Empty stars */}
      {Array.from({ length: emptyStars }).map((_, i) => (
        <Star
          key={`empty-${String(i)}`}
          className={cn(sizeMap[size], "text-muted-foreground/30")}
          aria-hidden="true"
        />
      ))}

      {showValue && (
        <span className="ml-1 text-sm font-medium text-muted-foreground">
          {clampedRating.toFixed(1)}
        </span>
      )}
    </div>
  );
}

export { StarRating };
export type { StarRatingProps };
