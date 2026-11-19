import type { CurrencyCode, ProductSummaryDto } from "@crochet-peakz/shared";
import { ProductCard } from "@/components/product-card";

interface ProductGridProps {
  /** Products to render. */
  products: ProductSummaryDto[];
  /** Active currency for the card prices. */
  activeCurrency: CurrencyCode;
  /** Additional classes for the grid. */
  className?: string;
}

/**
 * Responsive catalog grid.
 *
 * The column count follows the design system: one column on phones, two on
 * small screens, three on large screens, and four on extra large screens.
 */
export function ProductGrid({
  products,
  activeCurrency,
  className,
}: ProductGridProps) {
  return (
    <ul
      className={`grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${className ?? ""}`}
    >
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard
            slug={product.slug}
            title={product.title}
            imageUrl={product.primaryImageUrl}
            imageAlt={product.primaryImageAlt ?? undefined}
            priceBdt={product.priceBdt}
            priceUsd={product.priceUsd}
            activeCurrency={activeCurrency}
            productType={product.productType}
            inStock={product.inStock}
            className="h-full"
          />
        </li>
      ))}
    </ul>
  );
}
