import { describe, expect, it } from "vitest";
import {
  applyAdd,
  applySetQuantity,
  formatVariantLabel,
  isCartExpired,
  isCartableType,
  maxQuantityFor,
  mergeLines,
  resolveLine,
} from "./rules.js";
import {
  CART_EXPIRY_MS,
  CART_MAX_LINES,
  type CartCatalogLookup,
  type CartLineInput,
  type CartProductSnapshot,
  type CartVariantSnapshot,
} from "./types.js";

function makeProduct(
  overrides: Partial<CartProductSnapshot> = {},
): CartProductSnapshot {
  return {
    id: "prod-1",
    slug: "sunflower-bear",
    title: "Sunflower Bear",
    productType: "STANDARD",
    priceBdt: 1800,
    priceUsd: 22,
    isActive: true,
    deletedAt: null,
    images: [
      {
        id: "img-2",
        imageUrl: "products/bear-alt",
        altText: "Back view",
        isPrimary: false,
        displayOrder: 1,
      },
      {
        id: "img-1",
        imageUrl: "products/bear-main",
        altText: "Front view",
        isPrimary: true,
        displayOrder: 2,
      },
    ],
    ...overrides,
  };
}

function makeVariant(
  overrides: Partial<CartVariantSnapshot> = {},
): CartVariantSnapshot {
  return {
    id: "var-1",
    productId: "prod-1",
    colorName: "Honey Gold",
    sizeLabel: "Medium",
    yarnType: "Cotton",
    stockQuantity: 6,
    additionalPriceBdt: 100,
    additionalPriceUsd: 1.5,
    ...overrides,
  };
}

function makeLookup(
  products: CartProductSnapshot[],
  variants: CartVariantSnapshot[],
): CartCatalogLookup {
  return {
    productsById: new Map(products.map((p) => [p.id, p])),
    variantsById: new Map(variants.map((v) => [v.id, v])),
  };
}

const NOW = new Date("2026-11-27T12:00:00.000Z");

describe("cart domain helpers", () => {
  it("allows only STANDARD and ONE_OF_A_KIND product types", () => {
    expect(isCartableType("STANDARD")).toBe(true);
    expect(isCartableType("ONE_OF_A_KIND")).toBe(true);
    expect(isCartableType("DIGITAL")).toBe(false);
    expect(isCartableType("PRE_ORDER")).toBe(false);
    expect(isCartableType("CUSTOM")).toBe(false);
  });

  it("checks 30 day idle expiry boundary", () => {
    expect(
      isCartExpired(new Date(NOW.getTime() - CART_EXPIRY_MS + 1), NOW),
    ).toBe(false);
    expect(isCartExpired(new Date(NOW.getTime() - CART_EXPIRY_MS), NOW)).toBe(
      true,
    );
  });

  it("formats variant labels and falls back to Standard", () => {
    expect(
      formatVariantLabel({
        colorName: "Honey Gold",
        sizeLabel: "Medium",
        yarnType: "Cotton",
      }),
    ).toBe("Honey Gold · Medium · Cotton");

    expect(
      formatVariantLabel({
        colorName: "Blush",
        sizeLabel: null,
        yarnType: "  ",
      }),
    ).toBe("Blush");

    expect(
      formatVariantLabel({
        colorName: null,
        sizeLabel: null,
        yarnType: null,
      }),
    ).toBe("Standard");
  });

  it("computes maxQuantityFor for STANDARD, ONE_OF_A_KIND, and unavailable states", () => {
    const standard = makeProduct();
    const ooak = makeProduct({ productType: "ONE_OF_A_KIND" });
    const digital = makeProduct({ productType: "DIGITAL" });
    const inactive = makeProduct({ isActive: false });
    const deleted = makeProduct({ deletedAt: NOW });

    expect(
      maxQuantityFor(standard, makeVariant({ stockQuantity: 4 }), "prod-1"),
    ).toBe(4);
    expect(
      maxQuantityFor(standard, makeVariant({ stockQuantity: 25 }), "prod-1"),
    ).toBe(10);
    expect(
      maxQuantityFor(standard, makeVariant({ stockQuantity: 0 }), "prod-1"),
    ).toBe(0);
    expect(
      maxQuantityFor(ooak, makeVariant({ stockQuantity: 3 }), "prod-1"),
    ).toBe(1);
    expect(
      maxQuantityFor(digital, makeVariant({ stockQuantity: 9 }), "prod-1"),
    ).toBe(0);
    expect(
      maxQuantityFor(inactive, makeVariant({ stockQuantity: 9 }), "prod-1"),
    ).toBe(0);
    expect(
      maxQuantityFor(deleted, makeVariant({ stockQuantity: 9 }), "prod-1"),
    ).toBe(0);
    expect(
      maxQuantityFor(
        standard,
        makeVariant({ productId: "other-prod" }),
        "prod-1",
      ),
    ).toBe(0);
  });
});

