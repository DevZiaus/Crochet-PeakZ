import type {
  CatalogListQuery,
  CatalogProductListResponse,
} from "@crochet-peakz/shared";
import { resolveCategorySlugIds } from "../../domain/catalog/category-tree.js";
import type { CatalogProductQuery } from "../../domain/catalog/types.js";
import { toProductSummary } from "./mappers.js";
import type { CatalogDependencies } from "./dependencies.js";

/**
 * Lists visible catalog products.
 *
 * Category slugs expand to their subtrees in this layer, then the repository
 * receives plain ids and never recurses per category.
 *
 * @param dependencies Catalog dependencies.
 * @param query Validated list query.
 * @returns Product summaries and pagination metadata.
 */
export async function listProducts(
  dependencies: CatalogDependencies,
  query: CatalogListQuery,
): Promise<CatalogProductListResponse> {
  let categoryIds: string[] | undefined;
  if (query.category && query.category.length > 0) {
    const categories = await dependencies.catalog.listCategories();
    categoryIds = resolveCategorySlugIds(categories, query.category);
  }

  const repositoryQuery: CatalogProductQuery = {
    currency: query.currency,
    sort: query.sort,
    page: query.page,
    limit: query.limit,
    ...(categoryIds === undefined ? {} : { categoryIds }),
    ...(query.type && query.type.length > 0 ? { types: [...query.type] } : {}),
    ...(query.minPrice === undefined ? {} : { minPrice: query.minPrice }),
    ...(query.maxPrice === undefined ? {} : { maxPrice: query.maxPrice }),
    ...(query.featured === undefined ? {} : { featured: query.featured }),
  };

  const page = await dependencies.catalog.listProducts(repositoryQuery);

  return {
    data: page.items.map((product) =>
      toProductSummary(product, dependencies.imageUrls),
    ),
    meta: page.meta,
  };
}
