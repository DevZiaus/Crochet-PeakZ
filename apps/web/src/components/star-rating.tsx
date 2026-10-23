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
 * Formats a rating for the numeric readout and the accessible name.
 * Keeps up to two decimal places and trims trailing zeros, so the true
 * average survives: 4.8 stays "4.8", 4.25 stays "4.25", 4 becomes "4".
 */
function formatRating(value: number): string {
  return Number(value.toFixed(2)).toString();
}

/**
 * Star rating display component. Renders filled, half, and empty stars
 * based on the rating value. Supports 1 to 5 with 0.5 increments.
 * Purely presentational (not interactive).
 *
 * The graphic rounds to the nearest half star, but the accessible name and
 * the optional numeric readout always carry the true rating. Never let the
 * label claim a value the data does not have.
 */
function StarRating({
  rating,
  maxStars = 5,
  size = "md",
  showValue = false,
  className,
}: StarRatingProps) {
  const safeRating = Number.isFinite(rating) ? rating : 0;
  const safeMax = Number.isInteger(maxStars) && maxStars > 0 ? maxStars : 5;
  const clampedRating = Math.max(0, Math.min(safeRating, safeMax));
  // Round to the nearest half star before deriving counts so the graphic is
  // readable. The true rating still drives the label and numeric readout.
  const rounded = Math.round(clampedRating * 2) / 2;
  const fullStars = Math.floor(rounded);
  const hasHalfStar = rounded - fullStars >= 0.25;
  const emptyStars = safeMax - fullStars - (hasHalfStar ? 1 : 0);

  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      role="img"
      aria-label={`${formatRating(clampedRating)} out of ${String(safeMax)} stars`}
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
          {formatRating(clampedRating)}
        </span>
      )}
    </div>
  );
}

export { StarRating };
export type { StarRatingProps };
