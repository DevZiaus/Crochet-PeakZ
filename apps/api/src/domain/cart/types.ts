import type {
  CatalogImageRecord,
  CatalogProductType,
} from "../catalog/types.js";

/** Maximum number of distinct lines allowed in one cart. */
export const CART_MAX_LINES = 20;

/** Maximum quantity allowed for a single standard cart line. */
export const CART_MAX_LINE_QUANTITY = 10;

/** Number of idle days before a cart expires. */
export const CART_EXPIRY_DAYS = 30;

/** Idle expiry duration in milliseconds. */
export const CART_EXPIRY_MS = CART_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

/** Live validation status computed for one cart line. */
export type CartLineStatus = "OK" | "LOWERED" | "OUT_OF_STOCK" | "UNAVAILABLE";

/** Reason a cart line was lowered, capped, or dropped. */
export type CartAdjustmentKind =
  "LOWERED" | "CAPPED" | "OUT_OF_STOCK" | "UNAVAILABLE" | "DROPPED_CART_FULL";

/** Outcome returned by adding a variant to a cart. */
export type CartAddOutcome = "ADDED" | "AT_LIMIT" | "CART_FULL" | "UNAVAILABLE";

/** Product fields needed by cart domain resolution. */
export interface CartProductSnapshot {
  /** Product UUID. */
  id: string;
  /** Product slug. */
  slug: string;
  /** Display title. */
  title: string;
  /** Product kind. */
  productType: CatalogProductType;
  /** Base price in BDT. */
  priceBdt: number;
  /** Base price in USD. */
  priceUsd: number;
  /** Active flag. */
  isActive: boolean;
  /** Soft delete timestamp, or `null`. */
  deletedAt: Date | null;
  /** Product images (Cloudinary public IDs). */
  images: CatalogImageRecord[];
}

/** Variant fields needed by cart domain resolution. */
export interface CartVariantSnapshot {
  /** Variant UUID. */
  id: string;
  /** Owning product UUID. */
  productId: string;
  /** Color name, or `null`. */
  colorName: string | null;
  /** Size label, or `null`. */
  sizeLabel: string | null;
  /** Yarn type, or `null`. */
  yarnType: string | null;
  /** Current stock quantity. */
  stockQuantity: number;
  /** Additional price in BDT. */
  additionalPriceBdt: number;
  /** Additional price in USD. */
  additionalPriceUsd: number;
}

/** Batch catalog snapshots indexed by product id and variant id. */
export interface CartCatalogLookup {
  /** Products keyed by product id (including inactive/soft deleted rows). */
  productsById: ReadonlyMap<string, CartProductSnapshot>;
  /** Variants keyed by variant id. */
  variantsById: ReadonlyMap<string, CartVariantSnapshot>;
}

/** Stored or submitted cart line before live catalog resolution. */
export interface CartLineInput {
  /** Product UUID. */
  productId: string;
  /** Variant UUID. */
  variantId: string;
  /** Requested or stored quantity. */
  quantity: number;
  /** Timestamp when the line was first added. */
  addedAt: Date;
}

/** Resolved cart line produced by domain rules prior to image URL delivery resolution. */
export interface ResolvedCartLine {
  /** Product UUID. */
  productId: string;
  /** Variant UUID. */
  variantId: string;
  /** Product slug, or `null` when product row is missing. */
  slug: string | null;
  /** Product title, or `null` when product row is missing. */
  title: string | null;
  /** Primary image Cloudinary public ID (or URL), or `null`. */
  primaryImagePublicId: string | null;
  /** Primary image alt text, or `null`. */
  primaryImageAlt: string | null;
  /** Formatted variant label, or `null` when variant is missing/mismatched. */
  variantLabel: string | null;
  /** Product kind, or `null` when product row is missing. */
  productType: CatalogProductType | null;
  /** Unit price in BDT, or `null` when variant is missing/mismatched. */
  unitPriceBdt: number | null;
  /** Unit price in USD, or `null` when variant is missing/mismatched. */
  unitPriceUsd: number | null;
  /** Effective quantity after lowering. */
  quantity: number;
  /** Live maximum quantity (`0` when unavailable or out of stock). */
  maxQuantity: number;
  /** Live line status. */
  status: CartLineStatus;
  /** Timestamp when the line was first added. */
  addedAt: Date;
}

/** One item level adjustment emitted by quantity update or merge rules. */
export interface CartAdjustment {
  /** Variant UUID. */
  variantId: string;
  /** Product title if known, otherwise `null`. */
  title: string | null;
  /** Adjustment kind. */
  kind: CartAdjustmentKind;
  /** Kept quantity for `LOWERED`/`CAPPED`, or `0` for dropped items. */
  quantity: number;
}

/** Result of applying an add operation against existing cart lines. */
export interface ApplyAddResult {
  /** Outcome describing what happened. */
  outcome: CartAddOutcome;
  /** Whether the line list changed and must be persisted. */
  changed: boolean;
  /** Updated lines after the add attempt. */
  nextLines: CartLineInput[];
  /** Line that was inserted or updated when `changed` is true. */
  mutatedLine: CartLineInput | null;
}

/** Result of applying a quantity update to one existing line. */
export type ApplySetQuantityResult =
  | { kind: "NOT_FOUND" }
  | { kind: "UNAVAILABLE" }
  | { kind: "OK"; nextQuantity: number }
  | { kind: "LOWERED"; nextQuantity: number; adjustment: CartAdjustment };

/** Result of merging visitor lines into an account cart. */
export interface MergeLinesResult {
  /** Final lines to persist for the account cart, newest first. */
  nextLines: CartLineInput[];
  /** Adjustments describing every capped, lowered, or dropped line. */
  adjustments: CartAdjustment[];
}
