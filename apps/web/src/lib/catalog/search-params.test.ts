import { describe, expect, it } from "vitest";
import {
  buildShopHref,
  buildSortHref,
  defaultCatalogSearchState,
  hasCatalogFilters,
  parseCatalogSearchParams,
  toCatalogListParams,
} from "./search-params";

const known = new Set(["amigurumi", "wearables"]);

describe("parseCatalogSearchParams", () => {
  it("keeps known repeated categories and drops unknown ones", () => {
    const state = parseCatalogSearchParams(
      { category: ["amigurumi", "ghost", "amigurumi"] },
      known,
    );

    expect(state.categories).toEqual(["amigurumi"]);
  });

  it("keeps valid types and drops invalid ones", () => {
    const state = parseCatalogSearchParams(
      { type: ["STANDARD", "NOT_A_TYPE", "DIGITAL"] },
      known,
    );

    expect(state.types).toEqual(["STANDARD", "DIGITAL"]);
  });

  it("parses prices with two decimals and swaps a minimum above the maximum", () => {
    const state = parseCatalogSearchParams(
      { minPrice: "50.25", maxPrice: "10" },
      known,
    );

    expect(state.minPrice).toBe(10);
    expect(state.maxPrice).toBe(50.25);
  });

  it("drops invalid prices", () => {
    const state = parseCatalogSearchParams(
      { minPrice: "-2", maxPrice: "1.234" },
      known,
    );

    expect(state.minPrice).toBeUndefined();
    expect(state.maxPrice).toBeUndefined();
  });

  it("falls back to newest and page 1 for unknown values", () => {
    const state = parseCatalogSearchParams(
      { sort: "oldest", page: "0" },
      known,
    );

    expect(state.sort).toBe("newest");
    expect(state.page).toBe(1);
  });

  it("accepts a valid sort and page", () => {
    const state = parseCatalogSearchParams(
      { sort: "price-desc", page: "3" },
      known,
    );

    expect(state.sort).toBe("price-desc");
    expect(state.page).toBe(3);
  });

  it("only enables featured when the value is true", () => {
    expect(parseCatalogSearchParams({ featured: "true" }, known).featured).toBe(
      true,
    );
    expect(
      parseCatalogSearchParams({ featured: "false" }, known).featured,
    ).toBeUndefined();
  });
});

describe("buildShopHref", () => {
  it("omits defaults and keeps the path clean", () => {
    expect(buildShopHref(defaultCatalogSearchState)).toBe("/shop");
  });

  it("preserves filters, sort, and page", () => {
    const href = buildShopHref({
      categories: ["amigurumi", "wearables"],
      types: ["STANDARD"],
      minPrice: 10,
      maxPrice: 50,
      sort: "price-asc",
      page: 2,
    });

    expect(href).toBe(
      "/shop?category=amigurumi&category=wearables&type=STANDARD&minPrice=10&maxPrice=50&sort=price-asc&page=2",
    );
  });

  it("applies overrides without mutating the state", () => {
    const state = {
      ...defaultCatalogSearchState,
      categories: ["amigurumi"],
      page: 2,
    };

    expect(buildShopHref(state, { page: 1 })).toBe("/shop?category=amigurumi");
    expect(state.page).toBe(2);
  });
});

describe("toCatalogListParams", () => {
  it("always sends the currency and the page size", () => {
    const params = toCatalogListParams(defaultCatalogSearchState, "USD");

    expect(params.currency).toBe("USD");
    expect(params.limit).toBe(12);
    expect(params.page).toBe(1);
    expect(params.sort).toBe("newest");
  });
});

describe("hasCatalogFilters", () => {
  it("ignores page and sort", () => {
    expect(
      hasCatalogFilters({
        ...defaultCatalogSearchState,
        sort: "price-asc",
        page: 3,
      }),
    ).toBe(false);
  });

  it("detects every filter dimension", () => {
    expect(
      hasCatalogFilters({
        ...defaultCatalogSearchState,
        categories: ["amigurumi"],
      }),
    ).toBe(true);
    expect(
      hasCatalogFilters({
        ...defaultCatalogSearchState,
        types: ["CUSTOM"],
      }),
    ).toBe(true);
    expect(
      hasCatalogFilters({
        ...defaultCatalogSearchState,
        minPrice: 0,
      }),
    ).toBe(true);
  });
});

describe("buildSortHref", () => {
  it("preserves filters and resets the page when sorting", () => {
    const params = new URLSearchParams(
      "category=amigurumi&category=wearables&type=STANDARD&minPrice=10&page=3",
    );

    expect(buildSortHref("/shop", params, "price-asc")).toBe(
      "/shop?category=amigurumi&category=wearables&type=STANDARD&minPrice=10&sort=price-asc",
    );
  });

  it("removes the sort parameter when returning to newest", () => {
    const params = new URLSearchParams(
      "category=amigurumi&sort=price-desc&page=2",
    );

    expect(buildSortHref("/shop", params, "newest")).toBe(
      "/shop?category=amigurumi",
    );
  });

  it("returns the bare pathname when nothing remains", () => {
    expect(
      buildSortHref("/shop", new URLSearchParams("page=4"), "newest"),
    ).toBe("/shop");
  });
});
