import { cookies } from "next/headers";
import { Currency, type CurrencyCode } from "@crochet-peakz/shared";

/** Cookie feature 7 will write. The catalog only reads it. */
export const CURRENCY_COOKIE = "cp_currency";

/**
 * Validates a cookie value against the supported currencies.
 *
 * Anything missing, empty, or unknown falls back to BDT, matching AC-14.
 *
 * @param value Raw cookie value.
 * @returns The active currency.
 */
export function parseCurrency(value: string | undefined): CurrencyCode {
  return value === Currency.USD ? Currency.USD : Currency.BDT;
}

/**
 * Reads the active currency from the `cp_currency` cookie on the server.
 *
 * @returns BDT by default, USD when the cookie holds that value.
 */
export async function getActiveCurrency(): Promise<CurrencyCode> {
  const store = await cookies();
  return parseCurrency(store.get(CURRENCY_COOKIE)?.value);
}
