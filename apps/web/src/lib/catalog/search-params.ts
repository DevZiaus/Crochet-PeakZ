/**
 * Forgiving URL search parameter parsing for the shop.
 *
 * The API is strict and returns 400 for malformed values. The web drops bad
 * values silently, keeps the good ones, and never sends an invalid query.
 */
import {
  ProductType,
  type CatalogSort,
  type CurrencyCode,
  type ProductType as ProductTypeCode,
} from "@crochet-peakz/shared";
import type { CatalogListParams } from "./api";

/** The shop state the URL carries. */
export interface CatalogSearchState {
  /** Selected category slugs. */
  categories: string[];
  /** Selected product types. */
  types: ProductTypeCode[];
  /** Minimum price in the active currency. */
  minPrice?: number;
  /** Maximum price in the active currency. */
  maxPrice?: number;
  /** Sort order. */
  sort: CatalogSort;
  /** Requested page. */
  page: number;
  /** Featured only filter. */
  featured?: boolean;
}

/** The state a bare `/shop` visit has. */
export const defaultCatalogSearchState: CatalogSearchState = {
  categories: [],
  types: [],
  sort: "newest",
  page: 1,
};

const productTypeValues: readonly ProductTypeCode[] =
  Object.values(ProductType);
const sortValues: readonly CatalogSort[] = [
  "newest",
  "price-asc",
  "price-desc",
];
const pricePattern = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const positiveIntegerPattern = /^[1-9]\d*$/;

/** Catalog filters a collection page does not apply. */
const unsupportedCollectionParamKeys = [
  "category",
  "type",
  "minPrice",
  "maxPrice",
  "featured",
] as const;

type RawSearchParams = Record<string, string | string[] | undefined>;

/**
 * Parses raw URL search parameters into a shop state.
 *
 * Unknown categories and types are dropped. Invalid prices are ignored. A
 * minimum above the maximum is swapped. An unknown sort falls back to newest
 * and an invalid page falls back to 1.
 *
 * @param params Raw search parameters from the page.
 * @param knownCategorySlugs Categories the API returned, used to drop stale slugs.
 * @returns A safe shop state.
 */
export function parseCatalogSearchParams(
  params: RawSearchParams,
  knownCategorySlugs: ReadonlySet<string>,
): CatalogSearchState {
  const categories = unique(
    toArray(params["category"])
      .map((value) => value.trim())
      .filter((value) => knownCategorySlugs.has(value)),
  );
  const types = unique(
    toArray(params["type"])
      .map((value) => value.trim())
      .filter((value): value is ProductTypeCode =>
        productTypeValues.includes(value as ProductTypeCode),
      ),
  );

  let minPrice = parsePrice(params["minPrice"]);
  let maxPrice = parsePrice(params["maxPrice"]);
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }

  const sortValue = firstValue(params["sort"]);
  const sort = sortValues.includes(sortValue as CatalogSort)
    ? (sortValue as CatalogSort)
    : "newest";
  const pageValue = firstValue(params["page"]);
  // Cap at the largest exact integer so an oversized value stays a plain
  // decimal string for the strict API, which clamps it to the last page.
  const page =
    pageValue !== undefined && positiveIntegerPattern.test(pageValue)
      ? Math.min(Number(pageValue), Number.MAX_SAFE_INTEGER)
      : 1;
  const featured = firstValue(params["featured"]) === "true" ? true : undefined;

  return {
    categories,
    types,
    ...(minPrice === undefined ? {} : { minPrice }),
    ...(maxPrice === undefined ? {} : { maxPrice }),
    sort,
    page,
    ...(featured === undefined ? {} : { featured }),
  };
}

/**
 * Tells whether raw search parameters carry a catalog filter that a collection
 * page does not apply.
 *
 * Collection pages support only `sort` and `page`. The shop parser also
 * understands category, type, price, and featured filters. When one of those
 * appears on a collection URL the page ignores it, so the page redirects to a
 * normalized URL instead of leaving a link that looks filtered but is not.
 *
 * @param params Raw search parameters from the page.
 * @returns True when at least one unsupported catalog parameter is present.
 */
export function hasUnsupportedCollectionParams(
  params: RawSearchParams,
): boolean {
  return unsupportedCollectionParamKeys.some(
    (key) => params[key] !== undefined,
  );
}

