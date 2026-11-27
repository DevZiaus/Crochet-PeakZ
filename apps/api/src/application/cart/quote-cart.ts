import type { CartQuoteBody, CartQuoteResponse } from "@crochet-peakz/shared";
import { resolveLine } from "../../domain/cart/rules.js";
import type { CartQuoteDependencies } from "./dependencies.js";
import { toCartLineDto } from "./mappers.js";

/**
 * Validates and prices a visitor cart against live catalog data without
 * storing anything on the server.
 *
 * Lines are returned newest first when `addedAt` timestamps are supplied,
 * preserving caller order on timestamp ties.
 *
 * @param dependencies Cart quote dependencies.
 * @param input Validated quote body.
 * @returns Resolved lines in the standard quote envelope.
 */
export async function quoteCart(
  dependencies: CartQuoteDependencies,
  input: CartQuoteBody,
): Promise<CartQuoteResponse> {
  if (input.lines.length === 0) {
    return { data: { lines: [] } };
  }

  const now = dependencies.clock.now();
  const lookup = await dependencies.catalog.findCartSnapshots({
    productIds: input.lines.map((line) => line.productId),
    variantIds: input.lines.map((line) => line.variantId),
  });

  const indexed = input.lines.map((line, index) => ({
    index,
    input: {
      productId: line.productId,
      variantId: line.variantId,
      quantity: line.quantity,
      addedAt: line.addedAt ? new Date(line.addedAt) : now,
    },
  }));

  indexed.sort((left, right) => {
    const diff = right.input.addedAt.getTime() - left.input.addedAt.getTime();
    return diff !== 0 ? diff : left.index - right.index;
  });

  const resolvedLines = indexed.map((entry) =>
    toCartLineDto(resolveLine(entry.input, lookup), dependencies.imageUrls),
  );

  return { data: { lines: resolvedLines } };
}
