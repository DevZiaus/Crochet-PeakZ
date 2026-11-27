import { z } from "zod";
import { CART_MAX_LINE_QUANTITY, CART_MAX_LINES } from "./constants.js";

/** Strict UUID validator matching RFC 4122 / 9562 (including UUID v4 and v7). */
export const cartUuidSchema = z.uuid();

/** One browser cart line submitted to quote or merge. */
export const cartLineInputSchema = z.object({
  productId: cartUuidSchema,
  variantId: cartUuidSchema,
  quantity: z.number().int().min(1).max(CART_MAX_LINE_QUANTITY),
  addedAt: z.iso.datetime({ offset: true }).optional(),
});

/** Array of 0..20 cart lines with unique `variantId` values. */
export const cartLinesInputSchema = z
  .array(cartLineInputSchema)
  .max(CART_MAX_LINES)
  .superRefine((lines, ctx) => {
    const seen = new Set<string>();
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line) {
        continue;
      }
      if (seen.has(line.variantId)) {
        ctx.addIssue({
          code: "custom",
          path: [index, "variantId"],
          message: "Duplicate variantId in cart lines.",
        });
      } else {
        seen.add(line.variantId);
      }
    }
  });

/** Request body for `POST /api/cart/quote`. */
export const cartQuoteBodySchema = z.object({
  lines: cartLinesInputSchema,
});

/** Request body for `POST /api/cart/items`. */
export const cartAddItemBodySchema = z.object({
  productId: cartUuidSchema,
  variantId: cartUuidSchema,
});

/** Request body for `PATCH /api/cart/items/:variantId`. */
export const cartUpdateItemBodySchema = z.object({
  quantity: z.number().int().min(1).max(CART_MAX_LINE_QUANTITY),
});

/** Route parameter schema for `:variantId`. */
export const cartVariantParamSchema = z.object({
  variantId: cartUuidSchema,
});

/** Request body for `POST /api/cart/merge`. */
export const cartMergeBodySchema = z.object({
  guestCartId: cartUuidSchema,
  lines: cartLinesInputSchema,
});

/** Validated single cart line input. */
export type CartLineInput = z.infer<typeof cartLineInputSchema>;

/** Validated body for `POST /api/cart/quote`. */
export type CartQuoteBody = z.infer<typeof cartQuoteBodySchema>;

/** Validated body for `POST /api/cart/items`. */
export type CartAddItemBody = z.infer<typeof cartAddItemBodySchema>;

/** Validated body for `PATCH /api/cart/items/:variantId`. */
export type CartUpdateItemBody = z.infer<typeof cartUpdateItemBodySchema>;

/** Validated route params for `:variantId`. */
export type CartVariantParam = z.infer<typeof cartVariantParamSchema>;

/** Validated body for `POST /api/cart/merge`. */
export type CartMergeBody = z.infer<typeof cartMergeBodySchema>;
