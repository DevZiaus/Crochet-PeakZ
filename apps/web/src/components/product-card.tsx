import Link from "next/link";
import type { CurrencyCode, ProductType } from "@crochet-peakz/shared";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PriceDisplay } from "@/components/price-display";
import { ProductImage } from "@/components/product-image";
import { StarRating } from "@/components/star-rating";

interface ProductCardProps {
  /** Product slug or ID for the detail link. */
  slug: string;
  /** Product title. */
  title: string;
  /** Primary image URL, or null when the product has no image. */
  imageUrl: string | null;
  /** Image alt text. */
  imageAlt?: string;
  /** Price in BDT. */
  priceBdt: number;
  /** Price in USD. */
  priceUsd: number;
  /** Optional compare at price in BDT. */
  compareAtBdt?: number;
  /** Optional compare at price in USD. */
  compareAtUsd?: number;
  /** Active currency for display. Defaults to BDT. */
  activeCurrency?: CurrencyCode;
  /** Average rating (0 to 5). */
  averageRating?: number;
  /** Number of reviews. */
  reviewCount?: number;
  /** Product type for the badge. */
  productType?: ProductType;
  /** Whether the product is in stock. */
  inStock?: boolean;
  /** Additional CSS class names. */
  className?: string;
}

const productTypeBadge: Record<
  ProductType,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
  }
> = {
  STANDARD: { label: "Standard", variant: "secondary" },
  ONE_OF_A_KIND: { label: "One of a Kind", variant: "default" },
  // These badges sit over product photos, so they need an opaque token fill.
  // The transparent `outline` variant cannot guarantee contrast on an image.
  PRE_ORDER: { label: "Pre-order", variant: "secondary" },
  CUSTOM: { label: "Custom", variant: "secondary" },
  DIGITAL: { label: "Digital", variant: "secondary" },
};

/**
 * Product card for catalog grid display. Composes image, title, price display,
 * star rating, product type badge, and stock status. Links to the product detail page.
 * Includes scroll triggered fade in animation (via CSS) and hover effects.
 */
function ProductCard({
  slug,
  title,
  imageUrl,
  imageAlt,
  priceBdt,
  priceUsd,
  compareAtBdt,
  compareAtUsd,
  activeCurrency = "BDT",
  averageRating,
  reviewCount,
  productType,
  inStock = true,
  className,
}: ProductCardProps) {
  const badgeConfig = productType ? productTypeBadge[productType] : undefined;
  const price = activeCurrency === "BDT" ? priceBdt : priceUsd;
  const compareAt = activeCurrency === "BDT" ? compareAtBdt : compareAtUsd;
  const hasSale = compareAt !== undefined && compareAt > price;

  return (
    <Link
      href={`/shop/${slug}`}
      className={cn(
        "card-reveal group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-200 motion-reduce:transition-none",
        "hover:shadow-md hover:border-primary/20",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      {/* Image */}
      <div className="relative aspect-[4/5] overflow-hidden bg-muted">
        <ProductImage
          src={imageUrl}
          alt={imageAlt || title}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
        />

        {/* Badges overlay */}
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {!inStock && (
            <Badge variant="destructive" className="text-xs">
              Sold Out
            </Badge>
          )}
          {badgeConfig && (
            <Badge variant={badgeConfig.variant} className="text-xs">
              {badgeConfig.label}
            </Badge>
          )}
          {hasSale && (
            <Badge className="bg-highlight text-highlight-foreground text-xs">
              Sale
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-sm font-medium text-foreground group-hover:text-primary transition-colors duration-200 motion-reduce:transition-none">
          {title}
        </h3>

        {/* Rating */}
        {averageRating !== undefined && averageRating > 0 && (
          <div className="flex items-center gap-1.5">
            <StarRating rating={averageRating} size="sm" />
            {reviewCount !== undefined && (
              <span className="text-xs text-muted-foreground">
                ({reviewCount})
              </span>
            )}
          </div>
        )}

        {/* Price */}
        <div className="mt-auto pt-1">
          <PriceDisplay
            priceBdt={priceBdt}
            priceUsd={priceUsd}
            activeCurrency={activeCurrency}
            compareAtBdt={compareAtBdt}
            compareAtUsd={compareAtUsd}
            size="sm"
          />
        </div>
      </div>
    </Link>
  );
}

export { ProductCard, productTypeBadge };
export type { ProductCardProps };