describe("resolveLine", () => {
  it("resolves an in stock STANDARD line with primary image, variant label, and dual prices", () => {
    const lookup = makeLookup([makeProduct()], [makeVariant()]);
    const line = resolveLine(
      { productId: "prod-1", variantId: "var-1", quantity: 2, addedAt: NOW },
      lookup,
    );

    expect(line).toMatchObject({
      slug: "sunflower-bear",
      title: "Sunflower Bear",
      primaryImagePublicId: "products/bear-main",
      primaryImageAlt: "Front view",
      variantLabel: "Honey Gold · Medium · Cotton",
      unitPriceBdt: 1900,
      unitPriceUsd: 23.5,
      quantity: 2,
      maxQuantity: 6,
      status: "OK",
    });
  });

  it("lowers quantity when stock dropped below saved quantity", () => {
    const lookup = makeLookup(
      [makeProduct()],
      [makeVariant({ stockQuantity: 2 })],
    );
    const line = resolveLine(
      { productId: "prod-1", variantId: "var-1", quantity: 4, addedAt: NOW },
      lookup,
    );

    expect(line.status).toBe("LOWERED");
    expect(line.quantity).toBe(2);
    expect(line.maxQuantity).toBe(2);
  });

  it("flags OUT_OF_STOCK when stock is zero while retaining product and price details", () => {
    const lookup = makeLookup(
      [makeProduct()],
      [makeVariant({ stockQuantity: 0 })],
    );
    const line = resolveLine(
      { productId: "prod-1", variantId: "var-1", quantity: 2, addedAt: NOW },
      lookup,
    );

    expect(line.status).toBe("OUT_OF_STOCK");
    expect(line.maxQuantity).toBe(0);
    expect(line.quantity).toBe(2);
    expect(line.unitPriceBdt).toBe(1900);
    expect(line.variantLabel).toBe("Honey Gold · Medium · Cotton");
  });

  it("flags UNAVAILABLE for inactive or unsupported products while keeping product fields", () => {
    const lookup = makeLookup(
      [makeProduct({ isActive: false })],
      [makeVariant()],
    );
    const line = resolveLine(
      { productId: "prod-1", variantId: "var-1", quantity: 1, addedAt: NOW },
      lookup,
    );

    expect(line.status).toBe("UNAVAILABLE");
    expect(line.maxQuantity).toBe(0);
    expect(line.title).toBe("Sunflower Bear");
    expect(line.variantLabel).toBe("Honey Gold · Medium · Cotton");
  });

  it("nulls variantLabel and prices when variant is missing or mismatched, and nulls product fields when product is missing", () => {
    const mismatchedLookup = makeLookup(
      [makeProduct()],
      [makeVariant({ productId: "prod-other" })],
    );
    const mismatched = resolveLine(
      { productId: "prod-1", variantId: "var-1", quantity: 1, addedAt: NOW },
      mismatchedLookup,
    );
    expect(mismatched.status).toBe("UNAVAILABLE");
    expect(mismatched.title).toBe("Sunflower Bear");
    expect(mismatched.variantLabel).toBeNull();
    expect(mismatched.unitPriceBdt).toBeNull();
    expect(mismatched.unitPriceUsd).toBeNull();

    const missingProduct = resolveLine(
      {
        productId: "prod-missing",
        variantId: "var-1",
        quantity: 1,
        addedAt: NOW,
      },
      makeLookup([], []),
    );
    expect(missingProduct.status).toBe("UNAVAILABLE");
    expect(missingProduct.title).toBeNull();
    expect(missingProduct.slug).toBeNull();
    expect(missingProduct.primaryImagePublicId).toBeNull();
    expect(missingProduct.variantLabel).toBeNull();
    expect(missingProduct.unitPriceBdt).toBeNull();
  });
});

