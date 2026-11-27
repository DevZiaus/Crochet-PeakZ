import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type {
  CartCatalogLookup,
  CartLineInput,
  CartProductSnapshot,
  CartVariantSnapshot,
} from "../../domain/cart/types.js";
import type {
  CartRepository,
  CartTransaction,
  LockedCartRecord,
} from "../../domain/ports/cart-repository.js";
import { CartError } from "../../application/cart/errors.js";

/** Raw row returned by `SELECT ... FROM carts WHERE user_id = $1 FOR UPDATE`. */
interface LockedCartRow {
  id: string;
  userId: string;
  lastMergedGuestCartId: string | null;
  updatedAt: Date;
}

/**
 * Checks whether a Prisma / pg error represents a PostgreSQL foreign key
 * violation (`23503` / `P2003`) — e.g. when a deleted user's unexpired JWT
 * attempts to create a cart.
 */
function isForeignKeyViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const record = error as {
    code?: unknown;
    meta?: { code?: unknown };
    cause?: { code?: unknown };
  };
  return (
    record.code === "P2003" ||
    record.code === "23503" ||
    record.meta?.code === "23503" ||
    record.cause?.code === "23503"
  );
}

/**
 * Loads live product and variant snapshots inside the active Prisma
 * transaction (without applying visibility filtering so domain rules can flag
 * inactive or soft deleted products with their titles).
 */
async function loadSnapshotsInTx(
  tx: Prisma.TransactionClient,
  input: {
    productIds: readonly string[];
    variantIds: readonly string[];
  },
): Promise<CartCatalogLookup> {
  const uniqueProductIds = [...new Set(input.productIds)];
  const uniqueVariantIds = [...new Set(input.variantIds)];

  const [products, variants] = await Promise.all([
    uniqueProductIds.length === 0
      ? Promise.resolve([])
      : tx.product.findMany({
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
      : tx.productVariant.findMany({
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

/**
 * Prisma + PostgreSQL implementation of {@link CartRepository}.
 *
 * Uses `INSERT INTO carts ... ON CONFLICT (user_id) DO NOTHING` followed by
 * `SELECT ... FOR UPDATE` inside a transaction so parallel first time writes
 * never throw `P2002` and concurrent writes for the same account serialize
 * cleanly against live stock and cart limits.
 */
export class PrismaCartRepository implements CartRepository {
  /**
   * @param prisma Prisma client owned by the composition root.
   */
  constructor(private readonly prisma: PrismaClient) {}

  /** @inheritdoc */
  async withLockedCart<T>(
    userId: string,
    now: Date,
    work: (tx: CartTransaction) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO "carts" ("id", "user_id", "created_at", "updated_at")
          VALUES (${randomUUID()}, ${userId}, ${now}, ${now})
          ON CONFLICT ("user_id") DO NOTHING
        `;

        const lockedRows = await tx.$queryRaw<LockedCartRow[]>`
          SELECT
            "id",
            "user_id" AS "userId",
            "last_merged_guest_cart_id" AS "lastMergedGuestCartId",
            "updated_at" AS "updatedAt"
          FROM "carts"
          WHERE "user_id" = ${userId}
          FOR UPDATE
        `;

        const locked = lockedRows[0];
        if (!locked) {
          throw new CartError(
            "SESSION_INVALID",
            "Your session is no longer valid.",
          );
        }

        const itemRows = await tx.cartItem.findMany({
          where: { cartId: locked.id },
          orderBy: [{ createdAt: "desc" }, { variantId: "asc" }],
          select: {
            id: true,
            productId: true,
            variantId: true,
            quantity: true,
            createdAt: true,
          },
        });

        const cart: LockedCartRecord = {
          id: locked.id,
          userId: locked.userId,
          lastMergedGuestCartId: locked.lastMergedGuestCartId,
          updatedAt: locked.updatedAt,
          items: itemRows,
        };

        const context: CartTransaction = {
          cart,

          findCatalogSnapshots(input) {
            return loadSnapshotsInTx(tx, input);
          },

          async deleteAllItems({ touchUpdatedAt, now: writeTime }) {
            await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
            if (touchUpdatedAt) {
              await tx.$executeRaw`
                UPDATE "carts"
                SET "updated_at" = ${writeTime}
                WHERE "id" = ${cart.id}
              `;
            }
          },

          async lowerItemQuantitiesSilently(updates) {
            for (const update of updates) {
              // Deliberately updates only `cart_items`, leaving `carts.updated_at`
              // untouched so passive reads never extend the 30 day expiry window.
              await tx.cartItem.updateMany({
                where: { cartId: cart.id, variantId: update.variantId },
                data: { quantity: update.quantity },
              });
            }
          },

          async upsertItem(input) {
            await tx.cartItem.upsert({
              where: {
                cartId_variantId: {
                  cartId: cart.id,
                  variantId: input.variantId,
                },
              },
              create: {
                cartId: cart.id,
                productId: input.productId,
                variantId: input.variantId,
                quantity: input.quantity,
                createdAt: input.createdAt,
              },
              update: {
                quantity: input.quantity,
              },
            });
            await tx.$executeRaw`
              UPDATE "carts"
              SET "updated_at" = ${input.now}
              WHERE "id" = ${cart.id}
            `;
          },

          async updateItemQuantity(input) {
            await tx.cartItem.update({
              where: {
                cartId_variantId: {
                  cartId: cart.id,
                  variantId: input.variantId,
                },
              },
              data: { quantity: input.quantity },
            });
            await tx.$executeRaw`
              UPDATE "carts"
              SET "updated_at" = ${input.now}
              WHERE "id" = ${cart.id}
            `;
          },

          async deleteItem(input) {
            const result = await tx.cartItem.deleteMany({
              where: { cartId: cart.id, variantId: input.variantId },
            });
            if (result.count > 0) {
              await tx.$executeRaw`
                UPDATE "carts"
                SET "updated_at" = ${input.now}
                WHERE "id" = ${cart.id}
              `;
              return true;
            }
            return false;
          },

          async applyMerge(input: {
            guestCartId: string;
            lines: readonly CartLineInput[];
            now: Date;
          }) {
            const keepVariantIds = new Set(
              input.lines.map((line) => line.variantId),
            );
            const toDelete = cart.items
              .filter((item) => !keepVariantIds.has(item.variantId))
              .map((item) => item.variantId);

            if (toDelete.length > 0) {
              await tx.cartItem.deleteMany({
                where: {
                  cartId: cart.id,
                  variantId: { in: toDelete },
                },
              });
            }

            for (const line of input.lines) {
              await tx.cartItem.upsert({
                where: {
                  cartId_variantId: {
                    cartId: cart.id,
                    variantId: line.variantId,
                  },
                },
                create: {
                  cartId: cart.id,
                  productId: line.productId,
                  variantId: line.variantId,
                  quantity: line.quantity,
                  createdAt: line.addedAt,
                },
                update: {
                  quantity: line.quantity,
                },
              });
            }

            await tx.$executeRaw`
              UPDATE "carts"
              SET "last_merged_guest_cart_id" = ${input.guestCartId},
                  "updated_at" = ${input.now}
              WHERE "id" = ${cart.id}
            `;
          },
        };

        return work(context);
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new CartError(
          "SESSION_INVALID",
          "Your session is no longer valid.",
        );
      }
      throw error;
    }
  }
}
