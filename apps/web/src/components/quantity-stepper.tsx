"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QuantityStepperProps {
  /** The current quantity value. */
  value: number;
  /** Called when the quantity changes. */
  onChange: (value: number) => void;
  /** Minimum allowed value. Defaults to 1. */
  min?: number;
  /** Maximum allowed value. Defaults to 99. */
  max?: number;
  /** Whether the stepper is disabled. */
  disabled?: boolean;
  /** Optional item name used to build item specific accessible labels. */
  itemTitle?: string;
  /** Additional CSS class names. */
  className?: string;
}

/**
 * Increment/decrement stepper for quantity selection.
 * Uses min/max bounds and 44px touch targets on the buttons.
 * Renders the current value in a read only display between the buttons.
 */
function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  disabled = false,
  itemTitle,
  className,
}: QuantityStepperProps) {
  const canDecrement = value > min;
  const canIncrement = value < max;
  const groupLabel = itemTitle
    ? `Quantity for ${itemTitle}`
    : "Quantity selector";
  const decreaseLabel = itemTitle
    ? `Decrease quantity of ${itemTitle}`
    : "Decrease quantity";
  const increaseLabel = itemTitle
    ? `Increase quantity of ${itemTitle}`
    : "Increase quantity";

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-input",
        disabled && "opacity-50",
        className,
      )}
      role="group"
      aria-label={groupLabel}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => {
          onChange(Math.min(max, Math.max(min, value - 1)));
        }}
        disabled={disabled || !canDecrement}
        aria-label={decreaseLabel}
        className="min-h-[44px] min-w-[44px] rounded-r-none border-r border-input"
      >
        <Minus className="size-4" aria-hidden="true" />
      </Button>

      <span
        className="flex min-w-[3rem] items-center justify-center px-3 text-sm font-medium tabular-nums text-foreground"
        aria-live="polite"
        aria-atomic="true"
      >
        {value}
      </span>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => {
          onChange(Math.min(max, Math.max(min, value + 1)));
        }}
        disabled={disabled || !canIncrement}
        aria-label={increaseLabel}
        className="min-h-[44px] min-w-[44px] rounded-l-none border-l border-input"
      >
        <Plus className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

export { QuantityStepper };
export type { QuantityStepperProps };
