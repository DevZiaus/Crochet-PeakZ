"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CatalogSort } from "@crochet-peakz/shared";
import { sortLabels, sortOptions } from "@/lib/catalog/labels";
import { buildSortHref } from "@/lib/catalog/search-params";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Props for the shop sort control. */
export interface SortSelectProps {
  value: CatalogSort;
  /** Id of the visible label that names the control. */
  labelId?: string;
}

/**
 * Sort control that applies immediately and preserves every active filter.
 * Changing the sort resets pagination to page 1.
 */
export function SortSelect({
  value,
  labelId = "shop-sort-label",
}: SortSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(next: string) {
    const sort = sortOptions.includes(next as CatalogSort)
      ? (next as CatalogSort)
      : "newest";
    router.push(buildSortHref(pathname, searchParams, sort));
  }

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger aria-labelledby={labelId} className="w-full sm:w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {sortOptions.map((option) => (
          <SelectItem key={option} value={option}>
            {sortLabels[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
