import { describe, expect, it } from "vitest";
import type { CatalogListQuery } from "@crochet-peakz/shared";
import { catalogListQuerySchema } from "@crochet-peakz/shared";
import {
  identityImageUrls,
  InMemoryCatalogRepository,
  makeCategory,
  makeImage,
  makeProduct,
  makeVariant,
} from "../../test-support/catalog-fakes.js";
import type { CatalogDependencies } from "./dependencies.js";
import { CatalogError } from "./errors.js";
import { getCategory } from "./get-category.js";
import { getProduct } from "./get-product.js";
import { listCategories } from "./list-categories.js";
import { listProducts } from "./list-products.js";

/**
 * Builds a repository with a small category tree and product set.
 *
 * @returns The repository and dependencies.
 */
function createFixture(): {
  repository: InMemoryCatalogRepository;
  dependencies: CatalogDependencies;
} {
  const repository = new InMemoryCatalogRepository();

  repository.categories = [
    makeCategory({ id: "root", slug: "wearables", name: "Wearables" }),
    makeCategory({
      id: "scarves",
      slug: "scarves",
      name: "Scarves",
      parentId: "root",
    }),
    makeCategory({ id: "amigurumi", slug: "amigurumi", name: "Amigurumi" }),
  ];

  repository.products = [
    makeProduct({
      id: "bear",
      slug: "bear",
      title: "Bear",
      categoryId: "amigurumi",
      category: { id: "amigurumi", name: "Amigurumi", slug: "amigurumi" },
      priceBdt: 1800,
      priceUsd: 22,
      isFeatured: true,
      createdAt: new Date("2026-01-03T00:00:00.000Z"),
      images: [
        makeImage({ id: "bear-2", displayOrder: 2 }),
        makeImage({
          id: "bear-1",
          displayOrder: 1,
          isPrimary: true,
          altText: "Bear front",
        }),
      ],
      variants: [
        makeVariant({
          id: "bear-v1",
          colorName: "Honey",
          stockQuantity: 3,
        }),
        makeVariant({ id: "bear-v2", colorName: "Blush", stockQuantity: 0 }),
      ],
    }),
    makeProduct({
      id: "scarf",
      slug: "scarf",
      title: "Scarf",
      categoryId: "scarves",
      category: { id: "scarves", name: "Scarves", slug: "scarves" },
      priceBdt: 2400,
      priceUsd: 29,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      variants: [makeVariant({ id: "scarf-v1", stockQuantity: 5 })],
    }),
    makeProduct({
      id: "doily",
      slug: "doily",
      title: "Doily",
      productType: "ONE_OF_A_KIND",
      priceBdt: 4500,
      priceUsd: 55,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      variants: [makeVariant({ id: "doily-v1", stockQuantity: 1 })],
    }),
    makeProduct({
      id: "digital",
      slug: "digital",
      title: "Digital pattern",
      productType: "DIGITAL",
      priceBdt: 800,
      priceUsd: 9.99,
      createdAt: new Date("2025-12-31T00:00:00.000Z"),
    }),
    makeProduct({
      id: "hidden",
      slug: "hidden",
      title: "Hidden",
      categoryId: "amigurumi",
      isActive: false,
    }),
    makeProduct({
      id: "deleted",
      slug: "deleted",
      title: "Deleted",
      categoryId: "amigurumi",
      deletedAt: new Date("2026-01-04T00:00:00.000Z"),
    }),
  ];

  return {
    repository,
    dependencies: { catalog: repository, imageUrls: identityImageUrls },
  };
}

/**
 * Parses a raw query through the shared schema.
 *
 * @param raw Raw query object.
 * @returns Validated query.
 */
function query(raw: Record<string, unknown>): CatalogListQuery {
  return catalogListQuerySchema.parse(raw);
}

