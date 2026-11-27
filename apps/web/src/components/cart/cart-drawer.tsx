"use client";

import Link from "next/link";
import { XIcon } from "lucide-react";
import {
  calculateCartLineTotal,
  calculateCartSubtotal,
} from "@crochet-peakz/shared";
import { useCurrency } from "@/components/currency/currency-provider";
import { formatPrice } from "@/components/price-display";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCart } from "@/components/cart/cart-provider";

/**
 * Minimal Milestone 1 shopping cart drawer proving the visitor thread end to
 * end (live quoted lines, active currency subtotal, polite announcements).
 * Upgraded to the full Sheet surface in Milestone 2.
 */
export function CartDrawer() {
  const {
    lines,
    loading,
    loadError,
    drawerOpen,
    closeDrawer,
    refreshCart,
    removeItem,
    announcement,
    drawerTriggerEl,
  } = useCart();
  const currency = useCurrency();
  const subtotal = calculateCartSubtotal(lines, currency);

  return (
    <Dialog
      open={drawerOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeDrawer();
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="fixed inset-y-0 right-0 left-auto z-50 flex h-full w-full max-w-md translate-x-0 translate-y-0 flex-col rounded-none border-y-0 border-r-0 border-l border-border bg-card p-0 shadow-lg outline-none sm:max-w-md"
        onCloseAutoFocus={(event) => {
          if (drawerTriggerEl) {
            event.preventDefault();
            drawerTriggerEl.focus();
          }
        }}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-6">
          <DialogTitle className="font-heading text-xl font-semibold text-foreground">
            Shopping cart
          </DialogTitle>
          <DialogDescription className="sr-only">
            Review items in your shopping cart.
          </DialogDescription>
          <Button
            variant="ghost"
            size="icon"
            onClick={closeDrawer}
            aria-label="Close shopping cart"
            className="min-h-[44px] min-w-[44px]"
          >
            <XIcon className="size-5" aria-hidden="true" />
          </Button>
        </div>

        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {announcement}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">
              Loading your cart...
            </p>
          ) : loadError ? (
            <div className="space-y-3 py-8 text-center">
              <p className="text-sm text-foreground">
                We couldn&apos;t load your cart right now
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void refreshCart();
                }}
              >
                Try again
              </Button>
            </div>
          ) : lines.length === 0 ? (
            <div className="space-y-4 py-12 text-center">
              <p className="text-base font-medium text-foreground">
                Your cart is empty
              </p>
              <Button asChild>
                <Link href="/shop" onClick={closeDrawer}>
                  Continue shopping
                </Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {lines.map((line) => {
                const unitPrice =
                  currency === "BDT" ? line.unitPriceBdt : line.unitPriceUsd;
                const lineTotal =
                  unitPrice !== null
                    ? calculateCartLineTotal(unitPrice, line.quantity)
                    : null;

                return (
                  <li
                    key={line.variantId}
                    className="flex items-start justify-between gap-4 py-4"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-medium text-foreground">
                        {line.title ?? "Unavailable item"}
                      </p>
                      {line.variantLabel ? (
                        <p className="text-xs text-muted-foreground">
                          {line.variantLabel}
                        </p>
                      ) : null}
                      <p className="text-sm text-muted-foreground">
                        Qty {line.quantity}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {lineTotal !== null
                          ? formatPrice(lineTotal, currency)
                          : "Unavailable"}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove ${line.title ?? "Unavailable item"} from cart`}
                        onClick={() => {
                          void removeItem(line.variantId);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {lines.length > 0 && !loadError ? (
          <div className="space-y-3 border-t border-border px-6 py-4">
            <div className="flex items-center justify-between text-base font-semibold text-foreground">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal, currency)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Shipping and any discounts are calculated at checkout
            </p>
            <Button type="button" disabled className="w-full">
              Checkout
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Checkout is coming soon
            </p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
