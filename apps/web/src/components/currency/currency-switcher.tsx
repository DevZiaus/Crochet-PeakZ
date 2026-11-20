"use client";

import { useState } from "react";
import { Currency, type CurrencyCode } from "@crochet-peakz/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setCurrency } from "@/lib/currency/actions";
import { CURRENCY_OPTIONS, currencyLabels } from "@/lib/currency/labels";

/** Props for the header currency dropdown switcher. */
export interface CurrencySwitcherProps {
  /** Active currency code, defaults to BDT until the provider is mounted. */
  activeCurrency?: CurrencyCode;
}

/**
 * Header currency dropdown menu (shown at `sm` and wider).
 *
 * Lists both supported currencies as radio items with a check mark on the
 * active one and calls the `setCurrency` Server Action on selection (AC-1,
 * AC-2).
 */
export function CurrencySwitcher({
  activeCurrency = Currency.BDT,
}: CurrencySwitcherProps) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(activeCurrency);
  const currentLabel = currencyLabels[currency];

  const handleSelect = async (nextCurrency: CurrencyCode): Promise<void> => {
    if (nextCurrency === currency) {
      return;
    }

    const result = await setCurrency({ currency: nextCurrency });
    if (result.ok) {
      setCurrencyState(nextCurrency);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
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
              className="min-h-11 cursor-pointer"
              onSelect={() => {
                void handleSelect(option);
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