describe("applyAdd and applySetQuantity", () => {
  it("evaluates UNAVAILABLE before CART_FULL and AT_LIMIT", () => {
    const fullLines: CartLineInput[] = Array.from(
      { length: CART_MAX_LINES },
      (_, idx) => ({
        productId: "prod-1",
        variantId: `var-${idx}`,
        quantity: 1,
        addedAt: NOW,
      }),
    );

    // Out of stock item on a full cart => UNAVAILABLE, not CART_FULL
    const unavailableResult = applyAdd(
      fullLines,
      { productId: "prod-1", variantId: "var-new" },
      makeLookup(
        [makeProduct()],
        [makeVariant({ id: "var-new", stockQuantity: 0 })],
      ),
      NOW,
    );
    expect(unavailableResult.outcome).toBe("UNAVAILABLE");
    expect(unavailableResult.changed).toBe(false);

    // Available new variant on a full cart => CART_FULL
    const fullResult = applyAdd(
      fullLines,
      { productId: "prod-1", variantId: "var-new" },
      makeLookup(
        [makeProduct()],
        [makeVariant({ id: "var-new", stockQuantity: 5 })],
      ),
      NOW,
    );
    expect(fullResult.outcome).toBe("CART_FULL");
    expect(fullResult.changed).toBe(false);
  });

  it("preserves addedAt when incrementing an existing line and detects AT_LIMIT", () => {
    const earlier = new Date("2026-11-26T10:00:00.000Z");
    const lookup = makeLookup(
      [makeProduct()],
      [makeVariant({ stockQuantity: 2 })],
    );

    const first = applyAdd(
      [
        {
          productId: "prod-1",
          variantId: "var-1",
          quantity: 1,
          addedAt: earlier,
        },
      ],
      { productId: "prod-1", variantId: "var-1" },
      lookup,
      NOW,
    );
    expect(first.outcome).toBe("ADDED");
    expect(first.changed).toBe(true);
    expect(first.mutatedLine?.quantity).toBe(2);
    expect(first.mutatedLine?.addedAt).toEqual(earlier);

    const second = applyAdd(
      first.nextLines,
      { productId: "prod-1", variantId: "var-1" },
      lookup,
      NOW,
    );
    expect(second.outcome).toBe("AT_LIMIT");
    expect(second.changed).toBe(false);
  });

  it("handles NOT_FOUND, UNAVAILABLE, LOWERED, and OK in applySetQuantity", () => {
    const lookup = makeLookup(
      [makeProduct()],
      [
        makeVariant({ id: "var-1", stockQuantity: 3 }),
        makeVariant({ id: "var-0", stockQuantity: 0 }),
      ],
    );
    const lines: CartLineInput[] = [
      { productId: "prod-1", variantId: "var-1", quantity: 1, addedAt: NOW },
      { productId: "prod-1", variantId: "var-0", quantity: 1, addedAt: NOW },
    ];

    expect(applySetQuantity(lines, "var-missing", 2, lookup)).toEqual({
      kind: "NOT_FOUND",
    });
    expect(applySetQuantity(lines, "var-0", 2, lookup)).toEqual({
      kind: "UNAVAILABLE",
    });
    expect(applySetQuantity(lines, "var-1", 2, lookup)).toEqual({
      kind: "OK",
      nextQuantity: 2,
    });
    expect(applySetQuantity(lines, "var-1", 5, lookup)).toEqual({
      kind: "LOWERED",
      nextQuantity: 3,
      adjustment: {
        variantId: "var-1",
        title: "Sunflower Bear",
        kind: "LOWERED",
        quantity: 3,
      },
    });
  });
});

