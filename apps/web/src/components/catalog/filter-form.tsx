import Link from "next/link";
import { ProductType } from "@crochet-peakz/shared";
import type { CategorySummaryDto, CurrencyCode } from "@crochet-peakz/shared";
import type { CatalogSearchState } from "@/lib/catalog/search-params";
import { productTypeLabels } from "@/lib/catalog/labels";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

/** Props for the shared catalog filter form. */
export interface CatalogFilterFormProps {
  categories: CategorySummaryDto[];
  state: CatalogSearchState;
  currency: CurrencyCode;
  /** Prefix for field ids so the desktop and drawer forms stay unique. */
  idPrefix: string;
}

/**
 * The GET filter form used by both the desktop sidebar and the mobile drawer.
 * Submitting replaces the URL with the checked categories, types, and prices.
 */
export function CatalogFilterForm({
  categories,
  state,
  currency,
  idPrefix,
}: CatalogFilterFormProps) {
  const visibleCategories = categories.filter(
    (category) => category.productCount > 0,
  );

  return (
    <form method="get" action="/shop" className="space-y-7">
      {state.sort !== "newest" ? (
        <input type="hidden" name="sort" value={state.sort} />
      ) : null}
      {state.featured === true ? (
        <input type="hidden" name="featured" value="true" />
      ) : null}

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-foreground">
          Category
        </legend>
        <div className="space-y-1">
          {visibleCategories.map((category) => {
            const inputId = `${idPrefix}-category-${category.slug}`;
            return (
              <label
                key={category.id}
                htmlFor={inputId}
                className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground motion-reduce:transition-none"
              >
                <Checkbox
                  id={inputId}
                  name="category"
                  value={category.slug}
                  defaultChecked={state.categories.includes(category.slug)}
                />
                <span className="flex-1">{category.name}</span>
                <span className="text-xs text-muted-foreground">
                  {category.productCount}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-foreground">
          Product type
        </legend>
        <div className="space-y-1">
          {Object.values(ProductType).map((type) => {
            const inputId = `${idPrefix}-type-${type.toLowerCase()}`;
            return (
              <label
                key={type}
                htmlFor={inputId}
                className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground motion-reduce:transition-none"
              >
                <Checkbox
                  id={inputId}
                  name="type"
                  value={type}
                  defaultChecked={state.types.includes(type)}
                />
                <span>{productTypeLabels[type]}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-foreground">
          Price range
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label
              htmlFor={`${idPrefix}-min-price`}
              className="text-xs font-medium text-muted-foreground"
            >
              Minimum
            </label>
            <Input
              id={`${idPrefix}-min-price`}
              name="minPrice"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              defaultValue={state.minPrice ?? ""}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor={`${idPrefix}-max-price`}
              className="text-xs font-medium text-muted-foreground"
            >
              Maximum
            </label>
            <Input
              id={`${idPrefix}-max-price`}
              name="maxPrice"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              defaultValue={state.maxPrice ?? ""}
              placeholder="Any"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Prices in {currency}</p>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Button type="submit" className="w-full">
          Apply filters
        </Button>
        <Link
          href="/shop"
          className="flex min-h-11 items-center justify-center rounded-md text-sm font-medium text-muted-foreground underline-offset-4 transition-colors duration-200 hover:text-foreground hover:underline motion-reduce:transition-none"
        >
          Clear all
        </Link>
      </div>
    </form>
  );
}
