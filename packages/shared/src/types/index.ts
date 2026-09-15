/**
 * Currency codes supported by Crochet PeakZ.
 * BDT for domestic (Bangladesh) orders, USD for international.
 */
export const Currency = {
  BDT: "BDT",
  USD: "USD",
} as const;

/** Union type of supported currency codes. */
export type CurrencyCode = (typeof Currency)[keyof typeof Currency];
