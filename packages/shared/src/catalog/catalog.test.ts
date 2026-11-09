import { describe, expect, it } from "vitest";
import { ProductType } from "../types/index.js";
import { catalogListQuerySchema } from "./schemas.js";
import { calculateVariantPrice } from "./pricing.js";
import { getLeadTimeLabel, getStockLabel } from "./labels.js";

describe("catalog stock labels", () => {
  it("labels standard stock bands", () => {
    expect(getStockLabel(ProductType.STANDARD, 0)).toBe("Sold out");
    expect(getStockLabel(ProductType.STANDARD, 1)).toBe("Only 1 left");
    expect(getStockLabel(ProductType.STANDARD, 5)).toBe("Only 5 left");
    expect(getStockLabel(ProductType.STANDARD, 6)).toBe("In stock");
  });

  it("labels one of a kind stock bands the same way", () => {
    expect(getStockLabel(ProductType.ONE_OF_A_KIND, 0)).toBe("Sold out");
    expect(getStockLabel(ProductType.ONE_OF_A_KIND, 2)).toBe("Only 2 left");
  });

  it("labels non stock product types", () => {
    expect(getStockLabel(ProductType.DIGITAL, 0)).toBe("Available now");
    expect(getStockLabel(ProductType.CUSTOM, 0)).toBe("Made to order");
    expect(getStockLabel(ProductType.PRE_ORDER, 0)).toBe(
      "Available to pre order",
    );
  });
});

describe("catalog lead time labels", () => {
  it("labels a zero lead time as ready to ship", () => {
    expect(getLeadTimeLabel(0)).toBe("Ready to ship");
  });

  it("labels a positive lead time with the stored day count", () => {
    expect(getLeadTimeLabel(28)).toBe("Handcrafted in 28 days");
  });
});

describe("calculateVariantPrice", () => {
  it("adds the variant additional price to the base price", () => {
    expect(calculateVariantPrice(1800, 100)).toBe(1900);
    expect(calculateVariantPrice(9.99, 0.01)).toBe(10);
  });

  it("rounds to two decimal places", () => {
    expect(calculateVariantPrice(0.1, 0.2)).toBe(0.3);
  });
});

describe("catalogListQuerySchema", () => {
  it("applies the defaults", () => {
    const result = catalogListQuerySchema.parse({});

    expect(result).toEqual({
      currency: "BDT",
      sort: "newest",
      page: 1,
      limit: 12,
    });
  });

  it("deduplicates repeated categories and types", () => {
    const result = catalogListQuerySchema.parse({
      category: ["amigurumi", "amigurumi", "wearables"],
      type: ["STANDARD", "STANDARD", "DIGITAL"],
    });

    expect(result.category).toEqual(["amigurumi", "wearables"]);
    expect(result.type).toEqual(["STANDARD", "DIGITAL"]);
  });

  it("parses prices, featured, and both currencies", () => {
    const result = catalogListQuerySchema.parse({
      minPrice: "10.5",
      maxPrice: "20",
      currency: "USD",
      featured: "true",
      page: "3",
      limit: "24",
      sort: "price-desc",
    });

    expect(result).toMatchObject({
      minPrice: 10.5,
      maxPrice: 20,
      currency: "USD",
      featured: true,
      page: 3,
      limit: 24,
      sort: "price-desc",
    });
  });

  it.each([
    ["type", { type: "NOT_A_TYPE" }],
    ["sort", { sort: "popular" }],
    ["currency", { currency: "EUR" }],
    ["page", { page: "0" }],
    ["limit", { limit: "49" }],
    ["minPrice", { minPrice: "1.234" }],
    ["maxPrice", { maxPrice: "" }],
    ["category", { category: "" }],
    ["category object", { category: { slug: "amigurumi" } }],
    ["featured", { featured: "yes" }],
  ])("rejects a malformed %s value", (_name, query) => {
    expect(catalogListQuerySchema.safeParse(query).success).toBe(false);
  });

  it("rejects a minimum price above the maximum", () => {
    const result = catalogListQuerySchema.safeParse({
      minPrice: "20",
      maxPrice: "10",
    });

    expect(result.success).toBe(false);
  });
});
