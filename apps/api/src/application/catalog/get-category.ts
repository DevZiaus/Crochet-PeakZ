import type { CatalogCategoryDetailResponse } from "@crochet-peakz/shared";
import {
  buildCategoryTrail,
  listCategoryChildren,
  resolveCategorySubtreeIds,
} from "../../domain/catalog/category-tree.js";
import { CatalogError } from "./errors.js";
import { toCategoryDetail, toCategorySummary } from "./mappers.js";
import type { CatalogDependencies } from "./dependencies.js";

/**
 * Reads one category with its breadcrumb, children, and subtree count.
 *
 * @param dependencies Catalog dependencies.
 * @param slug Category slug.
 * @returns Category detail.
 * @throws {CatalogError} `CATEGORY_NOT_FOUND` when no category matches.
 */
export async function getCategory(
  dependencies: CatalogDependencies,
  slug: string,
): Promise<CatalogCategoryDetailResponse> {
  const categories = await dependencies.catalog.listCategories();
  const category = categories.find((item) => item.slug === slug);
  if (!category) {
    throw new CatalogError("CATEGORY_NOT_FOUND", "Category not found.");
  }

  const stats = await dependencies.catalog.getCategoryStats(
    resolveCategorySubtreeIds(categories, category.id),
  );

  const trail = buildCategoryTrail(categories, category.id);
  const breadcrumb = trail.slice(0, -1);

  const children = await Promise.all(
    listCategoryChildren(categories, category.id).map(async (child) => {
      const childStats = await dependencies.catalog.getCategoryStats(
        resolveCategorySubtreeIds(categories, child.id),
      );
      return toCategorySummary(child, childStats, dependencies.imageUrls);
    }),
  );

  return {
    data: toCategoryDetail(
      category,
      stats,
      breadcrumb,
      children,
      dependencies.imageUrls,
    ),
  };
}
