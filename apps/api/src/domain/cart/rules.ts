import { isVisibleProduct, pickPrimaryImage } from "../catalog/rules.js";
import type { CatalogProductType } from "../catalog/types.js";
import {
  CART_EXPIRY_MS,
  CART_MAX_LINE_QUANTITY,
  CART_MAX_LINES,
  type ApplyAddResult,
  type ApplySetQuantityResult,
  type CartAdjustment,
  type CartCatalogLookup,
  type CartLineInput,
  type CartProductSnapshot,
  type CartVariantSnapshot,
  type MergeLinesResult,
  type ResolvedCartLine,
} from "./types.js";

/**
 * Checks whether a product type can be held in the shopping cart.
 *
 * Only `STANDARD` and `ONE_OF_A_KIND` are cartable in Slice 1.
 *
 * @param productType Product type to inspect.
 * @returns True when cartable.
 */
export function isCartableType(productType: CatalogProductType): boolean {
  return productType === "STANDARD" || productType === "ONE_OF_A_KIND";
}

/**
 * Checks whether a cart has been idle long enough to expire (30 days).
 *
 * @param updatedAt Timestamp of the last write to the cart.
 * @param now Current clock time.
 * @returns True when the cart should be cleared lazily.
 */
export function isCartExpired(updatedAt: Date, now: Date): boolean {
  return now.getTime() - updatedAt.getTime() >= CART_EXPIRY_MS;
}

/**
 * Formats a variant's display label from its non null attributes.
 *
 * Joins `colorName`, `sizeLabel`, and `yarnType` with `" · "`; returns
 * `"Standard"` when all attributes are null or blank.
 *
 * @param variant Variant attribute fields.
 * @returns Human readable variant label.
 */
export function formatVariantLabel(
  variant: Pick<CartVariantSnapshot, "colorName" | "sizeLabel" | "yarnType">,
): string {
  const parts = [variant.colorName, variant.sizeLabel, variant.yarnType]
    .map((part) => part?.trim() ?? "")
    .filter((part) => part.length > 0);

  return parts.length > 0 ? parts.join(" · ") : "Standard";
}

/**
 * Computes the live maximum quantity allowed for a product/variant pair.
 *
 * Returns `0` when the product or variant is missing, mismatched, inactive,
 * soft deleted, an unsupported type, or out of stock. `ONE_OF_A_KIND` is
 * capped at `1`; `STANDARD` is capped at `min(stockQuantity, 10)`.
 *
 * @param product Live product snapshot, or `null`.
 * @param variant Live variant snapshot, or `null`.
 * @param expectedProductId Product id recorded on the cart line.
 * @returns Maximum allowed quantity (`0..10`).
 */
export function maxQuantityFor(
  product: Pick<
    CartProductSnapshot,
    "id" | "productType" | "isActive" | "deletedAt"
  > | null,
  variant: Pick<CartVariantSnapshot, "productId" | "stockQuantity"> | null,
  expectedProductId: string,
): number {
  if (
    product === null ||
    variant === null ||
    product.id !== expectedProductId ||
    variant.productId !== expectedProductId
  ) {
    return 0;
  }

  if (!isVisibleProduct(product) || !isCartableType(product.productType)) {
    return 0;
  }

  if (variant.stockQuantity <= 0) {
    return 0;
  }

  if (product.productType === "ONE_OF_A_KIND") {
    return Math.min(variant.stockQuantity, 1);
  }

  return Math.min(variant.stockQuantity, CART_MAX_LINE_QUANTITY);
}

/**
 * Resolves one cart line against live catalog snapshots.
 *
 * Computes live status (`OK`, `LOWERED`, `OUT_OF_STOCK`, `UNAVAILABLE`),
 * lowered quantity, `maxQuantity`, variant label, and dual currency unit
 * prices. Product fields are `null` only when the `Product` row is missing;
 * variant label and unit prices are `null` whenever the variant is missing or
 * belongs to a different product.
 *
 * @param line Cart line input.
 * @param lookup Live product and variant lookup maps.
 * @returns Resolved line domain object.
 */
