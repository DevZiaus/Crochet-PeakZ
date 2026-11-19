import type {
  CategoryDetailDto,
  CategoryRefDto,
  CategorySummaryDto,
  ProductDetailDto,
  ProductImageDto,
  ProductSummaryDto,
  ProductVariantDto,
} from "@crochet-peakz/shared";
import {
  isProductAvailable,
  isVariantInStock,
  orderImages,
  orderVariants,
  pickPrimaryImage,
} from "../../domain/catalog/rules.js";
import type {
  CatalogCategoryRecord,
  CatalogCategoryStats,
  CatalogImageRecord,
  CatalogProductRecord,
  CatalogVariantRecord,
} from "../../domain/catalog/types.js";
import type { ImageUrlResolver } from "../../domain/ports/image-url-resolver.js";

/**
 * Maps a category row to its reference shape.
 *
 * @param category Category row.
 * @returns Category reference DTO.
 */
export function toCategoryRef(
  category: Pick<CatalogCategoryRecord, "id" | "name" | "slug">,
): CategoryRefDto {
  return { id: category.id, name: category.name, slug: category.slug };
}

/**
 * Maps a product row to a summary DTO.
 *
 * @param product Product row with images, variants, and category.
 * @param imageUrls Cloudinary URL resolver.
 * @returns Product summary DTO.
 */
export function toProductSummary(
  product: CatalogProductRecord,
  imageUrls: ImageUrlResolver,
): ProductSummaryDto {
  const primaryImage = pickPrimaryImage(product.images);

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    productType: product.productType,
    priceBdt: product.priceBdt,
    priceUsd: product.priceUsd,
    primaryImageUrl: imageUrls.resolve(primaryImage?.imageUrl ?? null),
    primaryImageAlt: primaryImage?.altText ?? null,
    isFeatured: product.isFeatured,
    inStock: isProductAvailable(product.productType, product.variants),
    leadTimeDays: product.leadTimeDays,
    category: product.category ? toCategoryRef(product.category) : null,
    tags: product.tags,
  };
}

/**
 * Maps a variant row to its DTO.
 *
 * @param variant Variant row.
 * @param productType Product kind, used for the stock rule.
 * @returns Variant DTO.
 */
export function toProductVariant(
  variant: CatalogVariantRecord,
  productType: CatalogProductRecord["productType"],
): ProductVariantDto {
  return {
    id: variant.id,
    sku: variant.sku,
    colorName: variant.colorName,
    colorHex: variant.colorHex,
    sizeLabel: variant.sizeLabel,
    yarnType: variant.yarnType,
    stockQuantity: variant.stockQuantity,
    inStock: isVariantInStock(productType, variant.stockQuantity),
    additionalPriceBdt: variant.additionalPriceBdt,
    additionalPriceUsd: variant.additionalPriceUsd,
  };
}

/**
 * Maps gallery images to DTOs, primary first.
 *
 * Images whose URL cannot be resolved are dropped.
 *
 * @param images Product images.
 * @param imageUrls Cloudinary URL resolver.
 * @returns Gallery image DTOs.
 */
export function toProductImages(
  images: readonly CatalogImageRecord[],
  imageUrls: ImageUrlResolver,
): ProductImageDto[] {
  return orderImages(images).flatMap((image) => {
    const url = imageUrls.resolve(image.imageUrl);
    if (url === null) {
      return [];
    }
    return [
      {
        url,
        alt: image.altText,
        isPrimary: image.isPrimary,
        displayOrder: image.displayOrder,
      },
    ];
  });
}

/**
 * Maps a product row to its detail DTO.
 *
 * @param product Product row.
 * @param related Related product rows.
 * @param categoryTrail Category rows from root to the direct category.
 * @param imageUrls Cloudinary URL resolver.
 * @returns Product detail DTO.
 */
export function toProductDetail(
  product: CatalogProductRecord,
  related: readonly CatalogProductRecord[],
  categoryTrail: readonly CatalogCategoryRecord[],
  imageUrls: ImageUrlResolver,
): ProductDetailDto {
  return {
    ...toProductSummary(product, imageUrls),
    description: product.description,
    images: toProductImages(product.images, imageUrls),
    variants: orderVariants(product.variants).map((variant) =>
      toProductVariant(variant, product.productType),
    ),
    metaTitle: product.metaTitle,
    metaDescription: product.metaDescription,
    categoryTrail: categoryTrail.map(toCategoryRef),
    related: related.map((item) => toProductSummary(item, imageUrls)),
  };
}

/**
 * Maps a category row and its stats to a summary DTO.
 *
 * @param category Category row.
 * @param stats Subtree count and cover.
 * @param imageUrls Cloudinary URL resolver.
 * @returns Category summary DTO.
 */
export function toCategorySummary(
  category: CatalogCategoryRecord,
  stats: CatalogCategoryStats,
  imageUrls: ImageUrlResolver,
): CategorySummaryDto {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    parentId: category.parentId,
    description: category.description,
    productCount: stats.productCount,
    coverImageUrl: imageUrls.resolve(stats.coverImageUrl),
    coverImageAlt: stats.coverImageAlt,
  };
}

/**
 * Maps a category row, its stats, trail, and children to a detail DTO.
 *
 * @param category Category row.
 * @param stats Subtree count and cover.
 * @param breadcrumb Category rows from root to the parent.
 * @param children Child category summaries.
 * @param imageUrls Cloudinary URL resolver.
 * @returns Category detail DTO.
 */
export function toCategoryDetail(
  category: CatalogCategoryRecord,
  stats: CatalogCategoryStats,
  breadcrumb: readonly CatalogCategoryRecord[],
  children: readonly CategorySummaryDto[],
  imageUrls: ImageUrlResolver,
): CategoryDetailDto {
  return {
    ...toCategorySummary(category, stats, imageUrls),
    breadcrumb: breadcrumb.map(toCategoryRef),
    children: [...children],
  };
}
