import { ProductType, type CartAdjustmentDto } from "@crochet-peakz/shared";

/** Toast shown when adding a 21st distinct variant to a full cart. */
export const CART_FULL_TOAST =
  "Your cart is full (20 items max). Remove something to add this.";

/** Toast shown when an add attempt hits zero stock or an unavailable item. */
export const CART_ITEM_UNAVAILABLE_TOAST = "This item is no longer available";

/** Toast shown when any cart mutation fails due to a network or server error. */
export const CART_UPDATE_ERROR_TOAST =
  "Could not update your cart, please try again";

/** Error message shown in the drawer and `/cart` when initial load or quote fails. */
export const CART_LOAD_ERROR_MESSAGE = "We couldn't load your cart right now";

/**
 * Returns the disabled product type note shown below `Add to cart` for
 * non-cartable product types (AC-2).
 *
 * @param productType Product kind.
 * @returns Explanatory note, or `null` for cartable types (`STANDARD`, `ONE_OF_A_KIND`).
 */
export function getDisabledCartTypeNote(
  productType: ProductType,
): string | null {
  switch (productType) {
    case ProductType.DIGITAL:
      return "Digital patterns are coming to the cart soon.";
    case ProductType.PRE_ORDER:
      return "Pre orders are not open yet.";
    case ProductType.CUSTOM:
      return "This piece is made to order through a custom request, coming soon.";
    case ProductType.STANDARD:
    case ProductType.ONE_OF_A_KIND:
      return null;
  }
}

/**
 * Formats the accessible label for the header cart trigger button (AC-3).
 *
 * @param count Total item count across cart lines.
 * @returns Accessible label text.
 */
export function getCartButtonAriaLabel(count: number): string {
  if (count <= 0) {
    return "Shopping cart, empty";
  }
  if (count === 1) {
    return "Shopping cart, 1 item";
  }
  return `Shopping cart, ${String(count)} items`;
}

/**
 * Formats the visible badge text on the header cart button (AC-3).
 *
 * @param count Total item count across cart lines.
 * @returns Badge string (`1`..`99`, `99+`), or `null` when hidden at 0.
 */
export function formatCartBadgeCount(count: number): string | null {
  if (count <= 0) {
    return null;
  }
  return count > 99 ? "99+" : String(count);
}

/**
 * Formats one adjustment item inside the post sign in merge banner (AC-11).
 *
 * @param adjustment Merge adjustment entry from `CartDto.adjustments`.
 * @returns Plain language explanation for the shopper.
 */
export function formatCartAdjustment(adjustment: CartAdjustmentDto): string {
  const title = adjustment.title ?? "An item";
  switch (adjustment.kind) {
    case "CAPPED":
    case "LOWERED":
      return `${title}: limited to ${String(adjustment.quantity)} available`;
    case "OUT_OF_STOCK":
      return `${title}: out of stock and removed`;
    case "UNAVAILABLE":
      return `${title}: no longer available and removed`;
    case "DROPPED_CART_FULL":
      return `${title}: left out because your cart has 20 items`;
  }
}
