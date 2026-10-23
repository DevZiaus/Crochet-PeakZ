import { cn } from "@/lib/utils";

/**
 * Skeleton loading placeholder with a themed warm shimmer animation.
 * Uses the muted token palette for the gradient so it matches both light and dark themes.
 * Honors `prefers-reduced-motion: reduce` via the global CSS guard.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "rounded-md bg-muted",
        "bg-[length:400%_100%]",
        "animate-[shimmer_2s_ease-in-out_infinite]",
        "motion-reduce:animate-none",
        className,
      )}
      style={{
        backgroundImage:
          "linear-gradient(90deg, var(--muted) 0%, color-mix(in srgb, var(--muted-foreground) 8%, transparent) 50%, var(--muted) 100%)",
      }}
      {...props}
    />
  );
}

export { Skeleton };
