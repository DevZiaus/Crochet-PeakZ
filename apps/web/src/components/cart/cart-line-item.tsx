"use client";

import Link from "next/link";
import { AlertCircle, AlertTriangle, Loader2, Trash2 } from "lucide-react";
import {
  ProductType,
  calculateCartLineTotal,
  type CartLineDto,
  type CurrencyCode,
} from "@crochet-peakz/shared";
import { cn } from "@/lib/utils";
import { ProductImage } from "@/components/product-image";
import { formatPrice } from "@/components/price-display";
import { QuantityStepper } from "@/components/quantity-stepper";
import { Button } from "@/components/ui/button";

/** Props for {@link CartLineItem}. */
export interface CartLineItemProps {
  /** Resolved cart line DTO. */
  line: CartLineDto;
  /** Active display currency. */
  currency: CurrencyCode;
  /** Surface density variant. */
  surface: "drawer" | "page";
  /** True while a quantity or remove call is in flight for this line. */
  pending: boolean;
  /** True when the shopper just clicked Add to cart at this line's maximum (AC-6). */
  atLimit: boolean;
  /** Called when the shopper changes the quantity via the stepper. */
  onChangeQuantity: (variantId: string, quantity: number) => void;
  /** Called when the shopper removes the line. */
  onRemove: (variantId: string) => void;
  /** Optional navigation hook (used by the drawer to close on link click). */
  onNavigate?: () => void;
}

/**
 * Renders one shopping cart line with thumbnail, product link or fallback,
 * variant label, unit price, quantity control, line total, status notices,
 * and remove action (AC-4, AC-5, AC-6, AC-7, AC-13, AC-17).
 */
export function CartLineItem({
  line,
  currency,
  surface,
  pending,
  atLimit,
  onChangeQuantity,
  onRemove,
  onNavigate,
}: CartLineItemProps) {
  const displayTitle = line.title ?? "Unavailable item";
  const productHref =
    line.slug !== null && line.title !== null ? `/shop/${line.slug}` : null;
  const imageAlt = line.imageAlt ?? displayTitle;
  const unitPrice = currency === "BDT" ? line.unitPriceBdt : line.unitPriceUsd;
  const lineTotal =
    unitPrice !== null
      ? calculateCartLineTotal(unitPrice, line.quantity)
      : null;

  const isUnavailable =
    line.status === "OUT_OF_STOCK" || line.status === "UNAVAILABLE";
  const isOneOfAKind = line.productType === ProductType.ONE_OF_A_KIND;
  const showStepper = !isUnavailable && !isOneOfAKind;

  const thumbClasses =
    surface === "drawer"
      ? "relative size-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted"
      : "relative size-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted sm:size-28";

  return (
    <li
      className={cn(
        "flex gap-4 py-5 first:pt-0 last:pb-0",
        isUnavailable && "opacity-85",
      )}
    >
      <div className={thumbClasses}>
        <ProductImage
          src={line.imageUrl}
          alt={imageAlt}
          sizes={surface === "drawer" ? "80px" : "112px"}
        />
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            {productHref !== null ? (
              <Link
                href={productHref}
                onClick={onNavigate}
                className="inline-block text-sm font-semibold text-foreground transition-colors duration-200 hover:text-primary motion-reduce:transition-none sm:text-base"
              >
                {displayTitle}
              </Link>
            ) : (
              <p className="text-sm font-semibold text-foreground sm:text-base">
                {displayTitle}
              </p>
            )}

            {line.variantLabel !== null ? (
              <p className="text-xs text-muted-foreground sm:text-sm">
                {line.variantLabel}
              </p>
            ) : null}

            <p className="text-xs text-muted-foreground sm:text-sm">
              {unitPrice !== null
                ? `${formatPrice(unitPrice, currency)} each`
                : "Unavailable"}
            </p>
          </div>

          <p
            className={cn(
              "shrink-0 text-sm font-semibold tabular-nums sm:text-base",
              isUnavailable
                ? "text-muted-foreground line-through"
                : "text-foreground",
            )}
          >
            {lineTotal !== null
              ? formatPrice(lineTotal, currency)
              : "Unavailable"}
          </p>
        </div>

        {/* Status flags and at-limit inline notices */}
        {line.status === "LOWERED" ? (
          <p className="flex items-center gap-1.5 text-xs font-medium text-highlight sm:text-sm">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            <span>Only {line.quantity} left, quantity lowered</span>
          </p>
        ) : null}

        {line.status === "OUT_OF_STOCK" ? (
          <p className="flex items-center gap-1.5 text-xs font-medium text-destructive sm:text-sm">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            <span>Out of stock</span>
          </p>
        ) : null}

        {line.status === "UNAVAILABLE" ? (
          <p className="flex items-center gap-1.5 text-xs font-medium text-destructive sm:text-sm">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            <span>No longer available</span>
          </p>
        ) : null}

        {atLimit && line.maxQuantity >= 1 ? (
          <p className="flex items-center gap-1.5 text-xs font-medium text-highlight sm:text-sm">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            <span>
              You already have the most we can sell of this item (
              {line.maxQuantity})
            </span>
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div>
            {showStepper ? (
              <QuantityStepper
                value={line.quantity}
                min={1}
                max={Math.max(1, line.maxQuantity)}
                disabled={pending}
                itemTitle={displayTitle}
                onChange={(nextQuantity) => {
                  onChangeQuantity(line.variantId, nextQuantity);
                }}
              />
            ) : isOneOfAKind && !isUnavailable ? (
              <span className="inline-flex min-h-[36px] items-center rounded-full border border-border bg-surface px-3 text-xs font-medium text-foreground">
                Qty 1
              </span>
            ) : null}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            aria-label={`Remove ${displayTitle} from cart`}
            onClick={() => {
              onRemove(line.variantId);
            }}
            className="min-h-[44px] px-3 text-muted-foreground hover:text-destructive"
          >
            {pending ? (
              <Loader2
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <Trash2 className="size-4" aria-hidden="true" />
            )}
            Remove
          </Button>
        </div>
      </div>
    </li>
  );
}