describe("listProducts use case", () => {
  it("expands a parent category to its descendants", async () => {
    const { dependencies } = createFixture();

    const result = await listProducts(
      dependencies,
      query({ category: "wearables" }),
    );

    expect(result.data.map((product) => product.slug)).toEqual(["scarf"]);
  });

  it("combines repeated types with OR", async () => {
    const { dependencies } = createFixture();

    const result = await listProducts(
      dependencies,
      query({ type: ["STANDARD", "DIGITAL"] }),
    );

    expect(result.data.map((product) => product.slug)).toEqual([
      "bear",
      "scarf",
      "digital",
    ]);
  });

  it("filters by the active currency price column", async () => {
    const { dependencies } = createFixture();

    const result = await listProducts(
      dependencies,
      query({ currency: "USD", minPrice: "20", maxPrice: "30" }),
    );

    expect(result.data.map((product) => product.slug)).toEqual([
      "bear",
      "scarf",
    ]);
  });

  it("filters featured products and maps summary fields", async () => {
    const { dependencies } = createFixture();

    const result = await listProducts(
      dependencies,
      query({ featured: "true" }),
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      slug: "bear",
      inStock: true,
      primaryImageUrl: "image-bear-1",
      primaryImageAlt: "Bear front",
      category: { slug: "amigurumi" },
    });
  });

  it("clamps a page beyond the last page", async () => {
    const { dependencies } = createFixture();

    const result = await listProducts(
      dependencies,
      query({ page: "99", limit: "2" }),
    );

    expect(result.meta).toEqual({
      page: 2,
      pageSize: 2,
      total: 4,
      totalPages: 2,
    });
    expect(result.data.map((product) => product.slug)).toEqual([
      "doily",
      "digital",
    ]);
  });

  it("returns an empty page for an unknown category slug", async () => {
    const { dependencies } = createFixture();

    const result = await listProducts(
      dependencies,
      query({ category: "missing" }),
    );

    expect(result.data).toEqual([]);
    expect(result.meta.totalPages).toBe(0);
    expect(result.meta.page).toBe(1);
  });
});

describe("getProduct use case", () => {
  it("returns images, variants, trail, and related products", async () => {
    const { dependencies } = createFixture();

    const result = await getProduct(dependencies, "bear");

    expect(result.data.images.map((image) => image.url)).toEqual([
      "image-bear-1",
      "image-bear-2",
    ]);
    expect(result.data.variants[0]).toMatchObject({
      id: "bear-v1",
      inStock: true,
      stockQuantity: 3,
    });
    expect(result.data.variants[1]).toMatchObject({
      id: "bear-v2",
      inStock: false,
    });
    expect(result.data.categoryTrail.map((item) => item.slug)).toEqual([
      "amigurumi",
    ]);
    expect(result.data.related).toEqual([]);
  });

  it("returns related products from the same direct category", async () => {
    const { dependencies, repository } = createFixture();
    repository.products.push(
      makeProduct({
        id: "bunny",
        slug: "bunny",
        categoryId: "amigurumi",
        createdAt: new Date("2026-01-04T00:00:00.000Z"),
      }),
    );

    const result = await getProduct(dependencies, "bear");

    expect(result.data.related.map((product) => product.slug)).toEqual([
      "bunny",
    ]);
  });

  it("throws PRODUCT_NOT_FOUND for hidden products", async () => {
    const { dependencies } = createFixture();

    await expect(getProduct(dependencies, "hidden")).rejects.toMatchObject({
      code: "PRODUCT_NOT_FOUND",
    });
  });

  it("returns no related products for a product with no category", async () => {
    const { dependencies } = createFixture();

    const result = await getProduct(dependencies, "doily");

    expect(result.data.related).toEqual([]);
    expect(result.data.categoryTrail).toEqual([]);
  });
});

describe("listCategories use case", () => {
  it("returns subtree counts and the newest cover image", async () => {
    const { dependencies, repository } = createFixture();
    const originalStats =
      repository.getCategoryStatsForSubtrees.bind(repository);
    let statsBatchCount = 0;
    repository.getCategoryStatsForSubtrees = async (subtrees) => {
      statsBatchCount += 1;
      return originalStats(subtrees);
    };

    const result = await listCategories(dependencies);

    const wearables = result.data.find((item) => item.slug === "wearables");
    const amigurumi = result.data.find((item) => item.slug === "amigurumi");

    expect(statsBatchCount).toBe(1);
    expect(wearables).toMatchObject({ productCount: 1, coverImageUrl: null });
    expect(amigurumi).toMatchObject({
      productCount: 1,
      coverImageUrl: "image-bear-1",
      coverImageAlt: "Bear front",
    });
  });
});

describe("getCategory use case", () => {
  it("returns the parent trail and nonempty child categories", async () => {
    const { dependencies } = createFixture();

    const result = await getCategory(dependencies, "scarves");

    expect(result.data.breadcrumb.map((item) => item.slug)).toEqual([
      "wearables",
    ]);
    expect(result.data.children).toEqual([]);
    expect(result.data.productCount).toBe(1);
  });

  it("throws CATEGORY_NOT_FOUND for unknown slugs", async () => {
    const { dependencies } = createFixture();

    await expect(getCategory(dependencies, "missing")).rejects.toBeInstanceOf(
      CatalogError,
    );
  });
});