export function resolveLine(
  line: CartLineInput,
  lookup: CartCatalogLookup,
): ResolvedCartLine {
  const product = lookup.productsById.get(line.productId) ?? null;
  const variant = lookup.variantsById.get(line.variantId) ?? null;
  const variantMatches =
    product !== null && variant !== null && variant.productId === product.id;
  const productSellable =
    product !== null &&
    isVisibleProduct(product) &&
    isCartableType(product.productType);

  const primaryImage = product ? pickPrimaryImage(product.images) : null;
  const slug = product ? product.slug : null;
  const title = product ? product.title : null;
  const productType = product ? product.productType : null;
  const primaryImagePublicId = primaryImage ? primaryImage.imageUrl : null;
  const primaryImageAlt = primaryImage ? primaryImage.altText : null;

  const variantLabel = variantMatches ? formatVariantLabel(variant) : null;
  const unitPriceBdt = variantMatches
    ? calculateUnitPrice(product.priceBdt, variant.additionalPriceBdt)
    : null;
  const unitPriceUsd = variantMatches
    ? calculateUnitPrice(product.priceUsd, variant.additionalPriceUsd)
    : null;

  if (!productSellable || !variantMatches) {
    return {
      productId: line.productId,
      variantId: line.variantId,
      slug,
      title,
      primaryImagePublicId,
      primaryImageAlt,
      variantLabel,
      productType,
      unitPriceBdt,
      unitPriceUsd,
      quantity: line.quantity,
      maxQuantity: 0,
      status: "UNAVAILABLE",
      addedAt: line.addedAt,
    };
  }

  const maxQuantity = maxQuantityFor(product, variant, line.productId);
  if (maxQuantity === 0) {
    return {
      productId: line.productId,
      variantId: line.variantId,
      slug,
      title,
      primaryImagePublicId,
      primaryImageAlt,
      variantLabel,
      productType,
      unitPriceBdt,
      unitPriceUsd,
      quantity: line.quantity,
      maxQuantity: 0,
      status: "OUT_OF_STOCK",
      addedAt: line.addedAt,
    };
  }

  if (line.quantity > maxQuantity) {
    return {
      productId: line.productId,
      variantId: line.variantId,
      slug,
      title,
      primaryImagePublicId,
      primaryImageAlt,
      variantLabel,
      productType,
      unitPriceBdt,
      unitPriceUsd,
      quantity: maxQuantity,
      maxQuantity,
      status: "LOWERED",
      addedAt: line.addedAt,
    };
  }

  return {
    productId: line.productId,
    variantId: line.variantId,
    slug,
    title,
    primaryImagePublicId,
    primaryImageAlt,
    variantLabel,
    productType,
    unitPriceBdt,
    unitPriceUsd,
    quantity: line.quantity,
    maxQuantity,
    status: "OK",
    addedAt: line.addedAt,
  };
}

/**
 * Sorts lines newest first by `addedAt` descending, breaking ties by
 * `variantId` ascending so ordering is deterministic.
 *
 * @param lines Cart lines to order.
 * @returns New sorted array.
 */
export function sortLinesNewestFirst<
  T extends { addedAt: Date; variantId: string },
>(lines: readonly T[]): T[] {
  return [...lines].sort((left, right) => {
    const timeDiff = right.addedAt.getTime() - left.addedAt.getTime();
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return left.variantId < right.variantId
      ? -1
      : left.variantId > right.variantId
        ? 1
        : 0;
  });
}

/**
 * Applies an add to cart attempt against the existing cart lines.
 *
 * Outcomes are evaluated strictly in spec order:
 * 1. `UNAVAILABLE` when product/variant is missing, mismatched, inactive, soft
 *    deleted, unsupported type, or out of stock (`maxQuantity === 0`).
 * 2. `CART_FULL` when the variant is not yet in the cart and the cart already
 *    holds 20 lines.
 * 3. `AT_LIMIT` when the existing line is already at or above `maxQuantity`.
 * 4. `ADDED` otherwise (adds 1 for a new line, or increments existing by 1
 *    without changing `addedAt`).
 *
 * @param existingLines Current persisted cart lines.
 * @param target Target product and variant ids to add.
 * @param lookup Live catalog lookup.
 * @param now Current clock time used as `addedAt` for new lines.
 * @returns Outcome, change flag, and next lines.
 */
