import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { clampPage, pickPrimaryImage } from "../../domain/catalog/rules.js";
import type {
  CatalogCategoryRecord,
  CatalogCategoryStats,
  CatalogProductPage,
  CatalogProductQuery,
  CatalogProductRecord,
} from "../../domain/catalog/types.js";
import type { CatalogRepository } from "../../domain/ports/catalog-repository.js";

/** Relations every catalog product read needs. */
const productInclude = {
  category: { select: { id: true, name: true, slug: true } },
  images: {
    orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }, { id: "asc" }],
  },
  variants: { orderBy: { id: "asc" } },
} satisfies Prisma.ProductInclude;

/** A product row with its catalog relations. */
type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

/**
 * Prisma backed catalog repository.
 *
 * Every read applies the visibility rule. Rows are mapped into domain records
 * so the application layer never sees Prisma types.
 */
export class PrismaCatalogRepository implements CatalogRepository {
  /**
   * @param prisma Prisma client owned by the composition root.
   */
  constructor(private readonly prisma: PrismaClient) {}

  /** @inheritdoc */
  async listProducts(query: CatalogProductQuery): Promise<CatalogProductPage> {
    const where = buildProductWhere(query);
    const total = await this.prisma.product.count({ where });
    const { page, totalPages } = clampPage(query.page, total, query.limit);

    const rows =
      total === 0
        ? []
        : await this.prisma.product.findMany({
            where,
            include: productInclude,
            orderBy: buildProductOrder(query),
            skip: (page - 1) * query.limit,
            take: query.limit,
          });

    return {
      items: rows.map(toDomainProduct),
      meta: { page, pageSize: query.limit, total, totalPages },
    };
  }

  /** @inheritdoc */
  async findProductBySlug(slug: string): Promise<CatalogProductRecord | null> {
    const row = await this.prisma.product.findFirst({
      where: { slug, isActive: true, deletedAt: null },
      include: productInclude,
    });

    return row ? toDomainProduct(row) : null;
  }

  /** @inheritdoc */
  async listRelatedProducts(input: {
    categoryId: string;
    excludeProductId: string;
    limit: number;
  }): Promise<CatalogProductRecord[]> {
    const rows = await this.prisma.product.findMany({
      where: {
        categoryId: input.categoryId,
        id: { not: input.excludeProductId },
        isActive: true,
        deletedAt: null,
      },
      include: productInclude,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: input.limit,
    });

    return rows.map(toDomainProduct);
  }

  /** @inheritdoc */
  async listCategories(): Promise<CatalogCategoryRecord[]> {
    const rows = await this.prisma.category.findMany({
      orderBy: { name: "asc" },
    });

    return rows.map((row) => ({
      id: row.id,
      parentId: row.parentId,
      name: row.name,
      slug: row.slug,
      description: row.description,
    }));
  }

  /** @inheritdoc */
  async getCategoryStats(categoryIds: string[]): Promise<CatalogCategoryStats> {
    if (categoryIds.length === 0) {
      return { productCount: 0, coverImageUrl: null, coverImageAlt: null };
    }

    const where: Prisma.ProductWhereInput = {
      categoryId: { in: categoryIds },
      isActive: true,
      deletedAt: null,
    };

    const [productCount, newest] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findFirst({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        include: { images: true },
      }),
    ]);

    const primary = newest
      ? pickPrimaryImage(
          newest.images.map((image) => ({
            id: image.id,
            imageUrl: image.imageUrl,
            altText: image.altText,
            isPrimary: image.isPrimary,
            displayOrder: image.displayOrder,
          })),
        )
      : null;

    return {
      productCount,
      coverImageUrl: primary?.imageUrl ?? null,
      coverImageAlt: primary?.altText ?? null,
    };
  }
}

/**
 * Builds the Prisma where clause for a catalog list.
 *
 * @param query Validated query.
 * @returns The visibility, filter, and price clause.
 */
function buildProductWhere(
  query: CatalogProductQuery,
): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {
    isActive: true,
    deletedAt: null,
  };

  if (query.categoryIds !== undefined) {
    where.categoryId = { in: query.categoryIds };
  }
  if (query.types !== undefined) {
    where.productType = { in: query.types };
  }
  if (query.featured !== undefined) {
    where.isFeatured = query.featured;
  }

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    const range: Prisma.DecimalFilter = {};
    if (query.minPrice !== undefined) {
      range.gte = query.minPrice;
    }
    if (query.maxPrice !== undefined) {
      range.lte = query.maxPrice;
    }
    if (query.currency === "BDT") {
      where.priceBdt = range;
    } else {
      where.priceUsd = range;
    }
  }

  return where;
}

/**
 * Builds the Prisma order clause for a catalog list.
 *
 * Price sorts use the selected currency column. Ties break by creation time
 * descending, then id ascending.
 *
 * @param query Validated query.
 * @returns The order clause.
 */
function buildProductOrder(
  query: CatalogProductQuery,
): Prisma.ProductOrderByWithRelationInput[] {
  if (query.sort === "newest") {
    return [{ createdAt: "desc" }, { id: "asc" }];
  }

  const priceColumn = query.currency === "BDT" ? "priceBdt" : "priceUsd";
  const direction = query.sort === "price-asc" ? "asc" : "desc";
  return [{ [priceColumn]: direction }, { createdAt: "desc" }, { id: "asc" }];
}

/**
 * Maps a Prisma product row into a domain record.
 *
 * @param row Product row with relations.
 * @returns Domain product record.
 */
function toDomainProduct(row: ProductWithRelations): CatalogProductRecord {
  return {
    id: row.id,
    categoryId: row.categoryId,
    title: row.title,
    slug: row.slug,
    description: row.description,
    productType: row.productType,
    priceBdt: row.priceBdt.toNumber(),
    priceUsd: row.priceUsd.toNumber(),
    isActive: row.isActive,
    isFeatured: row.isFeatured,
    leadTimeDays: row.leadTimeDays,
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    tags: row.tags,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    category: row.category
      ? {
          id: row.category.id,
          name: row.category.name,
          slug: row.category.slug,
        }
      : null,
    images: row.images.map((image) => ({
      id: image.id,
      imageUrl: image.imageUrl,
      altText: image.altText,
      isPrimary: image.isPrimary,
      displayOrder: image.displayOrder,
    })),
    variants: row.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      colorName: variant.colorName,
      colorHex: variant.colorHex,
      sizeLabel: variant.sizeLabel,
      yarnType: variant.yarnType,
      stockQuantity: variant.stockQuantity,
      additionalPriceBdt: variant.additionalPriceBdt.toNumber(),
      additionalPriceUsd: variant.additionalPriceUsd.toNumber(),
    })),
  };
}
