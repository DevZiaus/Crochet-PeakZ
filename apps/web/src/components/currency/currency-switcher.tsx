"use client";

import { useRef } from "react";
import type { CurrencyCode } from "@crochet-peakz/shared";
import { useCurrencySwitch } from "@/components/currency/currency-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CURRENCY_OPTIONS, currencyLabels } from "@/lib/currency/labels";

/**
 * Header currency dropdown menu (shown at `sm` and wider on storefront pages).
 *
 * Reads the active currency from `CurrencyProvider`, lists both supported
 * currencies as radio items with a check mark on the active one, and calls
 * `switchCurrency` on selection (AC-1, AC-2, AC-9).
 */
export function CurrencySwitcher() {
  const { currency, isPending, switchCurrency } = useCurrencySwitch();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const currentLabel = currencyLabels[currency];

  const handleSelect = (nextCurrency: CurrencyCode): void => {
    if (nextCurrency === currency) {
      return;
    }

    switchCurrency(nextCurrency, triggerRef.current);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          ref={triggerRef}
          variant="ghost"
          size="sm"
          disabled={isPending}
          aria-busy={isPending ? "true" : undefined}
          className="hidden min-h-11 text-xs font-semibold text-muted-foreground hover:text-foreground sm:inline-flex"
          aria-label={currentLabel.triggerAriaLabel}
        >
          {currentLabel.shortLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuRadioGroup value={currency}>
          {CURRENCY_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option}
              value={option}
              disabled={isPending}
              className="min-h-11 cursor-pointer"
              onSelect={() => {
                handleSelect(option);
              }}
            >
              {currencyLabels[option].optionLabel}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
