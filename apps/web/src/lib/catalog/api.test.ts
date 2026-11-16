import { afterEach, describe, expect, it, vi } from "vitest";

const cacheMock = vi.hoisted(() => {
  const loaders = new Map<string, unknown>();
  const options = new Map<string, unknown>();
  return {
    loaders,
    options,
    unstableCache: (fn: unknown, keys: string[], config: unknown) => {
      loaders.set(keys[0]!, fn);
      options.set(keys[0]!, config);
      return fn;
    },
  };
});

vi.mock("next/cache", () => ({
  unstable_cache: cacheMock.unstableCache,
}));

vi.mock("./env", () => ({
  getCatalogEnv: () => ({ apiInternalUrl: "http://api.test" }),
}));

import {
  CatalogApiError,
  fetchCatalogCategories,
  fetchCatalogCategory,
  fetchCatalogProduct,
  fetchCatalogProducts,
  isCatalogNotFound,
} from "./api";
import {
  makeProductDetail,
  makeProductSummary,
} from "../../test-support/catalog-fixtures";

const detailUrl = "http://api.test/products/sunflower-amigurumi-bear";

const categorySummary = {
  id: "category-1",
  name: "Amigurumi",
  slug: "amigurumi",
  parentId: null,
  description: null,
  productCount: 3,
  coverImageUrl: null,
  coverImageAlt: null,
};

const categoryDetail = {
  ...categorySummary,
  breadcrumb: [],
  children: [],
};

const respond = (body: unknown, status = 200) => {
  // A fresh Response per call: a mock that reuses one instance would hand a
  // consumed body to the second fetch the cached loader tests trigger.
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const loaderFor = (key: string): ((slug: string) => Promise<unknown>) => {
  const loader = cacheMock.loaders.get(key);
  if (loader === undefined) {
    throw new Error(`No cached loader registered for ${key}`);
  }
  return loader as (slug: string) => Promise<unknown>;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchCatalogProduct", () => {
  it("returns the product payload from a cached value and skips the fetch cache", async () => {
    const fetchMock = respond({
      data: { slug: "sunflower-amigurumi-bear", title: "Bear" },
    });

    const product = await fetchCatalogProduct("sunflower-amigurumi-bear");

    expect(product).toMatchObject({
      slug: "sunflower-amigurumi-bear",
      title: "Bear",
    });
    expect(fetchMock).toHaveBeenCalledWith(detailUrl, {
      cache: "no-store",
      signal: expect.any(AbortSignal) as AbortSignal,
    });
  });

  it("stores a not found lookup as a cached value instead of rejecting the loader", async () => {
    respond(
      { error: { message: "Product not found.", code: "NOT_FOUND" } },
      404,
    );

    await expect(
      fetchCatalogProduct("sunflower-amigurumi-bear"),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });

    // The loader that the cache stores must resolve with the not found sentinel.
    // If a 404 throws out of the loader, Next keeps the stale cached 200 forever.
    const lookup = await loaderFor("catalog-product-detail")(
      "sunflower-amigurumi-bear",
    );
    expect(lookup).toMatchObject({
      status: "not-found",
      message: "Product not found.",
      code: "NOT_FOUND",
    });
  });

  it("encodes the slug before calling the API", async () => {
    const fetchMock = respond({ data: makeProductDetail() });

    await fetchCatalogProduct("bear with a bow/limited");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/products/bear%20with%20a%20bow%2Flimited",
      { cache: "no-store", signal: expect.any(AbortSignal) as AbortSignal },
    );
  });

  it("rethrows non 404 failures from the cached loader", async () => {
    respond(
      { error: { message: "Catalog unavailable.", code: "INTERNAL" } },
      500,
    );

    await expect(
      fetchCatalogProduct("sunflower-amigurumi-bear"),
    ).rejects.toBeInstanceOf(CatalogApiError);

    const loader = loaderFor("catalog-product-detail");
    await expect(loader("sunflower-amigurumi-bear")).rejects.toMatchObject({
      statusCode: 500,
    });
  });
});

