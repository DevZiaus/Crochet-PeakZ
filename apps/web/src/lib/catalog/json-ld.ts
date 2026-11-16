import {
  calculateVariantPrice,
  type CurrencyCode,
  type ProductDetailDto,
} from "@crochet-peakz/shared";

/**
 * Builds the Product JSON-LD object for a product detail page.
 *
 * Variants become an AggregateOffer whose price range covers every variant
 * total, meaning the base price plus that variant's additional price. A product
 * without variants uses a single Offer. Ratings are intentionally omitted.
 *
 * @param product Product detail DTO.
 * @param currency Active currency, used as the offer currency.
 * @param productUrl Absolute canonical product URL.
 * @param fallbackImage Absolute OpenGraph image used when the product has no images.
 * @returns A schema.org Product object ready to serialize.
 */
export function buildProductJsonLd(
  product: ProductDetailDto,
  currency: CurrencyCode,
  productUrl: string,
  fallbackImage: string,
): Record<string, unknown> {
  const basePrice = currency === "BDT" ? product.priceBdt : product.priceUsd;
  const additionalPrices = product.variants.map((variant) =>
    currency === "BDT"
      ? variant.additionalPriceBdt
      : variant.additionalPriceUsd,
  );
  const prices =
    additionalPrices.length > 0
      ? additionalPrices.map((extra) => calculateVariantPrice(basePrice, extra))
      : [basePrice];
  const lowPrice = Math.min(...prices);
  const highPrice = Math.max(...prices);
  const availability = getAvailability(product);

  const offers =
    product.variants.length > 0
      ? {
          "@type": "AggregateOffer",
          priceCurrency: currency,
          lowPrice,
          highPrice,
          offerCount: product.variants.length,
          availability,
          url: productUrl,
        }
      : {
          "@type": "Offer",
          priceCurrency: currency,
          price: basePrice,
          availability,
          url: productUrl,
        };

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image:
      product.images.length > 0
        ? product.images.map((image) => image.url)
        : [fallbackImage],
    brand: { "@type": "Brand", name: "Crochet PeakZ" },
    url: productUrl,
    offers,
  };
}

/**
 * Serializes JSON-LD for safe embedding in a script element.
 *
 * `<` is escaped so product text can never close the script element.
 *
 * @param value JSON-LD object.
 * @returns The serialized, escaped JSON string.
 */
export function serializeJsonLd(value: Record<string, unknown>): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function getAvailability(product: ProductDetailDto): string {
  if (product.productType === "PRE_ORDER") {
    return "https://schema.org/PreOrder";
  }
  return product.inStock
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock";
}