describe("mergeLines", () => {
  it("keeps existing account slots first, folds visitor lines newest first, sums matching variants, and drops overflow/dead lines", () => {
    const products: CartProductSnapshot[] = [
      makeProduct({ id: "prod-1", title: "Bear" }),
      makeProduct({
        id: "prod-ooak",
        title: "One of a Kind Shawl",
        productType: "ONE_OF_A_KIND",
      }),
      makeProduct({
        id: "prod-inactive",
        title: "Old Blanket",
        isActive: false,
      }),
    ];
    const variants: CartVariantSnapshot[] = [];
    const accountLines: CartLineInput[] = [];

    // Fill 19 existing account slots
    for (let i = 0; i < 19; i += 1) {
      const id = `acc-${i}`;
      variants.push(makeVariant({ id, productId: "prod-1", stockQuantity: 8 }));
      accountLines.push({
        productId: "prod-1",
        variantId: id,
        quantity: i === 0 ? 7 : 1,
        addedAt: new Date(NOW.getTime() - (100 - i) * 1000),
      });
    }

    // Extra variants for visitor lines
    variants.push(
      makeVariant({ id: "vis-newest", productId: "prod-1", stockQuantity: 5 }),
      makeVariant({ id: "vis-older", productId: "prod-1", stockQuantity: 5 }),
      makeVariant({ id: "vis-oos", productId: "prod-1", stockQuantity: 0 }),
      makeVariant({
        id: "vis-inactive",
        productId: "prod-inactive",
        stockQuantity: 4,
      }),
      makeVariant({ id: "vis-ooak", productId: "prod-ooak", stockQuantity: 1 }),
    );

    const futureDate = new Date(NOW.getTime() + 60_000);
    const visitorLines: CartLineInput[] = [
      // Matches acc-0 (7 + 4 = 11 -> capped to stock 8 => LOWERED)
      {
        productId: "prod-1",
        variantId: "acc-0",
        quantity: 4,
        addedAt: new Date(NOW.getTime() - 10_000),
      },
      // Older new visitor line -> will overflow (20th slot goes to vis-newest)
      {
        productId: "prod-1",
        variantId: "vis-older",
        quantity: 2,
        addedAt: new Date(NOW.getTime() - 5_000),
      },
      // Newest new visitor line with future addedAt -> takes the 20th slot and clamps addedAt to NOW
      {
        productId: "prod-1",
        variantId: "vis-newest",
        quantity: 2,
        addedAt: futureDate,
      },
      // Zero stock visitor line -> dropped as OUT_OF_STOCK
      {
        productId: "prod-1",
        variantId: "vis-oos",
        quantity: 1,
        addedAt: new Date(NOW.getTime() - 1_000),
      },
      // Inactive product visitor line -> dropped as UNAVAILABLE
      {
        productId: "prod-inactive",
        variantId: "vis-inactive",
        quantity: 1,
        addedAt: new Date(NOW.getTime() - 500),
      },
    ];

    const result = mergeLines(
      accountLines,
      visitorLines,
      makeLookup(products, variants),
      NOW,
    );

    expect(result.nextLines).toHaveLength(20);
    const mergedAcc0 = result.nextLines.find((l) => l.variantId === "acc-0");
    expect(mergedAcc0?.quantity).toBe(8);

    const mergedNewest = result.nextLines.find(
      (l) => l.variantId === "vis-newest",
    );
    expect(mergedNewest?.quantity).toBe(2);
    expect(mergedNewest?.addedAt).toEqual(NOW);

    expect(
      result.nextLines.find((l) => l.variantId === "vis-older"),
    ).toBeUndefined();

    expect(result.adjustments).toEqual(
      expect.arrayContaining([
        { variantId: "acc-0", title: "Bear", kind: "LOWERED", quantity: 8 },
        {
          variantId: "vis-oos",
          title: "Bear",
          kind: "OUT_OF_STOCK",
          quantity: 0,
        },
        {
          variantId: "vis-inactive",
          title: "Old Blanket",
          kind: "UNAVAILABLE",
          quantity: 0,
        },
        {
          variantId: "vis-older",
          title: "Bear",
          kind: "DROPPED_CART_FULL",
          quantity: 0,
        },
      ]),
    );
  });
});
