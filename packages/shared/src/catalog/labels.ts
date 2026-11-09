import { ProductType } from "../types/index.js";

/**
 * Customer facing stock label for a product and its selected variant.
 *
 * Digital, custom, and pre order products are always available; physical
 * products use the selected variant quantity. A physical product with no
 * variants is sold out.
 *
 * @param productType Product kind.
 * @param stockQuantity Selected variant stock, or zero when there is none.
 * @returns The stock label.
 */
export function getStockLabel(
  productType: ProductType,
  stockQuantity: number,
): string {
  if (productType === ProductType.DIGITAL) {
    return "Available now";
  }
  if (productType === ProductType.CUSTOM) {
    return "Made to order";
  }
  if (productType === ProductType.PRE_ORDER) {
    return "Available to pre order";
  }
  if (stockQuantity <= 0) {
    return "Sold out";
  }
  return stockQuantity <= 5 ? `Only ${String(stockQuantity)} left` : "In stock";
}

/**
 * Customer facing lead time label.
 *
 * @param leadTimeDays Stored lead time in days.
 * @returns `Ready to ship` for zero, otherwise the handcrafting estimate.
 */
export function getLeadTimeLabel(leadTimeDays: number): string {
  return leadTimeDays > 0
    ? `Handcrafted in ${String(leadTimeDays)} days`
    : "Ready to ship";
}
