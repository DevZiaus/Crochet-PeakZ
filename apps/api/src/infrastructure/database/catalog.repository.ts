import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { clampPage } from "../../domain/catalog/rules.js";
import type {
  CartCatalogLookup,
  CartProductSnapshot,
  CartVariantSnapshot,
} from "../../domain/cart/types.js";
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
  async getCategoryStatsForSubtrees(
    categorySubtrees: string[][],
  ): Promise<CatalogCategoryStats[]> {
    if (categorySubtrees.length === 0) {
      return [];
    }

    const subtreeInput = categorySubtrees.map((categoryIds, subtreeIndex) => ({
      subtreeIndex,
      categoryIds,
    }));
    const rows = await this.prisma.$queryRaw<
      Array<{
        subtreeIndex: number;
        productCount: bigint;
        coverImageUrl: string | null;
        coverImageAlt: string | null;
      }>
    >`WITH subtree_input AS (
      SELECT
        (entry->>'subtreeIndex')::int AS "subtreeIndex",
        entry->'categoryIds' AS "categoryIds"
      FROM jsonb_array_elements(${JSON.stringify(subtreeInput)}::jsonb) AS input(entry)
    ), ranked_products AS (
      SELECT
        subtree."subtreeIndex",
        product.id,
        image.image_url AS "coverImageUrl",
        image.alt_text AS "coverImageAlt",
        row_number() OVER (
          PARTITION BY subtree."subtreeIndex"
          ORDER BY product.created_at DESC, product.id ASC
        ) AS rank
      FROM subtree_input AS subtree
      INNER JOIN products AS product
        ON product.category_id IN (
          SELECT jsonb_array_elements_text(subtree."categoryIds")
        )
        AND product.is_active = true
        AND product.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT image_url, alt_text
        FROM product_images
        WHERE product_id = product.id
        ORDER BY is_primary DESC, display_order ASC, id ASC
        LIMIT 1
      ) AS image ON true
    ), subtree_stats AS (
      SELECT
        "subtreeIndex",
        count(*) AS "productCount",
        max("coverImageUrl") FILTER (WHERE rank = 1) AS "coverImageUrl",
        max("coverImageAlt") FILTER (WHERE rank = 1) AS "coverImageAlt"
      FROM ranked_products
      GROUP BY "subtreeIndex"
    )
    SELECT
      subtree."subtreeIndex",
      coalesce(stats."productCount", 0)::bigint AS "productCount",
      stats."coverImageUrl",
      stats."coverImageAlt"
    FROM subtree_input AS subtree
    LEFT JOIN subtree_stats AS stats USING ("subtreeIndex")
    ORDER BY subtree."subtreeIndex"`;

    return rows.map((row) => ({
      productCount: Number(row.productCount),
      coverImageUrl: row.coverImageUrl,
      coverImageAlt: row.coverImageAlt,
    }));
  }

  /** @inheritdoc */
  async findCartSnapshots(input: {
    productIds: readonly string[];
    variantIds: readonly string[];
  }): Promise<CartCatalogLookup> {
    const uniqueProductIds = [...new Set(input.productIds)];
    const uniqueVariantIds = [...new Set(input.variantIds)];

    const [products, variants] = await Promise.all([
      uniqueProductIds.length === 0
        ? Promise.resolve([])
        : this.prisma.product.findMany({
            where: { id: { in: uniqueProductIds } },
            select: {
              id: true,
              slug: true,
              title: true,
              productType: true,
              priceBdt: true,
              priceUsd: true,
              isActive: true,
              deletedAt: true,
              images: {
                orderBy: [
                  { isPrimary: "desc" },
                  { displayOrder: "asc" },
                  { id: "asc" },
                ],
                select: {
                  id: true,
                  imageUrl: true,
                  altText: true,
                  isPrimary: true,
                  displayOrder: true,
                },
              },
            },
          }),
      uniqueVariantIds.length === 0
        ? Promise.resolve([])
        : this.prisma.productVariant.findMany({
            where: { id: { in: uniqueVariantIds } },
            select: {
              id: true,
              productId: true,
              colorName: true,
              sizeLabel: true,
              yarnType: true,
              stockQuantity: true,
              additionalPriceBdt: true,
              additionalPriceUsd: true,
            },
          }),
    ]);

    const productsById = new Map<string, CartProductSnapshot>();
    for (const row of products) {
      productsById.set(row.id, {
        id: row.id,
        slug: row.slug,
        title: row.title,
        productType: row.productType,
        priceBdt: row.priceBdt.toNumber(),
        priceUsd: row.priceUsd.toNumber(),
        isActive: row.isActive,
        deletedAt: row.deletedAt,
        images: row.images.map((image) => ({
          id: image.id,
          imageUrl: image.imageUrl,
          altText: image.altText,
          isPrimary: image.isPrimary,
          displayOrder: image.displayOrder,
        })),
      });
    }

    const variantsById = new Map<string, CartVariantSnapshot>();
    for (const row of variants) {
      variantsById.set(row.id, {
        id: row.id,
        productId: row.productId,
        colorName: row.colorName,
        sizeLabel: row.sizeLabel,
        yarnType: row.yarnType,
        stockQuantity: row.stockQuantity,
        additionalPriceBdt: row.additionalPriceBdt.toNumber(),
        additionalPriceUsd: row.additionalPriceUsd.toNumber(),
      });
    }

    return { productsById, variantsById };
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
