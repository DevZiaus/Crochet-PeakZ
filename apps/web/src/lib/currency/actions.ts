"use server";

import { cookies } from "next/headers";
import { currencySchema } from "@crochet-peakz/shared";
import { CURRENCY_COOKIE, CURRENCY_COOKIE_MAX_AGE } from "./cookie";

/** Input payload for the `setCurrency` Server Action. */
export interface SetCurrencyInput {
  /** Requested currency code (`BDT` or `USD`). */
  currency: string;
}

/** Result returned by the `setCurrency` Server Action. */
export type SetCurrencyResult =
  { ok: true } | { ok: false; error: "INVALID_CURRENCY" };

/**
 * Validates and persists the shopper's currency preference in the
 * `cp_currency` cookie.
 *
 * Rejects any value other than `BDT` or `USD` without writing a cookie, and
 * never redirects (AC-2, AC-6).
 *
 * @param input Object carrying the target `currency` string.
 * @returns `{ ok: true }` on success, or `{ ok: false, error: "INVALID_CURRENCY" }`.
 */
export async function setCurrency(
  input: SetCurrencyInput,
): Promise<SetCurrencyResult> {
  const rawCurrency = (
    input as Partial<Record<keyof SetCurrencyInput, unknown>> | null | undefined
  )?.currency;
  const parsed = currencySchema.safeParse(rawCurrency);

  if (!parsed.success) {
    return { ok: false, error: "INVALID_CURRENCY" };
  }

  const cookieStore = await cookies();
  cookieStore.set(CURRENCY_COOKIE, parsed.data, {
    path: "/",
    maxAge: CURRENCY_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });

  return { ok: true };
}
