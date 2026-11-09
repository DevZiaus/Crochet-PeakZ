import type {
  CatalogCategoryRecord,
  CatalogCategoryStats,
  CatalogProductPage,
  CatalogProductQuery,
  CatalogProductRecord,
} from "../catalog/types.js";

/**
 * Persistence port for the public catalog.
 *
 * Every read applies the visibility rule (`isActive = true` and
 * `deletedAt = null`). The infrastructure layer implements this with Prisma.
 */
export interface CatalogRepository {
  /**
   * Lists visible products matching a query.
   *
   * @param query Validated query with resolved category ids.
   * @returns The clamped page and pagination metadata.
   */
  listProducts(query: CatalogProductQuery): Promise<CatalogProductPage>;

  /**
   * Finds a visible product by slug.
   *
   * @param slug Product slug.
   * @returns The product with images, variants, and direct category, or null.
   */
  findProductBySlug(slug: string): Promise<CatalogProductRecord | null>;

  /**
   * Lists related visible products from the same direct category.
   *
   * @param input Category id, product to exclude, and result limit.
   * @returns Products newest first.
   */
  listRelatedProducts(input: {
    categoryId: string;
    excludeProductId: string;
    limit: number;
  }): Promise<CatalogProductRecord[]>;

  /**
   * Lists every category row.
   *
   * @returns All categories.
   */
  listCategories(): Promise<CatalogCategoryRecord[]>;

  /**
   * Counts visible products and picks the cover for a category subtree.
   *
   * The cover is the primary image of the newest visible product in the
   * subtree. When that product has no image, the cover is null.
   *
   * @param categoryIds Category ids in the subtree.
   * @returns Subtree count and cover.
   */
  getCategoryStats(categoryIds: string[]): Promise<CatalogCategoryStats>;
}
