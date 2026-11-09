import {
  ProductType,
  type ProductDetailDto,
  type ProductSummaryDto,
  type ProductVariantDto,
} from "@crochet-peakz/shared";

/**
 * Builds a product variant with sensible defaults for tests.
 *
 * @param overrides Fields to override.
 * @returns A product variant DTO.
 */
export function makeVariant(
  overrides: Partial<ProductVariantDto> = {},
): ProductVariantDto {
  return {
    id: "variant-1",
    sku: "SKU-1",
    colorName: "Honey Gold",
    colorHex: "#d9a441",
    sizeLabel: null,
    yarnType: null,
    stockQuantity: 5,
    inStock: true,
    additionalPriceBdt: 0,
    additionalPriceUsd: 0,
    ...overrides,
  };
}

/**
 * Builds a product summary with sensible defaults for tests.
 *
 * @param overrides Fields to override.
 * @returns A product summary DTO.
 */
export function makeProductSummary(
  overrides: Partial<ProductSummaryDto> = {},
): ProductSummaryDto {
  return {
    id: "product-1",
    slug: "sunflower-amigurumi-bear",
    title: "Sunflower Amigurumi Bear",
    productType: ProductType.STANDARD,
    priceBdt: 1800,
    priceUsd: 22,
    primaryImageUrl: "https://res.cloudinary.com/demo/image/upload/bear",
    primaryImageAlt: "A crocheted bear",
    isFeatured: true,
    inStock: true,
    leadTimeDays: 0,
    category: { id: "category-1", name: "Amigurumi", slug: "amigurumi" },
    tags: ["amigurumi", "gift"],
    ...overrides,
  };
}

/**
 * Builds a product detail with sensible defaults for tests.
 *
 * @param overrides Fields to override.
 * @returns A product detail DTO.
 */
export function makeProductDetail(
  overrides: Partial<ProductDetailDto> = {},
): ProductDetailDto {
  return {
    ...makeProductSummary(),
    description: "A soft, handmade bear worked in cotton.",
    images: [
      {
        url: "https://res.cloudinary.com/demo/image/upload/bear",
        alt: "A crocheted bear",
        isPrimary: true,
        displayOrder: 0,
      },
    ],
    variants: [],
    metaTitle: null,
    metaDescription: null,
    categoryTrail: [{ id: "category-1", name: "Amigurumi", slug: "amigurumi" }],
    related: [],
    ...overrides,
  };
}