export function applyAdd(
  existingLines: readonly CartLineInput[],
  target: { productId: string; variantId: string },
  lookup: CartCatalogLookup,
  now: Date,
): ApplyAddResult {
  const product = lookup.productsById.get(target.productId) ?? null;
  const variant = lookup.variantsById.get(target.variantId) ?? null;
  const maxQuantity = maxQuantityFor(product, variant, target.productId);

  if (maxQuantity === 0) {
    return {
      outcome: "UNAVAILABLE",
      changed: false,
      nextLines: [...existingLines],
      mutatedLine: null,
    };
  }

  const existingIndex = existingLines.findIndex(
    (line) => line.variantId === target.variantId,
  );

  if (existingIndex === -1) {
    if (existingLines.length >= CART_MAX_LINES) {
      return {
        outcome: "CART_FULL",
        changed: false,
        nextLines: [...existingLines],
        mutatedLine: null,
      };
    }

    const addedLine: CartLineInput = {
      productId: target.productId,
      variantId: target.variantId,
      quantity: 1,
      addedAt: now,
    };

    return {
      outcome: "ADDED",
      changed: true,
      nextLines: sortLinesNewestFirst([...existingLines, addedLine]),
      mutatedLine: addedLine,
    };
  }

  const existing = existingLines[existingIndex];
  if (existing === undefined) {
    return {
      outcome: "UNAVAILABLE",
      changed: false,
      nextLines: [...existingLines],
      mutatedLine: null,
    };
  }
  if (existing.quantity >= maxQuantity) {
    if (existing.quantity > maxQuantity) {
      const clampedLine: CartLineInput = {
        ...existing,
        quantity: maxQuantity,
      };
      const nextLines = existingLines.map((line, index) =>
        index === existingIndex ? clampedLine : line,
      );
      return {
        outcome: "AT_LIMIT",
        changed: true,
        nextLines: sortLinesNewestFirst(nextLines),
        mutatedLine: clampedLine,
      };
    }

    return {
      outcome: "AT_LIMIT",
      changed: false,
      nextLines: [...existingLines],
      mutatedLine: null,
    };
  }

  const incrementedLine: CartLineInput = {
    ...existing,
    quantity: existing.quantity + 1,
  };
  const nextLines = existingLines.map((line, index) =>
    index === existingIndex ? incrementedLine : line,
  );

  return {
    outcome: "ADDED",
    changed: true,
    nextLines: sortLinesNewestFirst(nextLines),
    mutatedLine: incrementedLine,
  };
}

/**
 * Validates and clamps a direct quantity edit on an existing cart line.
 *
 * @param existingLines Current persisted cart lines.
 * @param variantId Target variant id to update.
 * @param requestedQuantity Requested positive integer quantity (`1..10`).
 * @param lookup Live catalog lookup.
 * @returns `NOT_FOUND`, `UNAVAILABLE`, `OK`, or `LOWERED` with adjustment.
 */
export function applySetQuantity(
  existingLines: readonly CartLineInput[],
  variantId: string,
  requestedQuantity: number,
  lookup: CartCatalogLookup,
): ApplySetQuantityResult {
  const existing = existingLines.find((line) => line.variantId === variantId);
  if (!existing) {
    return { kind: "NOT_FOUND" };
  }

  const product = lookup.productsById.get(existing.productId) ?? null;
  const variant = lookup.variantsById.get(existing.variantId) ?? null;
  const maxQuantity = maxQuantityFor(product, variant, existing.productId);

  if (maxQuantity === 0) {
    return { kind: "UNAVAILABLE" };
  }

  if (requestedQuantity > maxQuantity) {
    return {
      kind: "LOWERED",
      nextQuantity: maxQuantity,
      adjustment: {
        variantId,
        title: product?.title ?? null,
        kind: "LOWERED",
        quantity: maxQuantity,
      },
    };
  }

  return { kind: "OK", nextQuantity: requestedQuantity };
}

/**
 * Merges visitor browser lines into an existing account cart.
 *
 * Existing account lines keep their slots first. Visitor lines are processed
 * newest first (`addedAt` descending, clamped to `<= now`). Matching variants
 * sum and clamp to `maxQuantity`. New visitor lines that are invalid, zero
 * stock, or exceed the 20 line limit are dropped and reported in `adjustments`.
 *
 * @param accountLines Existing account cart lines (after lazy expiry).
 * @param visitorLines Incoming browser cart lines.
 * @param lookup Live catalog lookup covering both carts.
 * @param now Current clock time for clamping visitor `addedAt`.
 * @returns Merged lines (newest first) and adjustments.
 */
