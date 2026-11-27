"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, ShoppingBag, Trash2 } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Container } from "@/components/container";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/components/currency/currency-provider";
import { CartErrorState } from "@/components/cart/cart-error-state";
import { CartLineItem } from "@/components/cart/cart-line-item";
import { CartMergeBanner } from "@/components/cart/cart-merge-banner";
import { CartPageSkeleton } from "@/components/cart/cart-skeleton";
import { CartSummary } from "@/components/cart/cart-summary";
import { ClearCartDialog } from "@/components/cart/clear-cart-dialog";
import { useCart } from "@/components/cart/cart-provider";

/**
 * Full `/cart` storefront page view.
 *
 * Revalidates live stock and prices on render, displays merge notices, item
 * lines with steppers and fallbacks, sticky order summary, empty and error
 * states, and `Clear cart` behind a confirmation dialog (AC-4, AC-7, AC-14,
 * AC-15, AC-17).
 */
export function CartPageContent() {
  const {
    hydrated,
    itemCount,
    lines,
    loading,
    revalidating,
    loadError,
    pendingVariantIds,
    clearing,
    atLimitVariantId,
    mergeAdjustments,
    refreshCart,
    setItemQuantity,
    removeItem,
    clearCart,
    dismissMergeBanner,
  } = useCart();
  const currency = useCurrency();
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  // Revalidate every time the shopper lands on /cart (AC-7).
  useEffect(() => {
    if (!hydrated) {
      return;
    }
    void refreshCart();
  }, [hydrated, refreshCart]);

  const itemSummaryText =
    !hydrated || loading
      ? "Checking live availability and prices..."
      : itemCount === 0
        ? "No items yet"
        : itemCount === 1
          ? "1 item in your cart"
          : `${String(itemCount)} items in your cart`;

  async function handleConfirmClear(): Promise<void> {
    const cleared = await clearCart();
    if (cleared) {
      setClearDialogOpen(false);
    }
  }

  return (
    <Section className="py-8 sm:py-12">
      <Container>
        <div className="mb-4">
          <Breadcrumbs items={[{ label: "Shopping cart" }]} />
        </div>

        <PageHeader title="Your cart" description={itemSummaryText}>
          {!loading && !loadError && lines.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              disabled={clearing}
              onClick={() => {
                setClearDialogOpen(true);
              }}
              className="min-h-[44px]"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Clear cart
            </Button>
          ) : null}
        </PageHeader>

        {mergeAdjustments.length > 0 ? (
          <div className="mb-6">
            <CartMergeBanner
              adjustments={mergeAdjustments}
              onDismiss={dismissMergeBanner}
            />
          </div>
        ) : null}

        {!hydrated || loading ? (
          <CartPageSkeleton />
        ) : loadError ? (
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <CartErrorState
              retrying={revalidating}
              onRetry={() => {
                void refreshCart();
              }}
            />
          </div>
        ) : lines.length === 0 ? (
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <EmptyState
              icon={ShoppingBag}
              heading="Your cart is empty"
              description="Discover handcrafted crochet amigurumi, wearables, and one of a kind treasures."
              action={{
                label: "Continue shopping",
                href: "/shop",
              }}
            />
          </div>
        ) : (
          <div className="grid items-start gap-8 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-8">
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <ul className="divide-y divide-border" aria-label="Cart items">
                  {lines.map((line) => (
                    <CartLineItem
                      key={line.variantId}
                      line={line}
                      currency={currency}
                      surface="page"
                      pending={pendingVariantIds.has(line.variantId)}
                      atLimit={atLimitVariantId === line.variantId}
                      onChangeQuantity={(variantId, quantity) => {
                        void setItemQuantity(variantId, quantity);
                      }}
                      onRemove={(variantId) => {
                        void removeItem(variantId);
                      }}
                    />
                  ))}
                </ul>
              </div>

              <div>
                <Link
                  href="/shop"
                  className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-primary transition-colors duration-200 hover:underline motion-reduce:transition-none"
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Continue shopping
                </Link>
              </div>
            </div>

            <aside
              aria-label="Order summary"
              className="space-y-4 lg:sticky lg:top-24 lg:col-span-4"
            >
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <CartSummary lines={lines} currency={currency} surface="page" />
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 text-xs text-muted-foreground">
                <ShieldCheck
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <p>
                  Every handmade piece is checked against live stock and priced
                  in your active currency whenever you open your cart.
                </p>
              </div>
            </aside>
          </div>
        )}

        <ClearCartDialog
          open={clearDialogOpen}
          onOpenChange={setClearDialogOpen}
          clearing={clearing}
          onConfirm={handleConfirmClear}
        />
      </Container>
    </Section>
  );
}
