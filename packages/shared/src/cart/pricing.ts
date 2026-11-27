import type { CurrencyCode } from "../types/index.js";
import type { CartLineDto } from "./types.js";

/**
 * Multiplies a unit price by a line quantity in integer minor units (poisha or
 * cents) to prevent floating point drift.
 *
 * @param unitPrice Unit price in major currency units.
 * @param quantity Positive integer line quantity.
 * @returns Two decimal line total in major currency units.
 */
export function calculateCartLineTotal(
  unitPrice: number,
  quantity: number,
): number {
  const unitMinor = Math.round(unitPrice * 100);
  return (unitMinor * quantity) / 100;
}

/**
 * Calculates the cart subtotal in the active currency using integer minor
 * units (poisha or cents).
 *
 * Only `OK` and `LOWERED` lines with a non-null unit price contribute to the
 * subtotal; `OUT_OF_STOCK` and `UNAVAILABLE` lines are excluded.
 *
 * @param lines Cart lines with status, dual unit prices, and quantity.
 * @param currency Active display currency.
 * @returns Subtotal in major units with at most two decimal places.
 */
export function calculateCartSubtotal(
  lines: readonly Pick<
    CartLineDto,
    "status" | "unitPriceBdt" | "unitPriceUsd" | "quantity"
  >[],
  currency: CurrencyCode,
): number {
  let totalMinor = 0;

  for (const line of lines) {
    if (line.status !== "OK" && line.status !== "LOWERED") {
      continue;
    }

    const unitPrice =
      currency === "BDT" ? line.unitPriceBdt : line.unitPriceUsd;
    if (unitPrice === null) {
      continue;
    }

    totalMinor += Math.round(unitPrice * 100) * line.quantity;
  }

  return totalMinor / 100;
}
