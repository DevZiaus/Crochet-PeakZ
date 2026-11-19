"use client";

import { useState } from "react";
import type {
  CurrencyCode,
  ProductDetailDto,
  ProductVariantDto,
} from "@crochet-peakz/shared";
import {
  calculateVariantPrice,
  getLeadTimeLabel,
  getStockLabel,
} from "@crochet-peakz/shared";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/components/price-display";
import { Button } from "@/components/ui/button";
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
 * Variant selection, live price, stock and lead time labels, and the disabled
 * add to cart button. Lead time stays at product level.
 */
export function PurchasePanel({ product, currency }: PurchasePanelProps) {
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
        <Button type="button" disabled className="w-full">
          Add to cart
        </Button>
        <p className="text-sm text-muted-foreground">
          Cart is coming soon. You can still explore the full collection or ask
          for a custom piece.
        </p>
      </div>
    </div>
  );
}
