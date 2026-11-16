import {
  clampPage,
  getBasePrice,
  isVisibleProduct,
  pickPrimaryImage,
} from "../domain/catalog/rules.js";
import type {
  CatalogCategoryRecord,
  CatalogCategoryStats,
  CatalogImageRecord,
  CatalogProductPage,
  CatalogProductQuery,
  CatalogProductRecord,
  CatalogVariantRecord,
} from "../domain/catalog/types.js";
import type { CatalogRepository } from "../domain/ports/catalog-repository.js";
import type { ImageUrlResolver } from "../domain/ports/image-url-resolver.js";

/** Builds a category record for tests. */
export function makeCategory(
  overrides: Partial<CatalogCategoryRecord> & { id: string; slug: string },
): CatalogCategoryRecord {
  return {
    name: overrides.slug,
    parentId: null,
    description: null,
    ...overrides,
  };
}

/** Builds a variant record for tests. */
export function makeVariant(
  overrides: Partial<CatalogVariantRecord> & { id: string },
): CatalogVariantRecord {
  return {
    sku: null,
    colorName: null,
    colorHex: null,
    sizeLabel: null,
    yarnType: null,
    stockQuantity: 0,
    additionalPriceBdt: 0,
    additionalPriceUsd: 0,
    ...overrides,
  };
}

/** Builds an image record for tests. */
export function makeImage(
  overrides: Partial<CatalogImageRecord> & { id: string },
): CatalogImageRecord {
  return {
    imageUrl: `image-${overrides.id}`,
    altText: null,
    isPrimary: false,
    displayOrder: 0,
    ...overrides,
  };
}

/** Builds a product record for tests. */
export function makeProduct(
  overrides: Partial<CatalogProductRecord> & { id: string; slug: string },
): CatalogProductRecord {
  return {
    categoryId: null,
    title: overrides.slug,
    description: "A handmade piece.",
    productType: "STANDARD",
    priceBdt: 1000,
    priceUsd: 12,
    isActive: true,
    isFeatured: false,
    leadTimeDays: 0,
    metaTitle: null,
    metaDescription: null,
    tags: [],
    deletedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    category: null,
    images: [],
    variants: [],
    ...overrides,
  };
}

/** Compares identifiers using PostgreSQL's plain ascending text order. */
export function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Resolver that returns the stored value unchanged, for tests. */
export const identityImageUrls: ImageUrlResolver = {
  resolve(publicId) {
    return publicId ?? null;
  },
};

/** In memory catalog repository used by use case and router tests. */
export class InMemoryCatalogRepository implements CatalogRepository {
  /** Category rows. */
  categories: CatalogCategoryRecord[] = [];
  /** Product rows. */
  products: CatalogProductRecord[] = [];

  /** @inheritdoc */
  async listProducts(query: CatalogProductQuery): Promise<CatalogProductPage> {
    await Promise.resolve();
    const filtered = this.products
      .filter(isVisibleProduct)
      .filter((product) =>
        query.categoryIds === undefined
          ? true
          : product.categoryId !== null &&
            query.categoryIds.includes(product.categoryId),
      )
      .filter((product) =>
        query.types === undefined
          ? true
          : query.types.includes(product.productType),
      )
      .filter((product) => {
        const price = getBasePrice(product, query.currency);
        if (query.minPrice !== undefined && price < query.minPrice) {
          return false;
        }
        if (query.maxPrice !== undefined && price > query.maxPrice) {
          return false;
        }
        return true;
      })
      .filter((product) =>
        query.featured === undefined
          ? true
          : product.isFeatured === query.featured,
      );

    filtered.sort((left, right) => {
      if (query.sort !== "newest") {
        const difference =
          getBasePrice(left, query.currency) -
          getBasePrice(right, query.currency);
        if (difference !== 0) {
          return query.sort === "price-asc" ? difference : -difference;
        }
      }
      const created = right.createdAt.getTime() - left.createdAt.getTime();
      if (created !== 0) {
        return created;
      }
      return compareIds(left.id, right.id);
    });

    const total = filtered.length;
    const { page, totalPages } = clampPage(query.page, total, query.limit);
    const start = (page - 1) * query.limit;

    return {
      items: filtered.slice(start, start + query.limit),
      meta: { page, pageSize: query.limit, total, totalPages },
    };
  }

  /** @inheritdoc */
  async findProductBySlug(slug: string): Promise<CatalogProductRecord | null> {
    await Promise.resolve();
    return (
      this.products.find(
        (product) => product.slug === slug && isVisibleProduct(product),
      ) ?? null
    );
  }

  /** @inheritdoc */
  async listRelatedProducts(input: {
    categoryId: string;
    excludeProductId: string;
    limit: number;
  }): Promise<CatalogProductRecord[]> {
    await Promise.resolve();
    return this.products
      .filter(isVisibleProduct)
      .filter(
        (product) =>
          product.categoryId === input.categoryId &&
          product.id !== input.excludeProductId,
      )
      .sort((left, right) => {
        const created = right.createdAt.getTime() - left.createdAt.getTime();
        return created !== 0 ? created : compareIds(left.id, right.id);
      })
      .slice(0, input.limit);
  }

  /** @inheritdoc */
  async listCategories(): Promise<CatalogCategoryRecord[]> {
    await Promise.resolve();
    return [...this.categories].sort((left, right) =>
      left.name.localeCompare(right.name, "en"),
    );
  }

  /** @inheritdoc */
  async getCategoryStatsForSubtrees(
    categorySubtrees: string[][],
  ): Promise<CatalogCategoryStats[]> {
    await Promise.resolve();
    return categorySubtrees.map((categoryIds) => {
      const visible = this.products
        .filter(isVisibleProduct)
        .filter(
          (product) =>
            product.categoryId !== null &&
            categoryIds.includes(product.categoryId),
        );

      const newest = [...visible].sort((left, right) => {
        const created = right.createdAt.getTime() - left.createdAt.getTime();
        return created !== 0 ? created : compareIds(left.id, right.id);
      })[0];
      const primary = newest ? pickPrimaryImage(newest.images) : null;

      return {
        productCount: visible.length,
        coverImageUrl: primary?.imageUrl ?? null,
        coverImageAlt: primary?.altText ?? null,
      };
    });
  }
}
