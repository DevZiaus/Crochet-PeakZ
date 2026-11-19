import type { CatalogProductDetailResponse } from "@crochet-peakz/shared";
import { buildCategoryTrail } from "../../domain/catalog/category-tree.js";
import { CatalogError } from "./errors.js";
import { toProductDetail } from "./mappers.js";
import type { CatalogDependencies } from "./dependencies.js";

/**
 * Reads one visible product by slug.
 *
 * @param dependencies Catalog dependencies.
 * @param slug Product slug.
 * @returns Product detail with trail and related products.
 * @throws {CatalogError} `PRODUCT_NOT_FOUND` when no visible product matches.
 */
export async function getProduct(
  dependencies: CatalogDependencies,
  slug: string,
): Promise<CatalogProductDetailResponse> {
  const product = await dependencies.catalog.findProductBySlug(slug);
  if (!product) {
    throw new CatalogError("PRODUCT_NOT_FOUND", "Product not found.");
  }

  const [categories, related] = await Promise.all([
    dependencies.catalog.listCategories(),
    product.categoryId
      ? dependencies.catalog.listRelatedProducts({
          categoryId: product.categoryId,
          excludeProductId: product.id,
          limit: 4,
        })
      : Promise.resolve([]),
  ]);
  const categoryTrail = product.categoryId
    ? buildCategoryTrail(categories, product.categoryId)
    : [];

  return {
    data: toProductDetail(
      product,
      related,
      categoryTrail,
      dependencies.imageUrls,
    ),
  };
}
