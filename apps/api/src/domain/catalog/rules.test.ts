import { describe, expect, it } from "vitest";
import {
  clampPage,
  getBasePrice,
  getVariantAdditionalPrice,
  isProductAvailable,
  isVariantInStock,
  isVisibleProduct,
  orderImages,
  orderVariants,
  pickPrimaryImage,
} from "./rules.js";
import { makeImage, makeVariant } from "../../test-support/catalog-fakes.js";

describe("catalog visibility", () => {
  it("hides inactive and soft deleted products", () => {
    expect(isVisibleProduct({ isActive: true, deletedAt: null })).toBe(true);
    expect(isVisibleProduct({ isActive: false, deletedAt: null })).toBe(false);
    expect(isVisibleProduct({ isActive: true, deletedAt: new Date() })).toBe(
      false,
    );
  });
});

describe("catalog stock rules", () => {
  it("always stocks digital, custom, and pre order variants", () => {
    expect(isVariantInStock("DIGITAL", 0)).toBe(true);
    expect(isVariantInStock("CUSTOM", 0)).toBe(true);
    expect(isVariantInStock("PRE_ORDER", 0)).toBe(true);
  });

  it("requires stock for physical variants", () => {
    expect(isVariantInStock("STANDARD", 0)).toBe(false);
    expect(isVariantInStock("STANDARD", 1)).toBe(true);
    expect(isVariantInStock("ONE_OF_A_KIND", 0)).toBe(false);
    expect(isVariantInStock("ONE_OF_A_KIND", 1)).toBe(true);
  });

  it("treats a physical product with no variants as sold out", () => {
    expect(isProductAvailable("STANDARD", [])).toBe(false);
    expect(isProductAvailable("ONE_OF_A_KIND", [])).toBe(false);
    expect(
      isProductAvailable("STANDARD", [
        makeVariant({ id: "v1", stockQuantity: 0 }),
      ]),
    ).toBe(false);
    expect(
      isProductAvailable("STANDARD", [
        makeVariant({ id: "v1", stockQuantity: 2 }),
      ]),
    ).toBe(true);
  });

  it("treats digital, custom, and pre order products as available", () => {
    expect(isProductAvailable("DIGITAL", [])).toBe(true);
    expect(isProductAvailable("CUSTOM", [])).toBe(true);
    expect(isProductAvailable("PRE_ORDER", [])).toBe(true);
  });
});

describe("catalog price selection", () => {
  it("selects the active currency column", () => {
    const product = { priceBdt: 1800, priceUsd: 22 };
    expect(getBasePrice(product, "BDT")).toBe(1800);
    expect(getBasePrice(product, "USD")).toBe(22);
  });

  it("selects the variant additional price column", () => {
    const variant = { additionalPriceBdt: 100, additionalPriceUsd: 1.5 };
    expect(getVariantAdditionalPrice(variant, "BDT")).toBe(100);
    expect(getVariantAdditionalPrice(variant, "USD")).toBe(1.5);
  });
});

describe("catalog image ordering", () => {
  it("returns null when there are no images", () => {
    expect(pickPrimaryImage([])).toBeNull();
  });

  it("prefers the primary flag, then display order, then id", () => {
    const images = [
      makeImage({ id: "b", displayOrder: 1 }),
      makeImage({ id: "a", displayOrder: 2 }),
      makeImage({ id: "c", displayOrder: 9, isPrimary: true }),
    ];

    expect(pickPrimaryImage(images)?.id).toBe("c");
    expect(orderImages(images).map((image) => image.id)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  it("falls back to the lowest display order when no image is primary", () => {
    const images = [
      makeImage({ id: "b", displayOrder: 2 }),
      makeImage({ id: "a", displayOrder: 1 }),
    ];

    expect(pickPrimaryImage(images)?.id).toBe("a");
  });

  it("orders variants by id ascending", () => {
    const variants = [
      makeVariant({ id: "b" }),
      makeVariant({ id: "a" }),
      makeVariant({ id: "c" }),
    ];

    expect(orderVariants(variants).map((variant) => variant.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("catalog page clamping", () => {
  it("clamps a page beyond the last page", () => {
    expect(clampPage(9, 25, 12)).toEqual({ page: 3, totalPages: 3 });
  });

  it("keeps zero results on page one", () => {
    expect(clampPage(4, 0, 12)).toEqual({ page: 1, totalPages: 0 });
  });

  it("keeps a valid page", () => {
    expect(clampPage(2, 25, 12)).toEqual({ page: 2, totalPages: 3 });
  });
});
