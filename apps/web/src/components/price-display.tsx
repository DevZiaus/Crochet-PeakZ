import { cn } from "@/lib/utils";

type CurrencyCode = "BDT" | "USD";

interface PriceDisplayProps {
  /** Price in BDT. */
  priceBdt: number;
  /** Price in USD. */
  priceUsd: number;
  /** The active currency to display. Defaults to BDT. */
  activeCurrency?: CurrencyCode;
  /** Optional compare at price in BDT (for showing sale markup). */
  compareAtBdt?: number;
  /** Optional compare at price in USD. */
  compareAtUsd?: number;
  /** Size variant. */
  size?: "sm" | "md" | "lg";
  /** Additional CSS class names. */
  className?: string;
}

const currencyConfig: Record<CurrencyCode, { symbol: string; locale: string }> =
  {
    BDT: { symbol: "৳", locale: "en-BD" },
    USD: { symbol: "$", locale: "en-US" },
  };

/**
 * Formats a numeric price with the appropriate currency symbol and locale.
 * @param amount - The numeric price amount.
 * @param currency - The currency code.
 * @returns A formatted price string.
 */
function formatPrice(amount: number, currency: CurrencyCode): string {
  const config = currencyConfig[currency];
  const formatted = new Intl.NumberFormat(config.locale, {
    minimumFractionDigits: currency === "USD" ? 2 : 0,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(amount);

  return `${config.symbol}${formatted}`;
}

const sizeClasses = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl font-semibold",
} as const;

/**
 * Currency aware price display component.
 * Shows the price in the active currency with optional compare at (strikethrough) price.
 * Accepts priceBdt and priceUsd so the currency switcher can drive which is shown.
 */
function PriceDisplay({
  priceBdt,
  priceUsd,
  activeCurrency = "BDT",
  compareAtBdt,
  compareAtUsd,
  size = "md",
  className,
}: PriceDisplayProps) {
  const price = activeCurrency === "BDT" ? priceBdt : priceUsd;
  const compareAt = activeCurrency === "BDT" ? compareAtBdt : compareAtUsd;
  const hasDiscount = compareAt !== undefined && compareAt > price;

  return (
    <div
      className={cn("flex items-baseline gap-2", sizeClasses[size], className)}
    >
      <span
        className={cn(
          "font-semibold",
          hasDiscount ? "text-highlight" : "text-foreground",
        )}
        aria-label={`Price: ${formatPrice(price, activeCurrency)}`}
      >
        {formatPrice(price, activeCurrency)}
      </span>
      {hasDiscount && (
        <span
          className="text-muted-foreground line-through"
          aria-label={`Original price: ${formatPrice(compareAt, activeCurrency)}`}
        >
          {formatPrice(compareAt, activeCurrency)}
        </span>
      )}
    </div>
  );
}

export { PriceDisplay, formatPrice, currencyConfig };
export type { PriceDisplayProps, CurrencyCode };