/**
 * Builds the normalized shop URL for a state.
 *
 * Defaults (newest, page 1) are omitted, so the result is also the canonical
 * URL for filtered views.
 *
 * @param state Shop state.
 * @param overrides Values to replace, for sort and pagination links.
 * @returns A relative URL starting at `/shop`.
 */
export function buildShopHref(
  state: CatalogSearchState,
  overrides: Partial<CatalogSearchState> = {},
): string {
  const merged: CatalogSearchState = { ...state, ...overrides };
  const params = new URLSearchParams();

  for (const category of merged.categories) {
    params.append("category", category);
  }
  for (const type of merged.types) {
    params.append("type", type);
  }
  if (merged.minPrice !== undefined) {
    params.set("minPrice", String(merged.minPrice));
  }
  if (merged.maxPrice !== undefined) {
    params.set("maxPrice", String(merged.maxPrice));
  }
  if (merged.sort !== "newest") {
    params.set("sort", merged.sort);
  }
  if (merged.page > 1) {
    params.set("page", String(merged.page));
  }
  if (merged.featured === true) {
    params.set("featured", "true");
  }

  const query = params.toString();
  return query.length > 0 ? `/shop?${query}` : "/shop";
}

/**
 * Builds the canonical URL for a shop view.
 *
 * A single collection on page 1 with the default sort and no other filters
 * canonicalises to that collection page. Every other view canonicalises to
 * its own normalized shop URL.
 *
 * @param state Parsed shop state.
 * @param webAppUrl Absolute web origin.
 * @returns The absolute canonical URL.
 */
export function buildShopCanonical(
  state: CatalogSearchState,
  webAppUrl: string,
): string {
  const [onlyCategory] = state.categories;
  const isSingleCollection =
    onlyCategory !== undefined &&
    state.categories.length === 1 &&
    state.page === 1 &&
    state.sort === "newest" &&
    !hasCatalogFilters({ ...state, categories: [] });

  return isSingleCollection
    ? `${webAppUrl}/collections/${onlyCategory}`
    : `${webAppUrl}${buildShopHref(state)}`;
}

/**
 * Builds a sort link that preserves the active filters and resets the page.
 *
 * @param pathname Current path, `/shop` or a collection page.
 * @param currentParams Current URL search parameters.
 * @param sort The next sort order.
 * @returns The pathname with the updated query string.
 */
export function buildSortHref(
  pathname: string,
  currentParams: URLSearchParams,
  sort: CatalogSort,
): string {
  const params = new URLSearchParams(currentParams.toString());
  if (sort === "newest") {
    params.delete("sort");
  } else {
    params.set("sort", sort);
  }
  params.delete("page");
  const query = params.toString();
  return query.length > 0 ? `${pathname}?${query}` : pathname;
}

/**
 * Converts a shop state into catalog list parameters.
 *
 * @param state Shop state.
 * @param currency Active currency.
 * @returns Parameters for `fetchCatalogProducts`.
 */
export function toCatalogListParams(
  state: CatalogSearchState,
  currency: CurrencyCode,
): CatalogListParams {
  return {
    category: state.categories,
    type: state.types,
    ...(state.minPrice === undefined ? {} : { minPrice: state.minPrice }),
    ...(state.maxPrice === undefined ? {} : { maxPrice: state.maxPrice }),
    currency,
    sort: state.sort,
    page: state.page,
    limit: 12,
    ...(state.featured === undefined ? {} : { featured: state.featured }),
  };
}

/**
 * Tells whether the state has a filter beyond page and sort.
 *
 * @param state Shop state.
 * @returns True when a category, type, price, or featured filter is active.
 */
export function hasCatalogFilters(state: CatalogSearchState): boolean {
  return (
    state.categories.length > 0 ||
    state.types.length > 0 ||
    state.minPrice !== undefined ||
    state.maxPrice !== undefined ||
    state.featured === true
  );
}

/** Reads the first value of a repeatable parameter. */
function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Turns a repeatable parameter into an array. */
function toArray(value: string | string[] | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/** Parses a nonnegative price with at most two decimals. */
function parsePrice(value: string | string[] | undefined): number | undefined {
  const raw = firstValue(value)?.trim();
  if (raw === undefined || !pricePattern.test(raw)) {
    return undefined;
  }
  return Number(raw);
}

/** Removes duplicates while keeping the first occurrence. */
function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
