import { describe, expect, it } from "vitest";
import {
  CART_EXPIRY_DAYS,
  CART_MAX_BODY_BYTES,
  CART_MAX_LINE_QUANTITY,
  CART_MAX_LINES,
  Currency,
  ProductType,
  calculateCartLineTotal,
  calculateCartSubtotal,
  cartAddItemBodySchema,
  cartMergeBodySchema,
  cartQuoteBodySchema,
  cartUpdateItemBodySchema,
  cartVariantParamSchema,
  isCartableProductType,
  type CartLineDto,
} from "../index.js";

const PRODUCT_ID_V7 = "0194f3e0-1234-7abc-8def-0123456789ab";
const VARIANT_ID_V4 = "550e8400-e29b-41d4-a716-446655440000";
const VARIANT_ID_V7 = "0194f3e0-5678-7abc-8def-0123456789cd";
const GUEST_CART_ID = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";

function makeLine(overrides: Partial<CartLineDto> = {}): CartLineDto {
  return {
    productId: PRODUCT_ID_V7,
    variantId: VARIANT_ID_V4,
    slug: "sunflower-bear",
    title: "Sunflower Bear",
    imageUrl: "https://res.cloudinary.com/demo/image/upload/bear",
    imageAlt: "Bear",
    variantLabel: "Honey Gold",
    productType: ProductType.STANDARD,
    unitPriceBdt: 1800,
    unitPriceUsd: 22.5,
    quantity: 1,
    maxQuantity: 5,
    status: "OK",
    addedAt: "2026-11-27T10:00:00.000Z",
    ...overrides,
  };
}

describe("cart constants and helpers", () => {
  it("exports the spec limits", () => {
    expect(CART_MAX_LINES).toBe(20);
    expect(CART_MAX_LINE_QUANTITY).toBe(10);
    expect(CART_EXPIRY_DAYS).toBe(30);
    expect(CART_MAX_BODY_BYTES).toBe(16 * 1024);
  });

  it("allows only STANDARD and ONE_OF_A_KIND product types", () => {
    expect(isCartableProductType(ProductType.STANDARD)).toBe(true);
    expect(isCartableProductType(ProductType.ONE_OF_A_KIND)).toBe(true);
    expect(isCartableProductType(ProductType.DIGITAL)).toBe(false);
    expect(isCartableProductType(ProductType.PRE_ORDER)).toBe(false);
    expect(isCartableProductType(ProductType.CUSTOM)).toBe(false);
  });
});

describe("cart Zod schemas", () => {
  it("accepts valid UUID v4 and v7 values across quote, add, update, param, and merge", () => {
    expect(
      cartQuoteBodySchema.safeParse({
        lines: [
          {
            productId: PRODUCT_ID_V7,
            variantId: VARIANT_ID_V4,
            quantity: 3,
            addedAt: "2026-11-27T10:00:00.000Z",
          },
          {
            productId: PRODUCT_ID_V7,
            variantId: VARIANT_ID_V7,
            quantity: 1,
          },
        ],
      }).success,
    ).toBe(true);

    expect(cartQuoteBodySchema.safeParse({ lines: [] }).success).toBe(true);
    expect(
      cartAddItemBodySchema.safeParse({
        productId: PRODUCT_ID_V7,
        variantId: VARIANT_ID_V7,
      }).success,
    ).toBe(true);
    expect(cartUpdateItemBodySchema.safeParse({ quantity: 10 }).success).toBe(
      true,
    );
    expect(
      cartVariantParamSchema.safeParse({ variantId: VARIANT_ID_V4 }).success,
    ).toBe(true);
    expect(
      cartMergeBodySchema.safeParse({
        guestCartId: GUEST_CART_ID,
        lines: [
          {
            productId: PRODUCT_ID_V7,
            variantId: VARIANT_ID_V4,
            quantity: 2,
            addedAt: "2026-11-27T10:00:00+06:00",
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects duplicate variantIds in quote and merge lines", () => {
    const result = cartQuoteBodySchema.safeParse({
      lines: [
        { productId: PRODUCT_ID_V7, variantId: VARIANT_ID_V4, quantity: 1 },
        { productId: PRODUCT_ID_V7, variantId: VARIANT_ID_V4, quantity: 2 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 20 lines", () => {
    const lines = Array.from({ length: 21 }, (_, idx) => ({
      productId: PRODUCT_ID_V7,
      variantId: `550e8400-e29b-41d4-a716-4466554400${String(idx).padStart(2, "0")}`,
      quantity: 1,
    }));
    expect(cartQuoteBodySchema.safeParse({ lines }).success).toBe(false);
  });

  it("rejects out of range quantities and non UUID identifiers", () => {
    expect(cartUpdateItemBodySchema.safeParse({ quantity: 0 }).success).toBe(
      false,
    );
    expect(cartUpdateItemBodySchema.safeParse({ quantity: 11 }).success).toBe(
      false,
    );
    expect(cartUpdateItemBodySchema.safeParse({ quantity: 1.5 }).success).toBe(
      false,
    );
    expect(
      cartVariantParamSchema.safeParse({ variantId: "not-a-uuid" }).success,
    ).toBe(false);
    expect(
      cartMergeBodySchema.safeParse({ guestCartId: "bad", lines: [] }).success,
    ).toBe(false);
  });
});

describe("cart subtotal calculation", () => {
  it("computes line totals and subtotals in integer minor units without float drift", () => {
    expect(calculateCartLineTotal(19.99, 3)).toBe(59.97);
    expect(calculateCartLineTotal(0.1, 3)).toBe(0.3);

    const lines = [
      makeLine({
        unitPriceBdt: 199.95,
        unitPriceUsd: 19.99,
        quantity: 3,
        status: "OK",
      }),
      makeLine({
        variantId: VARIANT_ID_V7,
        unitPriceBdt: 0.1,
        unitPriceUsd: 0.1,
        quantity: 3,
        status: "LOWERED",
      }),
    ];

    expect(calculateCartSubtotal(lines, Currency.USD)).toBe(60.27);
    expect(calculateCartSubtotal(lines, Currency.BDT)).toBe(600.15);
  });

  it("excludes OUT_OF_STOCK, UNAVAILABLE, and null priced lines from the subtotal", () => {
    const lines = [
      makeLine({
        unitPriceBdt: 1000,
        unitPriceUsd: 10,
        quantity: 2,
        status: "OK",
      }),
      makeLine({
        variantId: VARIANT_ID_V7,
        unitPriceBdt: 500,
        unitPriceUsd: 5,
        quantity: 1,
        status: "OUT_OF_STOCK",
      }),
      makeLine({
        variantId: GUEST_CART_ID,
        unitPriceBdt: null,
        unitPriceUsd: null,
        quantity: 1,
        status: "UNAVAILABLE",
      }),
    ];

    expect(calculateCartSubtotal(lines, Currency.BDT)).toBe(2000);
    expect(calculateCartSubtotal(lines, Currency.USD)).toBe(20);
  });
});
