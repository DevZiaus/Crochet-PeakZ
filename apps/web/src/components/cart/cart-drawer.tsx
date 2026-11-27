"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { useCurrency } from "@/components/currency/currency-provider";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CartErrorState } from "@/components/cart/cart-error-state";
import { CartLineItem } from "@/components/cart/cart-line-item";
import { CartMergeBanner } from "@/components/cart/cart-merge-banner";
import { CartLinesSkeleton } from "@/components/cart/cart-skeleton";
import { CartSummary } from "@/components/cart/cart-summary";
import { useCart } from "@/components/cart/cart-provider";

/**
 * Slide out shopping cart drawer built on the Shadcn `Sheet` primitive.
 *
 * Traps focus while open, closes on `Escape`, close button, or route change,
 * restores focus to the trigger that opened it, announces cart updates in a
 * polite live region inside the dialog, and renders full loading, error,
 * empty, and populated states (AC-4, AC-5, AC-6, AC-7, AC-14, AC-17).
 */
export function CartDrawer() {
  const pathname = usePathname();
  const previousPathRef = useRef(pathname);
  const {
    lines,
    loading,
    revalidating,
    loadError,
    drawerOpen,
    pendingVariantIds,
    atLimitVariantId,
    mergeAdjustments,
    announcement,
    drawerTriggerEl,
    closeDrawer,
    refreshCart,
    setItemQuantity,
    removeItem,
    dismissMergeBanner,
  } = useCart();
  const currency = useCurrency();

  // Close the drawer automatically whenever the shopper navigates to another route (AC-4).
  useEffect(() => {
    if (previousPathRef.current !== pathname) {
      previousPathRef.current = pathname;
      if (drawerOpen) {
        closeDrawer();
      }
    }
  }, [closeDrawer, drawerOpen, pathname]);

  return (
    <Sheet
      open={drawerOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeDrawer();
        }
      }}
    >
      <SheetContent
        side="right"
        closeLabel="Close shopping cart"
        className="w-full max-w-md p-0"
        onCloseAutoFocus={(event) => {
          if (drawerTriggerEl && document.contains(drawerTriggerEl)) {
            event.preventDefault();
            drawerTriggerEl.focus();
          }
        }}
      >
        <SheetHeader className="pr-16">
          <SheetTitle>Shopping cart</SheetTitle>
          <SheetDescription className="sr-only">
            Review items, adjust quantities, and check live stock and prices in
            your shopping cart.
          </SheetDescription>
        </SheetHeader>

        {/* Polite live region lives inside the modal focus scope when open (AC-1, AC-17). */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {drawerOpen ? announcement : ""}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {mergeAdjustments.length > 0 ? (
            <div className="mb-5">
              <CartMergeBanner
                adjustments={mergeAdjustments}
                onDismiss={dismissMergeBanner}
              />
            </div>
          ) : null}

          {loading ? (
            <CartLinesSkeleton count={3} />
          ) : loadError ? (
            <CartErrorState
              retrying={revalidating}
              onRetry={() => {
                void refreshCart();
              }}
            />
          ) : lines.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              heading="Your cart is empty"
              description="Explore handmade crochet pieces crafted to order and ready to ship."
              className="py-12"
            >
              <Button asChild variant="outline" className="mt-2 min-h-[44px]">
                <Link href="/shop" onClick={closeDrawer}>
                  Continue shopping
                </Link>
              </Button>
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border" aria-label="Cart items">
              {lines.map((line) => (
                <CartLineItem
                  key={line.variantId}
                  line={line}
                  currency={currency}
                  surface="drawer"
                  pending={pendingVariantIds.has(line.variantId)}
                  atLimit={atLimitVariantId === line.variantId}
                  onChangeQuantity={(variantId, quantity) => {
                    void setItemQuantity(variantId, quantity);
                  }}
                  onRemove={(variantId) => {
                    void removeItem(variantId);
                  }}
                  onNavigate={closeDrawer}
                />
              ))}
            </ul>
          )}
        </div>

        {!loading && !loadError && lines.length > 0 ? (
          <SheetFooter>
            <CartSummary
              lines={lines}
              currency={currency}
              surface="drawer"
              onViewCart={closeDrawer}
            />
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
