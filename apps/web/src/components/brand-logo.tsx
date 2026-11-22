import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoSize = "sm" | "md" | "lg";

interface BrandLogoProps {
  /** Size preset controlling the emblem dimensions and wordmark scale. Defaults to `"md"`. */
  size?: BrandLogoSize;
  /** Whether to render the two-tone `"CrocheT PeakZ"` wordmark next to the mark. Defaults to `true`. */
  showWordmark?: boolean;
  /** Accessible alt text for the emblem. Defaults to `""` when paired with a wordmark, or `"CrocheT PeakZ"` otherwise. */
  alt?: string;
  /** Additional CSS classes applied to the outer container. */
  className?: string;
}

const sizeMap: Record<
  BrandLogoSize,
  {
    px: number;
    sizes: string;
    wrapper: string;
    image: string;
    text: string;
  }
> = {
  sm: {
    px: 36,
    sizes: "36px",
    wrapper: "gap-2 sm:gap-2.5",
    image: "size-8 sm:size-9",
    text: "text-[1.1875rem] sm:text-xl sm:whitespace-nowrap",
  },
  md: {
    px: 40,
    sizes: "40px",
    wrapper: "gap-2.5",
    image: "size-10",
    text: "text-xl whitespace-nowrap",
  },
  lg: {
    px: 48,
    sizes: "48px",
    wrapper: "gap-3",
    image: "size-12",
    text: "text-2xl whitespace-nowrap",
  },
};

/**
 * Rounded CrocheT PeakZ emblem and two-tone brand wordmark.
 *
 * Keeps the wordmark at bold large-text sizes (`>= 19px`) so both `#2B6563`
 * (`CrocheT`) and `#BF5570` (`PeakZ`) meet WCAG 2.1 AA contrast in light and
 * dark themes.
 */
function BrandLogo({
  size = "md",
  showWordmark = true,
  alt,
  className,
}: BrandLogoProps) {
  const config = sizeMap[size];
  const resolvedAlt = alt ?? (showWordmark ? "" : "CrocheT PeakZ");

  return (
    <span className={cn("inline-flex items-center", config.wrapper, className)}>
      <Image
        src="/logo.webp"
        alt={resolvedAlt}
        width={config.px}
        height={config.px}
        sizes={config.sizes}
        className={cn("shrink-0 rounded-full object-cover", config.image)}
      />
      {showWordmark && (
        <span
          className={cn(
            "font-heading font-bold leading-none tracking-tight",
            config.text,
          )}
        >
          <span className="text-brand-teal">CrocheT</span>{" "}
          <span className="text-accent">PeakZ</span>
        </span>
      )}
    </span>
  );
}

export { BrandLogo };
export type { BrandLogoProps, BrandLogoSize };
