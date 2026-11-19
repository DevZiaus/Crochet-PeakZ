/**
 * Adds a variant additional price to a product base price.
 *
 * Prices are added as decimal numbers and rounded to two decimals, so floating
 * point drift cannot change the displayed total at realistic magnitudes. The
 * result carries at most two decimals.
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
