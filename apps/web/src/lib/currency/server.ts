import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import type { CurrencyCode } from "@crochet-peakz/shared";
import { CURRENCY_COOKIE, parseCurrency } from "./cookie";

/**
 * Reads the active currency from the `cp_currency` cookie on the server.
 *
 * This is the single server side reader of `cp_currency` across the storefront
 * (AC-9). Wrapped in `React.cache()` so the layout and page share one cookie
 * read per request.
 *
 * @returns `BDT` by default, `USD` when the cookie holds that value.
 */
export const getActiveCurrency = cache(async (): Promise<CurrencyCode> => {
  const store = await cookies();
  return parseCurrency(store.get(CURRENCY_COOKIE)?.value);
});