export function mergeLines(
  accountLines: readonly CartLineInput[],
  visitorLines: readonly CartLineInput[],
  lookup: CartCatalogLookup,
  now: Date,
): MergeLinesResult {
  const merged = new Map<string, CartLineInput>();
  const adjustments: CartAdjustment[] = [];
  const adjustedVariants = new Set<string>();

  for (const line of accountLines) {
    merged.set(line.variantId, { ...line });
  }

  const orderedVisitorLines = sortLinesNewestFirst(visitorLines);

  for (const visitorLine of orderedVisitorLines) {
    const product = lookup.productsById.get(visitorLine.productId) ?? null;
    const variant = lookup.variantsById.get(visitorLine.variantId) ?? null;
    const variantMatches =
      product !== null && variant !== null && variant.productId === product.id;
    const productSellable =
      product !== null &&
      isVisibleProduct(product) &&
      isCartableType(product.productType);
    const maxQuantity = maxQuantityFor(product, variant, visitorLine.productId);
    const existing = merged.get(visitorLine.variantId);

    if (existing) {
      if (!productSellable || !variantMatches) {
        adjustments.push({
          variantId: visitorLine.variantId,
          title: product?.title ?? null,
          kind: "UNAVAILABLE",
          quantity: 0,
        });
        adjustedVariants.add(visitorLine.variantId);
        continue;
      }

      if (maxQuantity === 0) {
        adjustments.push({
          variantId: visitorLine.variantId,
          title: product.title,
          kind: "OUT_OF_STOCK",
          quantity: 0,
        });
        adjustedVariants.add(visitorLine.variantId);
        continue;
      }

      const combined = existing.quantity + visitorLine.quantity;
      if (combined > maxQuantity) {
        existing.quantity = maxQuantity;
        const kind =
          variant.stockQuantity < combined &&
          variant.stockQuantity <= maxQuantity &&
          product.productType !== "ONE_OF_A_KIND" &&
          variant.stockQuantity < CART_MAX_LINE_QUANTITY
            ? "LOWERED"
            : "CAPPED";
        adjustments.push({
          variantId: visitorLine.variantId,
          title: product.title,
          kind,
          quantity: maxQuantity,
        });
        adjustedVariants.add(visitorLine.variantId);
      } else {
        existing.quantity = combined;
      }
      continue;
    }

    if (!productSellable || !variantMatches) {
      adjustments.push({
        variantId: visitorLine.variantId,
        title: product?.title ?? null,
        kind: "UNAVAILABLE",
        quantity: 0,
      });
      continue;
    }

    if (maxQuantity === 0) {
      adjustments.push({
        variantId: visitorLine.variantId,
        title: product.title,
        kind: "OUT_OF_STOCK",
        quantity: 0,
      });
      continue;
    }

    if (merged.size >= CART_MAX_LINES) {
      adjustments.push({
        variantId: visitorLine.variantId,
        title: product.title,
        kind: "DROPPED_CART_FULL",
        quantity: 0,
      });
      continue;
    }

    const clampedQty = Math.min(visitorLine.quantity, maxQuantity);
    const clampedAddedAt =
      visitorLine.addedAt.getTime() > now.getTime() ? now : visitorLine.addedAt;

    merged.set(visitorLine.variantId, {
      productId: visitorLine.productId,
      variantId: visitorLine.variantId,
      quantity: clampedQty,
      addedAt: clampedAddedAt,
    });

    if (clampedQty < visitorLine.quantity) {
      const kind =
        variant.stockQuantity < visitorLine.quantity &&
        product.productType !== "ONE_OF_A_KIND" &&
        variant.stockQuantity < CART_MAX_LINE_QUANTITY
          ? "LOWERED"
          : "CAPPED";
      adjustments.push({
        variantId: visitorLine.variantId,
        title: product.title,
        kind,
        quantity: clampedQty,
      });
      adjustedVariants.add(visitorLine.variantId);
    }
  }

  // Also ensure any existing untouched account lines respect live stock if
  // stock dropped below their saved quantity (while leaving 0-stock/unavailable
  // account rows intact for the shopper to see and remove).
  for (const line of merged.values()) {
    if (adjustedVariants.has(line.variantId)) {
      continue;
    }
    const product = lookup.productsById.get(line.productId) ?? null;
    const variant = lookup.variantsById.get(line.variantId) ?? null;
    const maxQuantity = maxQuantityFor(product, variant, line.productId);
    if (maxQuantity >= 1 && line.quantity > maxQuantity) {
      line.quantity = maxQuantity;
      adjustments.push({
        variantId: line.variantId,
        title: product?.title ?? null,
        kind: "LOWERED",
        quantity: maxQuantity,
      });
    }
  }

  return {
    nextLines: sortLinesNewestFirst([...merged.values()]),
    adjustments,
  };
}

/**
 * Adds a variant additional price to a base price, rounded to two decimals.
 *
 * Kept local to the domain layer so domain maintains zero external imports.
 */
function calculateUnitPrice(
  basePrice: number,
  additionalPrice: number,
): number {
  return Math.round((basePrice + additionalPrice) * 100) / 100;
}
