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

  const subtrees = categories.map((category) =>
    resolveCategorySubtreeIds(categories, category.id),
  );
  const stats =
    await dependencies.catalog.getCategoryStatsForSubtrees(subtrees);
  const data = categories.map((category, index) => {
    const categoryStats = stats[index];
    if (!categoryStats) {
      throw new Error("Category stats are missing for a category.");
    }
    return toCategorySummary(category, categoryStats, dependencies.imageUrls);
  });

  return { data };
}
