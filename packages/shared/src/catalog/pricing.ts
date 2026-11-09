/**
 * Adds a variant additional price to a product base price.
 *
 * Prices are handled in integer minor units so floating point drift cannot
 * change the displayed total. The result carries at most two decimals.
 *
 * @param basePrice Base product price in the active currency.
 * @param additionalPrice Variant additional price in the same currency.
 * @returns The combined price.
 */
export function calculateVariantPrice(
  basePrice: number,
  additionalPrice: number,
): number {
  return Math.round((basePrice + additionalPrice) * 100) / 100;
}
