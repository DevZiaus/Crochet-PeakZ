import type { CartAdjustmentDto, CartLineDto } from "@crochet-peakz/shared";
import type {
  CartAdjustment,
  ResolvedCartLine,
} from "../../domain/cart/types.js";
import type { ImageUrlResolver } from "../../domain/ports/image-url-resolver.js";

/**
 * Maps a resolved cart line domain object to its API DTO.
 *
 * Image URL delivery resolution stays in the application layer so the domain
 * layer never knows about Cloudinary delivery URLs.
 *
 * @param line Resolved domain line.
 * @param imageUrls Image delivery URL resolver.
 * @returns Serialized cart line DTO.
 */
export function toCartLineDto(
  line: ResolvedCartLine,
  imageUrls: ImageUrlResolver,
): CartLineDto {
  return {
    productId: line.productId,
    variantId: line.variantId,
    slug: line.slug,
    title: line.title,
    imageUrl: imageUrls.resolve(line.primaryImagePublicId),
    imageAlt: line.primaryImageAlt,
    variantLabel: line.variantLabel,
    productType: line.productType,
    unitPriceBdt: line.unitPriceBdt,
    unitPriceUsd: line.unitPriceUsd,
    quantity: line.quantity,
    maxQuantity: line.maxQuantity,
    status: line.status,
    addedAt: line.addedAt.toISOString(),
  };
}

/**
 * Maps a domain cart adjustment to its DTO.
 *
 * @param adjustment Domain adjustment record.
 * @returns Serialized adjustment DTO.
 */
export function toCartAdjustmentDto(
  adjustment: CartAdjustment,
): CartAdjustmentDto {
  return {
    variantId: adjustment.variantId,
    title: adjustment.title,
    kind: adjustment.kind,
    quantity: adjustment.quantity,
  };
}
