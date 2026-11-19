import type { ProductType } from "../types/index.js";

/** Sort orders the catalog list endpoint accepts. */
export type CatalogSort = "newest" | "price-asc" | "price-desc";

/** A category reference used in trails and product summaries. */
export interface CategoryRefDto {
  /** Category id (UUID v7). */
  id: string;
  /** Display name. */
  name: string;
  /** URL slug. */
  slug: string;
}

/** A product summary returned by the catalog list and related sections. */
export interface ProductSummaryDto {
  /** Product id (UUID v7). */
  id: string;
  /** URL slug. */
  slug: string;
  /** Display title. */
  title: string;
  /** Product kind. */
  productType: ProductType;
  /** Base price in BDT. */
  priceBdt: number;
  /** Base price in USD. */
  priceUsd: number;
  /** Resolved primary image URL, or null when the product has no image. */
  primaryImageUrl: string | null;
  /** Alt text for the primary image, or null. */
  primaryImageAlt: string | null;
  /** Whether the product is featured. */
  isFeatured: boolean;
  /** Whether the product can be purchased. */
  inStock: boolean;
  /** Lead time in days. Zero means ready to ship. */
  leadTimeDays: number;
  /** Direct category, or null. */
  category: CategoryRefDto | null;
  /** Free form tags. */
  tags: string[];
}

/** One product gallery image. */
export interface ProductImageDto {
  /** Resolved image URL. */
  url: string;
  /** Alt text, or null. */
  alt: string | null;
  /** Whether this image is the primary one. */
  isPrimary: boolean;
  /** Display order within the gallery. */
  displayOrder: number;
}

/** One purchasable product variant. */
export interface ProductVariantDto {
  /** Variant id (UUID v7). */
  id: string;
  /** Stock keeping unit, or null. */
  sku: string | null;
  /** Colour name, or null. */
  colorName: string | null;
  /** Colour swatch hex value, or null. */
  colorHex: string | null;
  /** Size label, or null. */
  sizeLabel: string | null;
  /** Yarn type, or null. */
  yarnType: string | null;
  /** Remaining stock quantity. */
  stockQuantity: number;
  /** Whether this variant can be purchased for its product type. */
  inStock: boolean;
  /** Additional price in BDT. */
  additionalPriceBdt: number;
  /** Additional price in USD. */
  additionalPriceUsd: number;
}

/** Full product detail payload. */
export interface ProductDetailDto extends ProductSummaryDto {
  /** Long description. */
  description: string;
  /** Gallery images, primary first. */
  images: ProductImageDto[];
  /** Variants ordered by id ascending. */
  variants: ProductVariantDto[];
  /** SEO title override, or null. */
  metaTitle: string | null;
  /** SEO description override, or null. */
  metaDescription: string | null;
  /** Category trail from root to the direct category. */
  categoryTrail: CategoryRefDto[];
  /** Up to four related visible products. */
  related: ProductSummaryDto[];
}

/** A category summary with its subtree product count and cover. */
export interface CategorySummaryDto {
  /** Category id (UUID v7). */
  id: string;
  /** Display name. */
  name: string;
  /** URL slug. */
  slug: string;
  /** Parent category id, or null for a top level category. */
  parentId: string | null;
  /** Description, or null. */
  description: string | null;
  /** Visible products in this category and its descendants. */
  productCount: number;
  /** Resolved cover image URL, or null. */
  coverImageUrl: string | null;
  /** Cover image alt text, or null. */
  coverImageAlt: string | null;
}

/** Category detail payload. */
export interface CategoryDetailDto extends CategorySummaryDto {
  /** Breadcrumb from root to the parent category. */
  breadcrumb: CategoryRefDto[];
  /** Direct children with their subtree counts. */
  children: CategorySummaryDto[];
}

/** Pagination metadata returned with catalog lists. */
export interface PaginationMetaDto {
  /** Current page, clamped to the last real page. */
  page: number;
  /** Page size. */
  pageSize: number;
  /** Total matching products. */
  total: number;
  /** Total pages. Zero when there are no matches. */
  totalPages: number;
}

/** Response body for `GET /api/products`. */
export interface CatalogProductListResponse {
  /** Product summaries for the current page. */
  data: ProductSummaryDto[];
  /** Pagination metadata. */
  meta: PaginationMetaDto;
}

/** Response body for `GET /api/products/:slug`. */
export interface CatalogProductDetailResponse {
  /** Product detail. */
  data: ProductDetailDto;
}

/** Response body for `GET /api/categories`. */
export interface CatalogCategoryListResponse {
  /** Every category with its subtree count. */
  data: CategorySummaryDto[];
}

/** Response body for `GET /api/categories/:slug`. */
export interface CatalogCategoryDetailResponse {
  /** Category detail. */
  data: CategoryDetailDto;
}
