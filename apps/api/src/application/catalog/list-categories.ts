import type { CatalogCategoryListResponse } from "@crochet-peakz/shared";
import { resolveCategorySubtreeIds } from "../../domain/catalog/category-tree.js";
import { toCategorySummary } from "./mappers.js";
import type { CatalogDependencies } from "./dependencies.js";

/**
 * Lists every category with its subtree product count and cover.
 *
 * @param dependencies Catalog dependencies.
 * @returns Category summaries ordered by name.
 */
export async function listCategories(
  dependencies: CatalogDependencies,
): Promise<CatalogCategoryListResponse> {
  const categories = await dependencies.catalog.listCategories();

  const data = await Promise.all(
    categories.map(async (category) => {
      const stats = await dependencies.catalog.getCategoryStats(
        resolveCategorySubtreeIds(categories, category.id),
      );
      return toCategorySummary(category, stats, dependencies.imageUrls);
    }),
  );

  return { data };
}
