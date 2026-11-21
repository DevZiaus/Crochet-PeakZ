/**
 * Tests for the currency switcher display and accessibility labels (AC-1, AC-7,
 * AC-8).
 */
import { describe, expect, it } from "vitest";
import { Currency } from "@crochet-peakz/shared";
import {
  CURRENCY_DRAWER_LEGEND,
  CURRENCY_OPTIONS,
  CURRENCY_SWITCH_ERROR_MESSAGE,
  currencyLabels,
} from "./labels";

describe("CURRENCY_OPTIONS", () => {
  it("lists BDT first followed by USD (AC-1)", () => {
    expect(CURRENCY_OPTIONS).toEqual([Currency.BDT, Currency.USD]);
  });

  it("provides complete label metadata for every offered currency (AC-1, AC-8)", () => {
    for (const option of CURRENCY_OPTIONS) {
      expect(currencyLabels[option].shortLabel).toBeTruthy();
      expect(currencyLabels[option].optionLabel).toBeTruthy();
      expect(currencyLabels[option].triggerAriaLabel).toBeTruthy();
      expect(currencyLabels[option].announcement).toBeTruthy();
    }
    expect(Object.keys(currencyLabels)).toHaveLength(CURRENCY_OPTIONS.length);
  });
});

describe("currencyLabels", () => {
  it("matches the exact storefront copy for BDT and USD (AC-1, AC-8)", () => {
    expect(currencyLabels[Currency.BDT]).toEqual({
      shortLabel: "৳ BDT",
      optionLabel: "৳ BDT, Bangladeshi taka",
      triggerAriaLabel: "Currency: ৳ BDT",
      announcement: "Prices now shown in Bangladeshi taka",
    });

    expect(currencyLabels[Currency.USD]).toEqual({
      shortLabel: "$ USD",
      optionLabel: "$ USD, US dollars",
      triggerAriaLabel: "Currency: $ USD",
      announcement: "Prices now shown in US dollars",
    });
  });

  it("exports the expected drawer legend and failure toast copy (AC-1, AC-7)", () => {
    expect(CURRENCY_DRAWER_LEGEND).toBe("Currency");
    expect(CURRENCY_SWITCH_ERROR_MESSAGE).toBe(
      "Could not change currency, please try again",
    );
  });
});
