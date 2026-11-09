/**
 * Integration tests for the Prisma catalog repository.
 *
 * These tests run against a real PostgreSQL database and prove the read path
 * the storefront depends on: visibility is always applied, filters and sorts
 * hit the columns the spec names, pagination clamps, and images and variants
 * come back in the order the API maps into DTOs.
 *
 * The database is shared, so every slug and category is randomized and every
 * row created here is deleted afterwards.
 */
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { config as loadDotEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, type Database } from "./prisma.js";
import { PrismaCatalogRepository } from "./catalog.repository.js";
import type { CatalogProductQuery } from "../../domain/catalog/types.js";

loadDotEnv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});

const databaseUrl = process.env["DATABASE_URL"];
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase("PrismaCatalogRepository", () => {
  let database: Database;
  let repository: PrismaCatalogRepository;

  const suffix = randomUUID().slice(0, 8);
  const categoryIds: string[] = [];
  const productIds: string[] = [];

  let parentCategoryId: string;
  let childCategoryId: string;
  let visibleChildProductId: string;
  let hiddenProductId: string;
  let deletedProductId: string;

  beforeAll(async () => {
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required.");
    }

    database = createDatabase(databaseUrl);
    repository = new PrismaCatalogRepository(database.client);

    const parent = await database.client.category.create({
      data: {
        name: `Catalog Parent ${suffix}`,
        slug: `catalog-parent-${suffix}`,
        description: "Parent description",
      },
    });
    categoryIds.push(parent.id);
    parentCategoryId = parent.id;

    const child = await database.client.category.create({
      data: {
        name: `Catalog Child ${suffix}`,
        slug: `catalog-child-${suffix}`,
        parentId: parent.id,
      },
    });
    categoryIds.push(child.id);
    childCategoryId = child.id;

    const visibleChild = await database.client.product.create({
      data: {
        categoryId: child.id,
        title: `Visible Child ${suffix}`,
        slug: `visible-child-${suffix}`,
        description: "A visible product in the child category.",
        productType: "STANDARD",
        priceBdt: 1200,
        priceUsd: 15,
        isActive: true,
        isFeatured: true,
        leadTimeDays: 5,
        tags: ["cotton"],
        images: {
          create: [
            {
              imageUrl: `catalog/secondary-${suffix}`,
              altText: "Secondary",
              isPrimary: false,
              displayOrder: 1,
            },
            {
              imageUrl: `catalog/primary-${suffix}`,
              altText: "Primary",
              isPrimary: true,
              displayOrder: 9,
            },
          ],
        },
        variants: {
          create: [
            {
              sku: `catalog-visible-b-${suffix}`,
              colorName: "Blush",
              stockQuantity: 0,
            },
            {
              sku: `catalog-visible-a-${suffix}`,
              colorName: "Honey",
              stockQuantity: 4,
              additionalPriceBdt: 100,
              additionalPriceUsd: 1.5,
            },
          ],
        },
      },
    });
    productIds.push(visibleChild.id);
    visibleChildProductId = visibleChild.id;

    const hidden = await database.client.product.create({
      data: {
        categoryId: child.id,
        title: `Hidden ${suffix}`,
        slug: `hidden-${suffix}`,
        description: "Inactive product.",
        priceBdt: 900,
        priceUsd: 11,
        isActive: false,
        images: {
          create: {
            imageUrl: `catalog/hidden-${suffix}`,
            isPrimary: true,
          },
        },
      },
    });
    productIds.push(hidden.id);
    hiddenProductId = hidden.id;

    const deleted = await database.client.product.create({
      data: {
        categoryId: child.id,
        title: `Deleted ${suffix}`,
        slug: `deleted-${suffix}`,
        description: "Soft deleted product.",
        priceBdt: 800,
        priceUsd: 10,
        deletedAt: new Date(),
      },
    });
    productIds.push(deleted.id);
    deletedProductId = deleted.id;

    const visibleParent = await database.client.product.create({
      data: {
        categoryId: parent.id,
        title: `Visible Parent ${suffix}`,
        slug: `visible-parent-${suffix}`,
        description: "A visible product in the parent category.",
        productType: "CUSTOM",
        priceBdt: 2500,
        priceUsd: 31,
        leadTimeDays: 21,
        createdAt: new Date(Date.now() - 60_000),
      },
    });
    productIds.push(visibleParent.id);
  });

  afterAll(async () => {
    if (productIds.length > 0) {
      await database.client.product.deleteMany({
        where: { id: { in: productIds } },
      });
    }
    if (categoryIds.length > 0) {
      await database.client.category.deleteMany({
        where: { id: { in: categoryIds } },
      });
    }
    await database.disconnect();
  });

  /** Builds a list query scoped to the created category subtree. */
  function subtreeQuery(
    overrides: Partial<CatalogProductQuery> = {},
  ): CatalogProductQuery {
    return {
      categoryIds: [parentCategoryId, childCategoryId],
      currency: "BDT" as const,
      sort: "newest" as const,
      page: 1,
      limit: 12,
      ...overrides,
    };
  }

  it("lists only visible products and applies the category subtree filter", async () => {
    const page = await repository.listProducts(subtreeQuery());

    expect(page.meta.total).toBe(2);
    const ids = page.items.map((item) => item.id);
    expect(ids).toContain(visibleChildProductId);
    expect(ids).not.toContain(hiddenProductId);
    expect(ids).not.toContain(deletedProductId);
  });

  it("filters by product type, price, and featured", async () => {
    const custom = await repository.listProducts(
      subtreeQuery({ types: ["CUSTOM"] }),
    );
    expect(custom.items).toHaveLength(1);
    expect(custom.items[0]?.title).toContain("Visible Parent");

    const cheap = await repository.listProducts(
      subtreeQuery({ maxPrice: 1500 }),
    );
    expect(cheap.items.map((item) => item.id)).toEqual([visibleChildProductId]);

    const featured = await repository.listProducts(
      subtreeQuery({ featured: true }),
    );
    expect(featured.items.map((item) => item.id)).toEqual([
      visibleChildProductId,
    ]);
  });

  it("sorts price ascending and descending on the active currency column", async () => {
    const ascending = await repository.listProducts(
      subtreeQuery({ sort: "price-asc" }),
    );
    expect(ascending.items[0]?.priceBdt).toBe(1200);

    const descending = await repository.listProducts(
      subtreeQuery({ sort: "price-desc" }),
    );
    expect(descending.items[0]?.priceBdt).toBe(2500);
  });

  it("clamps a page beyond the last page", async () => {
    const page = await repository.listProducts(
      subtreeQuery({ page: 99, limit: 1 }),
    );

    expect(page.meta.page).toBe(2);
    expect(page.meta.totalPages).toBe(2);
    expect(page.items).toHaveLength(1);
  });

  it("returns a visible product with ordered images and variants", async () => {
    const product = await repository.findProductBySlug(
      `visible-child-${suffix}`,
    );

    expect(product?.id).toBe(visibleChildProductId);
    expect(product?.category?.id).toBe(childCategoryId);
    expect(product?.images.map((image) => image.isPrimary)).toEqual([
      true,
      false,
    ]);
    expect(product?.variants).toHaveLength(2);
    expect(product?.variants.map((variant) => variant.colorName)).toEqual([
      "Blush",
      "Honey",
    ]);
    expect(product?.variants[1]?.additionalPriceBdt).toBe(100);
  });

  it("returns null for hidden and soft deleted product slugs", async () => {
    await expect(
      repository.findProductBySlug(`hidden-${suffix}`),
    ).resolves.toBeNull();
    await expect(
      repository.findProductBySlug(`deleted-${suffix}`),
    ).resolves.toBeNull();
  });

  it("lists related visible products from the same direct category", async () => {
    const related = await repository.listRelatedProducts({
      categoryId: childCategoryId,
      excludeProductId: visibleChildProductId,
      limit: 4,
    });

    expect(related.map((item) => item.id)).not.toContain(visibleChildProductId);
    expect(related.map((item) => item.id)).not.toContain(hiddenProductId);
    expect(related.map((item) => item.id)).not.toContain(deletedProductId);
  });

  it("lists every category including the created subtree", async () => {
    const categories = await repository.listCategories();
    const slugs = categories.map((category) => category.slug);

    expect(slugs).toContain(`catalog-parent-${suffix}`);
    expect(slugs).toContain(`catalog-child-${suffix}`);
  });

  it("counts visible subtree products and picks the newest primary image as cover", async () => {
    const stats = await repository.getCategoryStats([
      parentCategoryId,
      childCategoryId,
    ]);

    expect(stats.productCount).toBe(2);
    expect(stats.coverImageUrl).toBe(`catalog/primary-${suffix}`);
    expect(stats.coverImageAlt).toBe("Primary");
  });
});
