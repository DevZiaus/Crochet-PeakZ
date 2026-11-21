"use client";

import { SlidersHorizontalIcon, XIcon } from "lucide-react";
import type { CategorySummaryDto, CurrencyCode } from "@crochet-peakz/shared";
import type { CatalogSearchState } from "@/lib/catalog/search-params";
import { CatalogFilterForm } from "@/components/catalog/filter-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Props for the mobile catalog filter drawer. */
export interface MobileFilterDrawerProps {
  categories: CategorySummaryDto[];
  state: CatalogSearchState;
  currency: CurrencyCode;
}

/** Slide in filter drawer shown below the large breakpoint. */
export function MobileFilterDrawer({
  categories,
  state,
  currency,
}: MobileFilterDrawerProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="lg:hidden">
          <SlidersHorizontalIcon aria-hidden="true" className="size-4" />
          Filters
        </Button>
      </DialogTrigger>
      <DialogContent
        className="fixed inset-y-0 right-0 left-auto h-full w-full max-w-sm translate-x-0 translate-y-0 grid-rows-[auto_1fr] gap-0 overflow-hidden rounded-none border-y-0 border-r-0 p-0 sm:max-w-sm"
        aria-label="Product filters"
        // The drawer header renders its own labelled "Close filters" button.
        showCloseButton={false}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <DialogTitle className="font-heading text-lg font-bold">
            Filters
          </DialogTitle>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close filters"
              className="size-11"
            >
              <XIcon aria-hidden="true" className="size-5" />
            </Button>
          </DialogClose>
        </div>
        <div className="overflow-y-auto p-5">
          <CatalogFilterForm
            categories={categories}
            state={state}
            currency={currency}
            idPrefix="mobile"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
