import type { ProductType } from "../types/index.js";

/** Live validation status computed for one cart line on every read. */
export type CartLineStatus = "OK" | "LOWERED" | "OUT_OF_STOCK" | "UNAVAILABLE";

/** Reason a cart line was changed or dropped during an update or merge. */
export type CartAdjustmentKind =
  "LOWERED" | "CAPPED" | "OUT_OF_STOCK" | "UNAVAILABLE" | "DROPPED_CART_FULL";

/** Outcome returned by `POST /api/cart/items` on valid input. */
export type AddOutcome = "ADDED" | "AT_LIMIT" | "CART_FULL" | "UNAVAILABLE";

/**
 * Live resolved cart line returned by quote and account cart endpoints.
 *
 * Product fields are `null` when the `Product` row is missing; `variantLabel`
 * and unit prices are also `null` whenever `status === "UNAVAILABLE"` due to a
 * missing or mismatched variant.
 */
export interface CartLineDto {
  /** Product UUID. */
  productId: string;
  /** Variant UUID. */
  variantId: string;
  /** Product URL slug, or `null` when the product row is missing. */
  slug: string | null;
  /** Product title, or `null` when the product row is missing. */
  title: string | null;
  /** Primary image delivery URL, or `null` when unavailable. */
  imageUrl: string | null;
  /** Primary image alt text, or `null`. */
  imageAlt: string | null;
  /** Formatted variant label (or `"Standard"`), or `null` when variant is missing/mismatched. */
  variantLabel: string | null;
  /** Product type, or `null` when the product row is missing. */
  productType: ProductType | null;
  /** Live unit price in BDT, or `null` when variant is missing/mismatched. */
  unitPriceBdt: number | null;
  /** Live unit price in USD, or `null` when variant is missing/mismatched. */
  unitPriceUsd: number | null;
  /** Effective quantity after lowering. */
  quantity: number;
  /** Maximum quantity currently allowed for this line (`0` when unavailable or out of stock). */
  maxQuantity: number;
  /** Computed live line status. */
  status: CartLineStatus;
  /** ISO timestamp when this line was first added (used for newest first ordering). */
  addedAt: string;
}

/** One item level adjustment reported on quantity clamp or sign in merge. */
export interface CartAdjustmentDto {
  /** Variant UUID affected by the adjustment. */
  variantId: string;
  /** Product title if known, otherwise `null`. */
  title: string | null;
  /** Kind of adjustment applied. */
  kind: CartAdjustmentKind;
  /** Kept clamped count for `LOWERED`/`CAPPED`, or `0` for dropped items. */
  quantity: number;
}

/** Full cart response payload for account cart operations. */
export interface CartDto {
  /** Live resolved lines ordered newest first by `addedAt`. */
  lines: CartLineDto[];
  /** Adjustments made during this call, empty when nothing changed. */
  adjustments: CartAdjustmentDto[];
}

/** Response envelope returned by `POST /api/cart/quote`. */
export interface CartQuoteResponse {
  /** Resolved cart lines. */
  data: {
    lines: CartLineDto[];
  };
}

/** Response envelope returned by account cart read, update, remove, clear, and merge endpoints. */
export interface CartResponse {
  /** Account cart DTO. */
  data: CartDto;
}

/** Response envelope returned by `POST /api/cart/items`. */
export interface CartAddItemResponse {
  /** Account cart DTO after the add attempt. */
  data: CartDto;
  /** Outcome describing whether the add succeeded or hit a limit. */
  outcome: AddOutcome;
}
