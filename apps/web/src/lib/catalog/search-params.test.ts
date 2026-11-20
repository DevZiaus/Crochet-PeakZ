import { describe, expect, it } from "vitest";
import {
  buildPagedCatalogHref,
  buildShopCanonical,
  buildShopHref,
  buildSortHref,
  defaultCatalogSearchState,
  hasCatalogFilters,
  hasUnsupportedCollectionParams,
  parseCatalogSearchParams,
  toCatalogListParams,
  withoutPriceFilters,
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

  it("caps an oversized page at the safe integer limit", () => {
    const state = parseCatalogSearchParams({ page: "9".repeat(400) }, known);

    expect(state.page).toBe(Number.MAX_SAFE_INTEGER);
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

describe("hasUnsupportedCollectionParams", () => {
  it("accepts the sort and page state a collection page supports", () => {
    expect(
      hasUnsupportedCollectionParams({ sort: "price-asc", page: "2" }),
    ).toBe(false);
  });

  it("detects every catalog filter a collection page ignores", () => {
    expect(hasUnsupportedCollectionParams({ category: "amigurumi" })).toBe(
      true,
    );
    expect(hasUnsupportedCollectionParams({ type: "STANDARD" })).toBe(true);
    expect(hasUnsupportedCollectionParams({ minPrice: "10" })).toBe(true);
    expect(hasUnsupportedCollectionParams({ maxPrice: "50" })).toBe(true);
    expect(hasUnsupportedCollectionParams({ featured: "true" })).toBe(true);
  });

  it("ignores unrelated parameters", () => {
    expect(hasUnsupportedCollectionParams({ utm_source: "newsletter" })).toBe(
      false,
    );
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

describe("buildPagedCatalogHref", () => {
  it("keeps the path clean for the default state", () => {
    expect(
      buildPagedCatalogHref(
        "/collections/amigurumi",
        defaultCatalogSearchState,
      ),
    ).toBe("/collections/amigurumi");
  });

  it("keeps sort and page but drops filters", () => {
    expect(
      buildPagedCatalogHref("/collections/amigurumi", {
        ...defaultCatalogSearchState,
        categories: ["amigurumi"],
        types: ["STANDARD"],
        sort: "price-desc",
        page: 3,
      }),
    ).toBe("/collections/amigurumi?sort=price-desc&page=3");
  });

  it("applies pagination overrides without mutating the state", () => {
    const state = {
      ...defaultCatalogSearchState,
      sort: "price-asc" as const,
      page: 3,
    };

    expect(
      buildPagedCatalogHref("/collections/amigurumi", state, { page: 1 }),
    ).toBe("/collections/amigurumi?sort=price-asc");
    expect(state.page).toBe(3);
  });
});

describe("buildShopCanonical", () => {
  const webAppUrl = "https://crochetpeakz.test";

  it("canonicalises a single collection on page 1 with the default sort", () => {
    const state = {
      ...defaultCatalogSearchState,
      categories: ["amigurumi"],
    };

    expect(buildShopCanonical(state, webAppUrl)).toBe(
      `${webAppUrl}/collections/amigurumi`,
    );
  });

  const selfCanonicalCases: Array<
    [string, Partial<typeof defaultCatalogSearchState>]
  > = [
    ["a second category", { categories: ["amigurumi", "wearables"] }],
    ["page 2", { page: 2 }],
    ["a non default sort", { sort: "price-asc" }],
    ["a type filter", { types: ["STANDARD"] }],
    ["a price filter", { minPrice: 100 }],
    ["the featured filter", { featured: true }],
  ];

  it.each(selfCanonicalCases)(
    "keeps the self canonical for %s",
    (_label, overrides) => {
      const state = {
        ...defaultCatalogSearchState,
        categories: ["amigurumi"],
        ...overrides,
      };

      expect(buildShopCanonical(state, webAppUrl)).toBe(
        `${webAppUrl}${buildShopHref(state)}`,
      );
    },
  );

  it("canonicalises a bare shop visit to the shop URL", () => {
    expect(buildShopCanonical(defaultCatalogSearchState, webAppUrl)).toBe(
      `${webAppUrl}/shop`,
    );
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

describe("withoutPriceFilters", () => {
  it("returns null outside /shop even when price params exist (AC-5)", () => {
    expect(
      withoutPriceFilters(
        "/collections/amigurumi",
        new URLSearchParams("minPrice=10&maxPrice=50"),
      ),
    ).toBeNull();
    expect(withoutPriceFilters("/", new URLSearchParams("minPrice=10"))).toBe(
      null,
    );
  });

  it("returns null on /shop when neither minPrice nor maxPrice is present", () => {
    expect(
      withoutPriceFilters(
        "/shop",
        new URLSearchParams("category=bags&sort=price-asc&page=2"),
      ),
    ).toBeNull();
  });

  it("strips minPrice, maxPrice, and page while keeping other filters and sort (AC-5)", () => {
    expect(
      withoutPriceFilters(
        "/shop",
        new URLSearchParams(
          "category=bags&minPrice=500&maxPrice=2000&page=2&sort=price-asc",
        ),
      ),
    ).toBe("/shop?category=bags&sort=price-asc");
  });

  it("strips empty minPrice or maxPrice params and returns bare /shop when empty (AC-5)", () => {
    expect(
      withoutPriceFilters("/shop", new URLSearchParams("minPrice=&page=3")),
    ).toBe("/shop");
    expect(withoutPriceFilters("/shop", new URLSearchParams("maxPrice="))).toBe(
      "/shop",
    );
  });
});
