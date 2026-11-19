import { describe, expect, it } from "vitest";
import { buildProductJsonLd, serializeJsonLd } from "./json-ld";
import {
  makeProductDetail,
  makeVariant,
} from "../../test-support/catalog-fixtures";

const productUrl = "https://crochet-peakz.test/shop/bear";
const fallbackImage = "https://crochet-peakz.test/images/og-default.webp";

describe("product JSON-LD", () => {
  it("builds an aggregate offer from the base and variant prices", () => {
    const product = makeProductDetail({
      variants: [
        makeVariant({ id: "a", additionalPriceBdt: 0 }),
        makeVariant({ id: "b", additionalPriceBdt: 100 }),
      ],
    });

    const jsonLd = buildProductJsonLd(
      product,
      "BDT",
      productUrl,
      fallbackImage,
    );

    expect(jsonLd.offers).toEqual({
      "@type": "AggregateOffer",
      priceCurrency: "BDT",
      lowPrice: 1800,
      highPrice: 1900,
      offerCount: 2,
      availability: "https://schema.org/InStock",
      url: productUrl,
    });
  });

  it("computes the aggregate range from variant totals when every variant adds cost", () => {
    const product = makeProductDetail({
      variants: [
        makeVariant({ id: "a", additionalPriceBdt: 100 }),
        makeVariant({ id: "b", additionalPriceBdt: 200 }),
      ],
    });

    const jsonLd = buildProductJsonLd(
      product,
      "BDT",
      productUrl,
      fallbackImage,
    );

    expect(jsonLd.offers).toMatchObject({ lowPrice: 1900, highPrice: 2000 });
  });

  it("rounds variant offer prices the same way as displayed prices", () => {
    const product = makeProductDetail({
      priceBdt: 0.1,
      variants: [
        makeVariant({ id: "a", additionalPriceBdt: 0.2 }),
        makeVariant({ id: "b", additionalPriceBdt: 0.25 }),
      ],
    });

    const jsonLd = buildProductJsonLd(
      product,
      "BDT",
      productUrl,
      fallbackImage,
    );

    expect(jsonLd.offers).toMatchObject({ lowPrice: 0.3, highPrice: 0.35 });
  });

  it("uses a single offer and the fallback image without variants or images", () => {
    const product = makeProductDetail({ variants: [], images: [] });

    const jsonLd = buildProductJsonLd(
      product,
      "USD",
      productUrl,
      fallbackImage,
    );

    expect(jsonLd.image).toEqual([fallbackImage]);
    expect(jsonLd.offers).toMatchObject({
      "@type": "Offer",
      priceCurrency: "USD",
      price: 22,
      availability: "https://schema.org/InStock",
    });
  });

  it("escapes script closing characters when serializing", () => {
    const serialized = serializeJsonLd({
      name: "</script><script>alert(1)</script>",
    });

    expect(serialized).not.toContain("</script>");
    expect(serialized).toContain("\\u003c");
  });
});
