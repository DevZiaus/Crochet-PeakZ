import type {
  CartAddItemBody,
  CartAddItemResponse,
  CartAdjustmentDto,
  CartLineDto,
  CartResponse,
  CartUpdateItemBody,
} from "@crochet-peakz/shared";
import {
  applyAdd,
  applySetQuantity,
  isCartExpired,
  resolveLine,
  sortLinesNewestFirst,
} from "../../domain/cart/rules.js";
import type {
  CartCatalogLookup,
  CartLineInput,
} from "../../domain/cart/types.js";
import type { CartTransaction } from "../../domain/ports/cart-repository.js";
import type { ImageUrlResolver } from "../../domain/ports/image-url-resolver.js";
import type { AccountCartDependencies } from "./dependencies.js";
import { CartError } from "./errors.js";
import { toCartAdjustmentDto, toCartLineDto } from "./mappers.js";

/** Maps persisted items on the locked cart into domain line inputs. */
function toLineInputs(tx: CartTransaction): CartLineInput[] {
  return tx.cart.items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    quantity: item.quantity,
    addedAt: item.createdAt,
  }));
}

/**
 * Applies lazy 30 day idle expiry inside the locked transaction.
 * Returns the surviving lines (or an empty array when expired).
 */
async function loadActiveLines(
  tx: CartTransaction,
  now: Date,
): Promise<CartLineInput[]> {
  if (tx.cart.items.length === 0) {
    return [];
  }
  if (isCartExpired(tx.cart.updatedAt, now)) {
    await tx.deleteAllItems({ touchUpdatedAt: false, now });
    return [];
  }
  return toLineInputs(tx);
}

/**
 * Resolves a set of lines against catalog snapshots and silently persists any
 * passive lowering on lines where stock dropped below saved quantity.
 */
async function resolveAndLower(
  tx: CartTransaction,
  lines: readonly CartLineInput[],
  lookup: CartCatalogLookup,
  imageUrls: ImageUrlResolver,
  excludeLowerPersistVariantId?: string,
): Promise<{
  lineDtos: CartLineDto[];
  loweredAdjustments: CartAdjustmentDto[];
}> {
  if (lines.length === 0) {
    return { lineDtos: [], loweredAdjustments: [] };
  }

  const ordered = sortLinesNewestFirst(lines);
  const resolved = ordered.map((line) => resolveLine(line, lookup));
  const loweredToPersist: Array<{ variantId: string; quantity: number }> = [];
  const loweredAdjustments: CartAdjustmentDto[] = [];

  for (const item of resolved) {
    if (item.status === "LOWERED") {
      if (item.variantId !== excludeLowerPersistVariantId) {
        loweredToPersist.push({
          variantId: item.variantId,
          quantity: item.quantity,
        });
      }
      loweredAdjustments.push({
        variantId: item.variantId,
        title: item.title,
        kind: "LOWERED",
        quantity: item.quantity,
      });
    }
  }

  if (loweredToPersist.length > 0) {
    await tx.lowerItemQuantitiesSilently(loweredToPersist);
  }

  return {
    lineDtos: resolved.map((item) => toCartLineDto(item, imageUrls)),
    loweredAdjustments,
  };
}

/**
 * Reads the signed in user's cart with lazy 30 day expiry and live stock
 * validation. Passively lowered quantities are persisted without bumping
 * `Cart.updatedAt` (AC-7, AC-10).
 *
 * @param dependencies Account cart dependencies.
 * @param userId Session user UUID.
 * @returns Live resolved cart DTO.
 */
export async function getCart(
  dependencies: AccountCartDependencies,
  userId: string,
): Promise<CartResponse> {
  const now = dependencies.clock.now();

  return dependencies.carts.withLockedCart(userId, now, async (tx) => {
    const activeLines = await loadActiveLines(tx, now);
    if (activeLines.length === 0) {
      return { data: { lines: [], adjustments: [] } };
    }

    const lookup = await tx.findCatalogSnapshots({
      productIds: activeLines.map((line) => line.productId),
      variantIds: activeLines.map((line) => line.variantId),
    });

    const { lineDtos, loweredAdjustments } = await resolveAndLower(
      tx,
      activeLines,
      lookup,
      dependencies.imageUrls,
    );

    return {
      data: {
        lines: lineDtos,
        adjustments: loweredAdjustments,
      },
    };
  });
}

/**
 * Adds one unit of a variant to the signed in user's cart inside a locked
 * transaction (AC-1, AC-5, AC-6, AC-10).
 *
 * @param dependencies Account cart dependencies.
 * @param userId Session user UUID.
 * @param input Validated productId and variantId.
 * @returns Fresh cart DTO and the `AddOutcome`.
 */