describe("fetchCatalogProducts", () => {
  it("sends every active filter and caches the list for 60 seconds", async () => {
    const product = makeProductSummary();
    const meta = { page: 2, pageSize: 12, total: 13, totalPages: 2 };
    const fetchMock = respond({ data: [product], meta });

    const result = await fetchCatalogProducts({
      category: ["amigurumi", "home-decor"],
      type: ["STANDARD", "CUSTOM"],
      minPrice: 500,
      maxPrice: 2000,
      currency: "USD",
      sort: "price-asc",
      page: 2,
      limit: 12,
      featured: true,
    });

    expect(result).toEqual({ data: [product], meta });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/products?category=amigurumi&category=home-decor&type=STANDARD&type=CUSTOM&minPrice=500&maxPrice=2000&currency=USD&sort=price-asc&page=2&limit=12&featured=true",
      {
        next: { revalidate: 60 },
        signal: expect.any(AbortSignal) as AbortSignal,
      },
    );
  });

  it("always sends currency and omits filters that are not set", async () => {
    const meta = { page: 1, pageSize: 12, total: 0, totalPages: 0 };
    const fetchMock = respond({ data: [], meta });

    await fetchCatalogProducts({ currency: "BDT", featured: false });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/products?currency=BDT",
      {
        next: { revalidate: 60 },
        signal: expect.any(AbortSignal) as AbortSignal,
      },
    );
  });
});

describe("fetchCatalogCategories", () => {
  it("returns category summaries and caches the list for 60 seconds", async () => {
    const fetchMock = respond({ data: [categorySummary] });

    const categories = await fetchCatalogCategories();

    expect(categories).toEqual([categorySummary]);
    expect(fetchMock).toHaveBeenCalledWith("http://api.test/categories", {
      next: { revalidate: 60 },
      signal: expect.any(AbortSignal) as AbortSignal,
    });
  });
});

describe("fetchCatalogCategory", () => {
  it("returns the category payload and bypasses the fetch cache", async () => {
    const fetchMock = respond({ data: categoryDetail });

    const category = await fetchCatalogCategory("amigurumi");

    expect(category).toEqual(categoryDetail);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/categories/amigurumi",
      { cache: "no-store", signal: expect.any(AbortSignal) as AbortSignal },
    );
  });

  it("caches a not found lookup as a value instead of rejecting the loader", async () => {
    respond(
      { error: { message: "Category not found.", code: "NOT_FOUND" } },
      404,
    );

    await expect(fetchCatalogCategory("amigurumi")).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Category not found.",
    });

    const lookup = await loaderFor("catalog-category-detail")("amigurumi");
    expect(lookup).toMatchObject({
      status: "not-found",
      message: "Category not found.",
      code: "NOT_FOUND",
    });
  });

  it("rethrows non 404 failures from the cached loader", async () => {
    respond(
      { error: { message: "Catalog unavailable.", code: "INTERNAL" } },
      500,
    );

    await expect(fetchCatalogCategory("amigurumi")).rejects.toBeInstanceOf(
      CatalogApiError,
    );

    const loader = loaderFor("catalog-category-detail");
    await expect(loader("amigurumi")).rejects.toMatchObject({
      statusCode: 500,
    });
  });
});

describe("catalog failures", () => {
  it("reports status 0 when the API cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("connect ECONNREFUSED")),
    );

    await expect(
      fetchCatalogProducts({ currency: "BDT" }),
    ).rejects.toMatchObject({
      name: "CatalogApiError",
      statusCode: 0,
      message: "We could not reach the catalog. Please try again.",
    });
  });

  it("uses a status message when the error body has no API error shape", async () => {
    respond({ message: "nope" }, 503);

    await expect(
      fetchCatalogProducts({ currency: "BDT" }),
    ).rejects.toMatchObject({
      statusCode: 503,
      message: "The catalog request failed with status 503.",
      code: undefined,
    });
  });

  it("treats a non JSON error body as a plain failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            new Response("<html>bad gateway</html>", { status: 502 }),
          ),
        ),
    );

    await expect(
      fetchCatalogProducts({ currency: "BDT" }),
    ).rejects.toMatchObject({
      statusCode: 502,
      message: "The catalog request failed with status 502.",
    });
  });

  it("tells not found errors apart from other catalog failures", () => {
    expect(isCatalogNotFound(new CatalogApiError("missing", 404))).toBe(true);
    expect(
      isCatalogNotFound(new CatalogApiError("missing", 404, "NOT_FOUND")),
    ).toBe(true);
    expect(isCatalogNotFound(new CatalogApiError("broken", 500))).toBe(false);
    expect(isCatalogNotFound(new Error("missing"))).toBe(false);
    expect(isCatalogNotFound(null)).toBe(false);
  });
});

describe("detail cache registration", () => {
  it("registers both detail lookups for a 60 second revalidate window", () => {
    expect(cacheMock.options.get("catalog-product-detail")).toEqual({
      revalidate: 60,
    });
    expect(cacheMock.options.get("catalog-category-detail")).toEqual({
      revalidate: 60,
    });
  });
});
