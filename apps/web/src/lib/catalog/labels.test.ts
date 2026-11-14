/**
 * Tests for the shared storefront labels.
 *
 * The filter form renders one checkbox per product type from the shared enum,
 * so a missing key here means a type a shopper can never filter by. The sort
 * labels drive the visible text of the sort control.
 */
import { describe, expect, it } from "vitest";
import { ProductType } from "@crochet-peakz/shared";
import { productTypeLabels, sortLabels, sortOptions } from "./labels";

describe("productTypeLabels", () => {
  it("labels every canonical product type", () => {
    for (const type of Object.values(ProductType)) {
      expect(productTypeLabels[type]).toBeTruthy();
    }
  });

  it("uses the customer facing wording for each type", () => {
    expect(productTypeLabels).toEqual({
      STANDARD: "Standard",
      ONE_OF_A_KIND: "One of a kind",
      PRE_ORDER: "Pre order",
      CUSTOM: "Custom",
      DIGITAL: "Digital",
    });
  });
});

describe("sortOptions", () => {
  it("offers newest first, then low to high, then high to low", () => {
    expect(sortOptions).toEqual(["newest", "price-asc", "price-desc"]);
  });

  it("has a label for every offered sort", () => {
    for (const option of sortOptions) {
      expect(sortLabels[option]).toBeTruthy();
    }
    expect(Object.keys(sortLabels)).toHaveLength(sortOptions.length);
  });

  it("labels the price sorts with their direction", () => {
    expect(sortLabels.newest).toBe("Newest");
    expect(sortLabels["price-asc"]).toBe("Price: low to high");
    expect(sortLabels["price-desc"]).toBe("Price: high to low");
  });
});
