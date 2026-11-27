import { ProductType } from "../types/index.js";

/** Maximum number of distinct variant lines allowed in one cart. */
export const CART_MAX_LINES = 20;

/** Maximum quantity allowed for a single standard cart line. */
export const CART_MAX_LINE_QUANTITY = 10;

/** Number of idle days before a browser or account cart expires. */
export const CART_EXPIRY_DAYS = 30;

/** Idle expiry duration in milliseconds. */
export const CART_EXPIRY_MS = CART_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

/** Maximum JSON body size accepted by the cart web proxy and API (16 KB). */
export const CART_MAX_BODY_BYTES = 16 * 1024;

/** Product types that can be added to the shopping cart in Slice 1. */
export const CARTABLE_PRODUCT_TYPES = [
  ProductType.STANDARD,
  ProductType.ONE_OF_A_KIND,
] as const;

/**
 * Checks whether a product type can be added to the shopping cart.
 *
 * @param productType Product type to inspect.
 * @returns True for `STANDARD` and `ONE_OF_A_KIND`, false otherwise.
 */
export function isCartableProductType(productType: ProductType): boolean {
  return (
    productType === ProductType.STANDARD ||
    productType === ProductType.ONE_OF_A_KIND
  );
}
