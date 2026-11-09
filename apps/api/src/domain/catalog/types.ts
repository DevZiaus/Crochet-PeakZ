/**
 * Catalog read models and rules.
 *
 * These types mirror the persisted catalog rows without importing Prisma or
 * the shared package, so the domain layer keeps zero external dependencies.
 */

/** Product kinds the catalog understands. Mirrors the Prisma enum. */
export const CATALOG_PRODUCT_TYPES = [
  "STANDARD",
  "ONE_OF_A_KIND",
  "PRE_ORDER",
  "CUSTOM",
  "DIGITAL",
] as const;

/** Union of supported product kinds. */
export type CatalogProductType = (typeof CATALOG_PRODUCT_TYPES)[number];

/** Currencies the catalog can display. */
export type CatalogCurrency = "BDT" | "USD";

/** Sort orders the catalog list accepts. */
export type CatalogSort = "newest" | "price-asc" | "price-desc";

/** A category reference used in trails and product records. */
export interface CatalogCategoryRef {
  /** Category id. */
  id: string;
  /** Display name. */
  name: string;
  /** URL slug. */
  slug: string;
}

/** A full category row. */
export interface CatalogCategoryRecord extends CatalogCategoryRef {
  /** Parent category id, or null for a top level category. */
  parentId: string | null;
  /** Description, or null. */
  description: string | null;
}

/** A product image row. `imageUrl` is a Cloudinary public ID. */
export interface CatalogImageRecord {
  /** Image id. */
  id: string;
  /** Cloudinary public ID or an absolute URL. */
  imageUrl: string;
  /** Alt text, or null. */
  altText: string | null;
  /** Whether this image is marked primary. */
  isPrimary: boolean;
  /** Display order within the gallery. */
  displayOrder: number;
}

/** A product variant row. */
export interface CatalogVariantRecord {
  /** Variant id. */
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
  /** Additional price in BDT. */
  additionalPriceBdt: number;
  /** Additional price in USD. */
  additionalPriceUsd: number;
}

/** A product row with its images, variants, and direct category. */
export interface CatalogProductRecord {
  /** Product id. */
  id: string;
  /** Direct category id, or null. */
  categoryId: string | null;
  /** Display title. */
  title: string;
  /** URL slug. */
  slug: string;
  /** Long description. */
  description: string;
  /** Product kind. */
  productType: CatalogProductType;
  /** Base price in BDT. */
  priceBdt: number;
  /** Base price in USD. */
  priceUsd: number;
  /** Whether the product is active. */
  isActive: boolean;
  /** Whether the product is featured. */
  isFeatured: boolean;
  /** Lead time in days. */
  leadTimeDays: number;
  /** SEO title override, or null. */
  metaTitle: string | null;
  /** SEO description override, or null. */
  metaDescription: string | null;
  /** Free form tags. */
  tags: string[];
  /** Soft delete timestamp, or null. */
  deletedAt: Date | null;
  /** Creation timestamp. */
  createdAt: Date;
  /** Direct category, or null. */
  category: CatalogCategoryRef | null;
  /** Product images. */
  images: CatalogImageRecord[];
  /** Product variants. */
  variants: CatalogVariantRecord[];
}

/** Subtree count and cover for one category. */
export interface CatalogCategoryStats {
  /** Visible products in the category subtree. */
  productCount: number;
  /** Cover image public ID from the newest visible product, or null. */
  coverImageUrl: string | null;
  /** Cover image alt text, or null. */
  coverImageAlt: string | null;
}

/** A validated product list query. */
export interface CatalogProductQuery {
  /** Resolved category ids, including descendants. Undefined means no filter. */
  categoryIds?: string[];
  /** Product kinds. Undefined means no filter. */
  types?: CatalogProductType[];
  /** Minimum price in the selected currency. */
  minPrice?: number;
  /** Maximum price in the selected currency. */
  maxPrice?: number;
  /** Currency used for price filtering and sorting. */
  currency: CatalogCurrency;
  /** Sort order. */
  sort: CatalogSort;
  /** Requested page, before clamping. */
  page: number;
  /** Page size. */
  limit: number;
  /** When true, only featured products are returned. */
  featured?: boolean;
}

/** Pagination metadata for a catalog list. */
export interface CatalogPageMeta {
  /** Clamped page number. */
  page: number;
  /** Page size. */
  pageSize: number;
  /** Total matching products. */
  total: number;
  /** Total pages. Zero when there are no matches. */
  totalPages: number;
}

/** A page of catalog products. */
export interface CatalogProductPage {
  /** Products on the current page. */
  items: CatalogProductRecord[];
  /** Pagination metadata. */
  meta: CatalogPageMeta;
}
