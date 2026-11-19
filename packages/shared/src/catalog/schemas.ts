import { z } from "zod";
import { Currency, ProductType } from "../types/index.js";
import type { CatalogSort } from "./types.js";

/**
 * Accepted catalog sort orders.
 *
 * The default, `newest`, matches the API and the shop page.
 */
export const catalogSortSchema = z.enum(["newest", "price-asc", "price-desc"]);

/** A list of repeated string query values, deduplicated. */
const repeatedStringsSchema = z.preprocess(
  (value: unknown) => {
    if (value === undefined) {
      return undefined;
    }
    return Array.isArray(value) ? (value as unknown[]) : [value];
  },
  z
    .array(z.string().trim().min(1, "Value must not be empty."))
    .transform((values) => [...new Set(values)])
    .optional(),
);

/** A repeated product type query value. */
const repeatedProductTypesSchema = z.preprocess(
  (value: unknown) => {
    if (value === undefined) {
      return undefined;
    }
    return Array.isArray(value) ? (value as unknown[]) : [value];
  },
  z
    .array(
      z.enum([
        ProductType.STANDARD,
        ProductType.ONE_OF_A_KIND,
        ProductType.PRE_ORDER,
        ProductType.CUSTOM,
        ProductType.DIGITAL,
      ]),
      "Product type must be one of the five supported values.",
    )
    .transform((values) => [...new Set(values)])
    .optional(),
);

/** A nonnegative price with at most two decimal places. */
const priceSchema = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/,
    "Price must be a nonnegative number with at most two decimal places.",
  )
  .transform((value) => Number(value));

/** A positive integer query value. */
const positiveIntegerSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "Expected a positive integer.")
  .transform((value) => Number(value))
  .refine(
    (value) => Number.isSafeInteger(value),
    "Expected a positive integer.",
  );

/** A page size from 1 to 48. */
const limitSchema = positiveIntegerSchema.refine(
  (value) => value >= 1 && value <= 48,
  "Limit must be between 1 and 48.",
);

/** A boolean query value written as `true` or `false`. */
const booleanSchema = z
  .enum(["true", "false"], "Expected true or false.")
  .transform((value) => value === "true");

/**
 * Strict query validation for `GET /api/products`.
 *
 * Repeated values are deduplicated. Empty values, objects, arrays of objects,
 * and non numeric values fail validation so the API can return 400.
 */
export const catalogListQuerySchema = z
  .object({
    /** Repeated category slugs. Unknown slugs match nothing. */
    category: repeatedStringsSchema,
    /** Repeated product types. */
    type: repeatedProductTypesSchema,
    /** Minimum price in the active currency. */
    minPrice: priceSchema.optional(),
    /** Maximum price in the active currency. */
    maxPrice: priceSchema.optional(),
    /** Currency used for price filtering and sorting. Defaults to BDT. */
    currency: z.enum([Currency.BDT, Currency.USD]).default(Currency.BDT),
    /** Sort order. Defaults to newest. */
    sort: catalogSortSchema.default("newest"),
    /** Requested page. Defaults to 1. */
    page: positiveIntegerSchema.default(1),
    /** Page size. Defaults to 12. */
    limit: limitSchema.default(12),
    /** When true, only featured products are returned. */
    featured: booleanSchema.optional(),
  })
  .superRefine((query, context) => {
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    ) {
      context.addIssue({
        code: "custom",
        path: ["minPrice"],
        message: "Minimum price cannot be greater than maximum price.",
      });
    }
  });

/** Validated catalog list query. */
export type CatalogListQuery = z.infer<typeof catalogListQuerySchema>;

/** Re-exported for callers that need the sort union type. */
export type { CatalogSort };
