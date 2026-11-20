import { cookies } from "next/headers";
import type { CurrencyCode } from "@crochet-peakz/shared";
import { CURRENCY_COOKIE, parseCurrency } from "./cookie";

/**
 * Reads the active currency from the `cp_currency` cookie on the server.
 *
 * This is the single server side reader of `cp_currency` across the storefront
 * (AC-9).
 *
 * @returns `BDT` by default, `USD` when the cookie holds that value.
 */
export async function getActiveCurrency(): Promise<CurrencyCode> {
  const store = await cookies();
  return parseCurrency(store.get(CURRENCY_COOKIE)?.value);
}
