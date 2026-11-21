"use client";

import { useRef } from "react";
import { Loader2 } from "lucide-react";
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
 * currencies as radio items with a check mark on the active one, disables with
 * a spinner while a switch is in flight, and restores focus to the trigger
 * after completion (AC-1, AC-2, AC-3, AC-7, AC-8, AC-9).
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
    <DropdownMenu modal={false}>
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
          {isPending ? (
            <Loader2
              className="size-3.5 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : null}
          <span>{currentLabel.shortLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      {/* Disable close animation so Radix FocusScope unmounts immediately on rapid reopen. */}
      <DropdownMenuContent align="end" animateClose={false} className="w-56">
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