export async function addItem(
  dependencies: AccountCartDependencies,
  userId: string,
  input: CartAddItemBody,
): Promise<CartAddItemResponse> {
  const now = dependencies.clock.now();

  return dependencies.carts.withLockedCart(userId, now, async (tx) => {
    const activeLines = await loadActiveLines(tx, now);
    const lookup = await tx.findCatalogSnapshots({
      productIds: [
        ...activeLines.map((line) => line.productId),
        input.productId,
      ],
      variantIds: [
        ...activeLines.map((line) => line.variantId),
        input.variantId,
      ],
    });

    const result = applyAdd(activeLines, input, lookup, now);

    if (result.changed && result.mutatedLine) {
      await tx.upsertItem({
        productId: result.mutatedLine.productId,
        variantId: result.mutatedLine.variantId,
        quantity: result.mutatedLine.quantity,
        createdAt: result.mutatedLine.addedAt,
        now,
      });
    }

    const { lineDtos, loweredAdjustments } = await resolveAndLower(
      tx,
      result.nextLines,
      lookup,
      dependencies.imageUrls,
      result.mutatedLine?.variantId,
    );

    return {
      data: {
        lines: lineDtos,
        adjustments: loweredAdjustments,
      },
      outcome: result.outcome,
    };
  });
}

/**
 * Sets the quantity of an existing line in the signed in user's cart.
 *
 * - Missing line -> throws 404 `NOT_IN_CART`.
 * - Unavailable or zero stock (`maxQuantity === 0`) -> leaves row unchanged
 *   and throws 409 `ITEM_UNAVAILABLE` carrying a fresh `CartDto`.
 * - Requested quantity above `maxQuantity` -> clamps to `maxQuantity`,
 *   persists, and returns 200 with `LOWERED` in `adjustments` and line status.
 *
 * @param dependencies Account cart dependencies.
 * @param userId Session user UUID.
 * @param variantId Target variant UUID.
 * @param input Validated quantity body.
 * @returns Updated cart DTO.
 */
export async function setItemQuantity(
  dependencies: AccountCartDependencies,
  userId: string,
  variantId: string,
  input: CartUpdateItemBody,
): Promise<CartResponse> {
  const now = dependencies.clock.now();

  return dependencies.carts.withLockedCart(userId, now, async (tx) => {
    const activeLines = await loadActiveLines(tx, now);
    const lookup = await tx.findCatalogSnapshots({
      productIds: activeLines.map((line) => line.productId),
      variantIds: activeLines.map((line) => line.variantId),
    });

    const result = applySetQuantity(
      activeLines,
      variantId,
      input.quantity,
      lookup,
    );

    if (result.kind === "NOT_FOUND") {
      throw new CartError("NOT_IN_CART", "This item is not in your cart.");
    }

    if (result.kind === "UNAVAILABLE") {
      const { lineDtos } = await resolveAndLower(
        tx,
        activeLines,
        lookup,
        dependencies.imageUrls,
      );
      throw new CartError(
        "ITEM_UNAVAILABLE",
        "This item is no longer available.",
        { cartData: { lines: lineDtos, adjustments: [] } },
      );
    }

    await tx.updateItemQuantity({
      variantId,
      quantity: result.nextQuantity,
      now,
    });

    const updatedLines = activeLines.map((line) =>
      line.variantId === variantId
        ? { ...line, quantity: result.nextQuantity }
        : line,
    );

    const { lineDtos, loweredAdjustments } = await resolveAndLower(
      tx,
      updatedLines,
      lookup,
      dependencies.imageUrls,
      variantId,
    );

    const adjustments: CartAdjustmentDto[] = [...loweredAdjustments];
    const finalLines = lineDtos.map((line) => {
      if (line.variantId === variantId && result.kind === "LOWERED") {
        adjustments.unshift(toCartAdjustmentDto(result.adjustment));
        return { ...line, status: "LOWERED" as const };
      }
      return line;
    });

    return {
      data: {
        lines: finalLines,
        adjustments,
      },
    };
  });
}

/**
 * Removes one variant from the signed in user's cart (idempotent 200 even if
 * the variant is already absent).
 *
 * @param dependencies Account cart dependencies.
 * @param userId Session user UUID.
 * @param variantId Target variant UUID.
 * @returns Updated cart DTO.
 */
export async function removeItem(
  dependencies: AccountCartDependencies,
  userId: string,
  variantId: string,
): Promise<CartResponse> {
  const now = dependencies.clock.now();

  return dependencies.carts.withLockedCart(userId, now, async (tx) => {
    const activeLines = await loadActiveLines(tx, now);
    await tx.deleteItem({ variantId, now });

    const remaining = activeLines.filter(
      (line) => line.variantId !== variantId,
    );
    if (remaining.length === 0) {
      return { data: { lines: [], adjustments: [] } };
    }

    const lookup = await tx.findCatalogSnapshots({
      productIds: remaining.map((line) => line.productId),
      variantIds: remaining.map((line) => line.variantId),
    });

    const { lineDtos, loweredAdjustments } = await resolveAndLower(
      tx,
      remaining,
      lookup,
      dependencies.imageUrls,
    );

    return {
      data: {
        lines: lineDtos,
        adjustments: loweredAdjustments,
      },
    };
  });
}

/**
 * Empties every item from the signed in user's cart (AC-15).
 *
 * @param dependencies Account cart dependencies.
 * @param userId Session user UUID.
 * @returns Empty cart DTO.
 */
export async function clearCart(
  dependencies: AccountCartDependencies,
  userId: string,
): Promise<CartResponse> {
  const now = dependencies.clock.now();

  return dependencies.carts.withLockedCart(userId, now, async (tx) => {
    await tx.deleteAllItems({ touchUpdatedAt: true, now });
    return { data: { lines: [], adjustments: [] } };
  });
}
