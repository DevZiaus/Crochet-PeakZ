import { Currency, type CurrencyCode } from "@crochet-peakz/shared";

/** Cookie name that stores the shopper's active currency choice. */
export const CURRENCY_COOKIE = "cp_currency";

/** One year cookie lifetime in seconds. */
export const CURRENCY_COOKIE_MAX_AGE = 31_536_000;

/**
 * Validates a raw cookie value against the supported currencies.
 *
 * Anything missing, empty, or unknown falls back to BDT, matching AC-3 and
 * spec 0006 AC-14.
 *
 * @param value Raw cookie value.
 * @returns The active currency (`BDT` or `USD`).
 */
export function parseCurrency(value: string | undefined): CurrencyCode {
  return value === Currency.USD ? Currency.USD : Currency.BDT;
}
