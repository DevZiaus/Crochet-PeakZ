import type { CategorySummaryDto, CurrencyCode } from "@crochet-peakz/shared";
import type { CatalogSearchState } from "@/lib/catalog/search-params";
import { CatalogFilterForm } from "@/components/catalog/filter-form";

/** Props for the desktop catalog filter sidebar. */
export interface FilterSidebarProps {
  categories: CategorySummaryDto[];
  state: CatalogSearchState;
  currency: CurrencyCode;
}

/** Desktop filter sidebar, hidden below the large breakpoint. */
export function FilterSidebar({
  categories,
  state,
  currency,
}: FilterSidebarProps) {
  return (
    <aside className="hidden lg:block" aria-label="Product filters">
      <div className="sticky top-24 rounded-lg border border-border bg-card p-5">
        <h2 className="mb-5 font-heading text-lg font-bold text-foreground">
          Filters
        </h2>
        <CatalogFilterForm
          categories={categories}
          state={state}
          currency={currency}
          idPrefix="desktop"
        />
      </div>
    </aside>
  );
}
