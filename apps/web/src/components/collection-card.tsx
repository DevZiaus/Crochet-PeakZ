import Link from "next/link";
import type { CategorySummaryDto } from "@crochet-peakz/shared";
import { ProductImage } from "@/components/product-image";
import { cn } from "@/lib/utils";

interface CollectionCardProps {
  /** Category summary from the catalog API. */
  category: CategorySummaryDto;
  /** Additional CSS class names. */
  className?: string;
}

/**
 * Collection card linking to a category landing page.
 *
 * The cover is the primary image of the newest visible product in the
 * category subtree. A missing cover falls back to the product placeholder.
 */
export function CollectionCard({ category, className }: CollectionCardProps) {
  const countLabel =
    category.productCount === 1
      ? "1 piece"
      : `${String(category.productCount)} pieces`;

  return (
    <Link
      href={`/collections/${category.slug}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-200 motion-reduce:transition-none",
        "hover:border-primary/20 hover:shadow-md",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        <ProductImage
          src={category.coverImageUrl}
          alt={category.coverImageAlt ?? category.name}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-5">
        <h3 className="font-heading text-xl font-semibold text-foreground transition-colors duration-200 group-hover:text-primary motion-reduce:transition-none">
          {category.name}
        </h3>
        {category.description && (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {category.description}
          </p>
        )}
        <p className="mt-auto pt-3 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {countLabel}
        </p>
      </div>
    </Link>
  );
}
