"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type {
  CurrencyCode,
  ProductDetailDto,
  ProductVariantDto,
} from "@crochet-peakz/shared";
import {
  calculateVariantPrice,
  getLeadTimeLabel,
  getStockLabel,
  isCartableProductType,
} from "@crochet-peakz/shared";
import { cn } from "@/lib/utils";
import { useOptionalCart } from "@/components/cart/cart-provider";
import { formatPrice } from "@/components/price-display";
import { Button } from "@/components/ui/button";
import { getDisabledCartTypeNote } from "@/lib/cart/labels";
import {
  chooseOption,
  getInitialVariant,
  getVariantGroups,
  isOptionAvailable,
  selectionFromVariant,
  type VariantDimension,
  type VariantSelection,
} from "@/lib/catalog/variant-selection";

/** Props for the product purchase panel. */
export interface PurchasePanelProps {
  product: ProductDetailDto;
  currency: CurrencyCode;
}

/**
 * Variant selection, live price, stock and lead time labels, and the Add to
 * cart button. Lead time stays at product level.
 */
export function PurchasePanel({ product, currency }: PurchasePanelProps) {
  const cart = useOptionalCart();
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const initial = getInitialVariant(product.variants);
  const [selectedId, setSelectedId] = useState<string | null>(
    initial?.id ?? null,
  );
  const [selection, setSelection] = useState<VariantSelection | null>(
    initial === null ? null : selectionFromVariant(initial),
  );

  const selectedVariant: ProductVariantDto | null =
    product.variants.find((variant) => variant.id === selectedId) ?? null;
  const groups = getVariantGroups(product.variants);
  const basePrice = currency === "BDT" ? product.priceBdt : product.priceUsd;
  const additionalPrice =
    selectedVariant === null
      ? 0
      : currency === "BDT"
        ? selectedVariant.additionalPriceBdt
        : selectedVariant.additionalPriceUsd;
  const price = calculateVariantPrice(basePrice, additionalPrice);
  const available = selectedVariant?.inStock ?? product.inStock;
  const stockLabel = getStockLabel(
    product.productType,
    selectedVariant?.stockQuantity ?? 0,
  );
  const leadTimeLabel = getLeadTimeLabel(product.leadTimeDays);

  const cartableType = isCartableProductType(product.productType);
  const disabledTypeNote = getDisabledCartTypeNote(product.productType);
  const variantInStock =
    selectedVariant !== null && selectedVariant.stockQuantity > 0;
  const isAdding =
    cart !== null &&
    selectedVariant !== null &&
    cart.addingVariantId === selectedVariant.id;
  const canAdd = cartableType && variantInStock && !isAdding;
  const buttonLabel = isAdding
    ? "Adding..."
    : cartableType && !variantInStock
      ? "Out of stock"
      : "Add to cart";

  function handleChoose(dimension: VariantDimension, option: string | null) {
    if (selection === null) {
      return;
    }
    const result = chooseOption(product.variants, selection, dimension, option);
    if (result === null) {
      return;
    }
    setSelection(result.selection);
    setSelectedId(result.variant.id);
  }

  function handleAddToCart() {
    if (!canAdd || cart === null) {
      return;
    }
    void cart.addItem({
      productId: product.id,
      variantId: selectedVariant.id,
      title: product.title,
      triggerEl: addButtonRef.current,
    });
  }

  return (
    <div className="space-y-6">
      <div aria-live="polite" aria-atomic="true">
        <p className="text-2xl font-semibold text-foreground">
          {formatPrice(price, currency)}
        </p>
        <p
          className={cn(
            "mt-1 text-sm font-medium",
            available ? "text-success" : "text-muted-foreground",
          )}
        >
          {stockLabel}
        </p>
      </div>

      <p className="text-sm text-muted-foreground">{leadTimeLabel}</p>

      {groups.map((group) => (
        <fieldset key={group.dimension}>
          <legend className="mb-3 text-sm font-semibold text-foreground">
            {group.label}
          </legend>
          <div className="flex flex-wrap gap-2">
            {group.options.map((option) => {
              const checked = selection?.[group.dimension] === option.value;
              const optionAvailable =
                selection === null
                  ? false
                  : isOptionAvailable(
                      product.variants,
                      selection,
                      group.dimension,
                      option.value,
                    );
              const swatch =
                group.dimension === "color" && option.value !== null
                  ? (product.variants.find(
                      (variant) =>
                        variant.colorName === option.value &&
                        variant.colorHex !== null,
                    )?.colorHex ?? null)
                  : null;

              return (
                <label
                  key={option.value ?? "standard"}
                  className={cn(
                    "relative",
                    optionAvailable ? "cursor-pointer" : "cursor-not-allowed",
                  )}
                >
                  <input
                    type="radio"
                    name={`variant-${group.dimension}`}
                    value={option.value ?? "standard"}
                    checked={checked}
                    disabled={!optionAvailable}
                    onChange={() => {
                      handleChoose(group.dimension, option.value);
                    }}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-md border border-input px-4 py-2 text-sm transition-colors duration-200 motion-reduce:transition-none",
                      "peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary",
                      "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
                      "peer-disabled:opacity-40",
                    )}
                  >
                    {swatch !== null ? (
                      <span
                        aria-hidden="true"
                        className="size-4 rounded-full border border-border"
                        style={{ backgroundColor: swatch }}
                      />
                    ) : null}
                    {option.label}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="space-y-3">
        <Button
          ref={addButtonRef}
          type="button"
          disabled={!canAdd}
          onClick={handleAddToCart}
          className="w-full"
        >
          {isAdding ? (
            <Loader2
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : null}
          {buttonLabel}
        </Button>
        {disabledTypeNote !== null ? (
          <p className="text-sm text-muted-foreground">{disabledTypeNote}</p>
        ) : null}
      </div>
    </div>
  );
}
