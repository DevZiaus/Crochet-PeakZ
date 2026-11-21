import { Currency, type CurrencyCode } from "@crochet-peakz/shared";

/** Display and accessibility copy for a single currency option. */
export interface CurrencyLabelEntry {
  /** Short trigger label, such as `৳ BDT`. */
  readonly shortLabel: string;
  /** Full option label for menu and radio items. */
  readonly optionLabel: string;
  /** Accessible name for the header dropdown trigger (`Currency: ৳ BDT`). */
  readonly triggerAriaLabel: string;
  /** Polite live region message announced after switching to this currency. */
  readonly announcement: string;
}

/** Supported currencies in display order. */
export const CURRENCY_OPTIONS: readonly CurrencyCode[] = [
  Currency.BDT,
  Currency.USD,
];

/** Legend for the mobile navigation drawer currency radio group. */
export const CURRENCY_DRAWER_LEGEND = "Currency";

/** Error toast shown when a currency switch fails. */
export const CURRENCY_SWITCH_ERROR_MESSAGE =
  "Could not change currency, please try again";

/** Display and accessibility labels keyed by currency code. */
export const currencyLabels: Record<CurrencyCode, CurrencyLabelEntry> = {
  [Currency.BDT]: {
    shortLabel: "৳ BDT",
    optionLabel: "৳ BDT, Bangladeshi taka",
    triggerAriaLabel: "Currency: ৳ BDT",
    announcement: "Prices now shown in Bangladeshi taka",
  },
  [Currency.USD]: {
    shortLabel: "$ USD",
    optionLabel: "$ USD, US dollars",
    triggerAriaLabel: "Currency: $ USD",
    announcement: "Prices now shown in US dollars",
  },
};
