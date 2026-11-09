import type { CatalogSort, ProductType } from "@crochet-peakz/shared";

/** Human readable labels for each product type. */
export const productTypeLabels: Record<ProductType, string> = {
  STANDARD: "Standard",
  ONE_OF_A_KIND: "One of a kind",
  PRE_ORDER: "Pre order",
  CUSTOM: "Custom",
  DIGITAL: "Digital",
};

/** Human readable labels for each catalog sort order. */
export const sortLabels: Record<CatalogSort, string> = {
  newest: "Newest",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
};

/** The sort orders offered in the shop, in display order. */
export const sortOptions: CatalogSort[] = ["newest", "price-asc", "price-desc"];
