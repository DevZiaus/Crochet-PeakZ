import type {
  CatalogCurrency,
  CatalogImageRecord,
  CatalogProductRecord,
  CatalogProductType,
  CatalogVariantRecord,
} from "./types.js";

/**
 * Whether a product row is publicly visible.
 *
 * @param product Product visibility fields.
 * @returns True when active and not soft deleted.
 */
export function isVisibleProduct(product: {
  isActive: boolean;
  deletedAt: Date | null;
}): boolean {
  return product.isActive && product.deletedAt === null;
}

/**
 * Whether a variant can be purchased for its product type.
 *
 * Digital, custom, and pre order products are always available. Physical
 * products need stock above zero.
 *
 * @param productType Product kind.
 * @param stockQuantity Variant stock quantity.
 * @returns True when the variant is in stock.
 */
export function isVariantInStock(
  productType: CatalogProductType,
  stockQuantity: number,
): boolean {
  if (
    productType === "DIGITAL" ||
    productType === "CUSTOM" ||
    productType === "PRE_ORDER"
  ) {
    return true;
  }
  return stockQuantity > 0;
}

/**
 * Whether a product can be purchased.
 *
 * Digital, custom, and pre order products are always available. Physical
 * products are available when at least one variant has stock. A physical
 * product with no variants is out of stock.
 *
 * @param productType Product kind.
 * @param variants Product variants.
 * @returns True when the product can be purchased.
 */
export function isProductAvailable(
  productType: CatalogProductType,
  variants: readonly CatalogVariantRecord[],
): boolean {
  if (
    productType === "DIGITAL" ||
    productType === "CUSTOM" ||
    productType === "PRE_ORDER"
  ) {
    return true;
  }
  return variants.some((variant) => variant.stockQuantity > 0);
}

/**
 * Reads the base price for the active currency.
 *
 * @param product Product with both price columns.
 * @param currency Active currency.
 * @returns The base price.
 */
export function getBasePrice(
  product: Pick<CatalogProductRecord, "priceBdt" | "priceUsd">,
  currency: CatalogCurrency,
): number {
  return currency === "BDT" ? product.priceBdt : product.priceUsd;
}

/**
 * Reads a variant additional price for the active currency.
 *
 * @param variant Variant with both price columns.
 * @param currency Active currency.
 * @returns The additional price.
 */
export function getVariantAdditionalPrice(
  variant: Pick<
    CatalogVariantRecord,
    "additionalPriceBdt" | "additionalPriceUsd"
  >,
  currency: CatalogCurrency,
): number {
  return currency === "BDT"
    ? variant.additionalPriceBdt
    : variant.additionalPriceUsd;
}

/**
 * Picks the primary image.
 *
 * The primary flag wins. Otherwise the lowest display order, then the lowest
 * id, is used.
 *
 * @param images Product images.
 * @returns The primary image, or null when there are none.
 */
export function pickPrimaryImage(
  images: readonly CatalogImageRecord[],
): CatalogImageRecord | null {
  if (images.length === 0) {
    return null;
  }

  const ordered = [...images].sort(compareImages);
  return ordered[0] ?? null;
}

/**
 * Orders gallery images: primary first, then display order, then id.
 *
 * @param images Product images.
 * @returns A new ordered array.
 */
export function orderImages(
  images: readonly CatalogImageRecord[],
): CatalogImageRecord[] {
  return [...images].sort(compareImages);
}

/**
 * Orders variants by id ascending.
 *
 * @param variants Product variants.
 * @returns A new ordered array.
 */
export function orderVariants(
  variants: readonly CatalogVariantRecord[],
): CatalogVariantRecord[] {
  return [...variants].sort((left, right) => compareIds(left.id, right.id));
}

/**
 * Clamps a requested page to a real page.
 *
 * @param requestedPage Requested page.
 * @param total Total matching products.
 * @param pageSize Page size.
 * @returns The clamped page and total page count.
 */
export function clampPage(
  requestedPage: number,
  total: number,
  pageSize: number,
): { page: number; totalPages: number } {
  if (total <= 0) {
    return { page: 1, totalPages: 0 };
  }

  const totalPages = Math.ceil(total / pageSize);
  const page = Math.max(1, Math.min(requestedPage, totalPages));
  return { page, totalPages };
}

/**
 * Sorts images by primary flag, display order, then id.
 *
 * @param left First image.
 * @param right Second image.
 * @returns Negative when the first image sorts first.
 */
function compareImages(
  left: CatalogImageRecord,
  right: CatalogImageRecord,
): number {
  if (left.isPrimary !== right.isPrimary) {
    return left.isPrimary ? -1 : 1;
  }
  if (left.displayOrder !== right.displayOrder) {
    return left.displayOrder - right.displayOrder;
  }
  return compareIds(left.id, right.id);
}

/** Compares ids with the same code point ordering as the database. */
function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
