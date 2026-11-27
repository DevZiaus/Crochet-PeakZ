"use client";

import { Info, XIcon } from "lucide-react";
import type { CartAdjustmentDto } from "@crochet-peakz/shared";
import { Button } from "@/components/ui/button";
import { formatCartAdjustment } from "@/lib/cart/labels";

/** Props for {@link CartMergeBanner}. */
export interface CartMergeBannerProps {
  /** Adjustments returned by the sign in cart merge. */
  adjustments: readonly CartAdjustmentDto[];
  /** Called when the shopper dismisses the banner. */
  onDismiss: () => void;
}

/**
 * Dismissible notice explaining items that were capped, lowered, or removed
 * when a visitor's browser cart merged into their account cart (AC-11).
 */
export function CartMergeBanner({
  adjustments,
  onDismiss,
}: CartMergeBannerProps) {
  if (adjustments.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Cart changes after sign in"
      className="rounded-lg border border-input bg-secondary/60 p-4 text-secondary-foreground"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Info
            className="mt-0.5 size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-foreground">
              Some items in your cart changed when you signed in
            </p>
            <ul className="list-disc space-y-1 pl-4 text-xs text-foreground">
              {adjustments.map((adjustment, index) => (
                <li
                  key={`${adjustment.variantId}-${adjustment.kind}-${String(index)}`}
                >
                  {formatCartAdjustment(adjustment)}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          aria-label="Dismiss cart changes notice"
          className="-mt-1.5 -mr-1.5 min-h-[44px] min-w-[44px] shrink-0"
        >
          <XIcon className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}
