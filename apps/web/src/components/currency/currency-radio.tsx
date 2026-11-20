"use client";

import { useCurrencySwitch } from "@/components/currency/currency-provider";
import {
  CURRENCY_DRAWER_LEGEND,
  CURRENCY_OPTIONS,
  currencyLabels,
} from "@/lib/currency/labels";
import { cn } from "@/lib/utils";

/**
 * Mobile navigation drawer currency control (AC-1).
 *
 * Renders a native `<fieldset>` with legend `Currency` and two stacked
 * `<input type="radio">` options, each with at least a 44px touch target.
 */
export function CurrencyRadio() {
  const { currency, isPending, switchCurrency } = useCurrencySwitch();

  return (
    <fieldset
      className="space-y-2"
      disabled={isPending}
      aria-busy={isPending ? "true" : undefined}
    >
      <legend className="text-sm font-medium text-muted-foreground">
        {CURRENCY_DRAWER_LEGEND}
      </legend>
      <div className="flex flex-col gap-1">
        {CURRENCY_OPTIONS.map((option) => {
          const inputId = `drawer-currency-${option.toLowerCase()}`;
          const isChecked = currency === option;

          return (
            <label
              key={option}
              htmlFor={inputId}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 motion-reduce:transition-none",
                isChecked
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <input
                id={inputId}
                type="radio"
                name="drawer-currency"
                value={option}
                checked={isChecked}
                disabled={isPending}
                onChange={(event) => {
                  switchCurrency(option, event.currentTarget);
                }}
                className="size-4 accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
              />
              <span>{currencyLabels[option].optionLabel}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
