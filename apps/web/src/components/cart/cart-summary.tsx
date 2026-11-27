"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import {
  calculateCartSubtotal,
  type CartLineDto,
  type CurrencyCode,
} from "@crochet-peakz/shared";
import { formatPrice } from "@/components/price-display";
import { Button } from "@/components/ui/button";

/** Props for {@link CartSummary}. */
export interface CartSummaryProps {
  /** Live resolved cart lines. */
  lines: readonly CartLineDto[];
  /** Active display currency. */
  currency: CurrencyCode;
  /** Whether this summary is inside the drawer or on the `/cart` page. */
  surface: "drawer" | "page";
  /** Optional handler invoked when navigating to `/cart` from the drawer. */
  onViewCart?: () => void;
}

/**
 * Subtotal, shipping/discount note, unavailable items block reason, disabled
 * Checkout button, and drawer `View cart` link (AC-4, AC-7, AC-8).
 */
export function CartSummary({
  lines,
  currency,
  surface,
  onViewCart,
}: CartSummaryProps) {
  const subtotal = calculateCartSubtotal(lines, currency);
  const hasBlockingItems = lines.some(
    (line) => line.status === "OUT_OF_STOCK" || line.status === "UNAVAILABLE",
  );

  return (
    <div className="space-y-4">
      {surface === "page" ? (
        <h2 className="font-heading text-xl font-semibold text-foreground">
          Order summary
        </h2>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-base font-medium text-foreground">
            Subtotal
          </span>
          <span className="text-lg font-semibold tabular-nums text-foreground">
            {formatPrice(subtotal, currency)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Shipping and any discounts are calculated at checkout
        </p>
      </div>

      <div className="space-y-2.5">
        {hasBlockingItems ? (
          <p className="flex items-center gap-1.5 text-xs font-medium text-destructive sm:text-sm">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            <span>Remove unavailable items to continue</span>
          </p>
        ) : null}

        <Button type="button" disabled className="min-h-[44px] w-full">
          Checkout
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Checkout is coming soon
        </p>

        {surface === "drawer" ? (
          <Button asChild variant="outline" className="min-h-[44px] w-full">
            <Link href="/cart" onClick={onViewCart}>
              View cart
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
