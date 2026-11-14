/**
 * Server side catalog client.
 *
 * The browser never calls the Express API directly. Server components call
 * these helpers, which use `API_INTERNAL_URL`, cache each read for 60 seconds,
 * and throw a typed error the route boundaries can render.
 */
import { unstable_cache } from "next/cache";
import type {
  CatalogCategoryDetailResponse,
  CatalogCategoryListResponse,
  CatalogProductDetailResponse,
  CatalogProductListResponse,
  CatalogSort,
  CategoryDetailDto,
  CategorySummaryDto,
  CurrencyCode,
  ProductDetailDto,
  ProductType,
} from "@crochet-peakz/shared";
import { getCatalogEnv } from "./env";

/** Query the shop and home page can send to the catalog list endpoint. */
export interface CatalogListParams {
  /** Repeated category slugs. */
  category?: string[];
  /** Repeated product types. */
  type?: ProductType[];
  /** Minimum price in the active currency. */
  minPrice?: number;
  /** Maximum price in the active currency. */
  maxPrice?: number;
  /** Currency used for filtering and sorting. Always sent. */
  currency: CurrencyCode;
  /** Sort order. */
  sort?: CatalogSort;
  /** Requested page. */
  page?: number;
  /** Page size. */
  limit?: number;
  /** When true, only featured products are returned. */
  featured?: boolean;
}

/** A typed catalog failure with the API status and code. */
export class CatalogApiError extends Error {
  /** HTTP status, or 0 when the API could not be reached. */
  readonly statusCode: number;
  /** API error code when present. */
  readonly code: string | undefined;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.name = "CatalogApiError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Tells a missing catalog resource apart from a failed read.
 *
 * @param error Unknown thrown value.
 * @returns True when the API answered 404.
 */
export function isCatalogNotFound(error: unknown): error is CatalogApiError {
  return error instanceof CatalogApiError && error.statusCode === 404;
}

/**
 * Fetches a page of visible products.
 *
 * @param params List query.
 * @returns Product summaries and pagination metadata.
 */
export async function fetchCatalogProducts(
  params: CatalogListParams,
): Promise<CatalogProductListResponse> {
  const search = new URLSearchParams();

  for (const category of params.category ?? []) {
    search.append("category", category);
  }
  for (const type of params.type ?? []) {
    search.append("type", type);
  }
  if (params.minPrice !== undefined) {
    search.set("minPrice", String(params.minPrice));
  }
  if (params.maxPrice !== undefined) {
    search.set("maxPrice", String(params.maxPrice));
  }
  search.set("currency", params.currency);
  if (params.sort !== undefined) {
    search.set("sort", params.sort);
  }
  if (params.page !== undefined) {
    search.set("page", String(params.page));
  }
  if (params.limit !== undefined) {
    search.set("limit", String(params.limit));
  }
  if (params.featured === true) {
    search.set("featured", "true");
  }

  return request<CatalogProductListResponse>(`/products?${search.toString()}`);
}

/**
 * Cached detail lookup. A hidden resource is stored as a value so the 60
 * second cache window can replace a stale payload with a not found result.
 */
type DetailLookup<T> =
  | { status: "found"; data: T }
  | { status: "not-found"; message: string; code: string | undefined };

/**
 * Loads the product detail, caching a not found result as a value.
 *
 * A bare `fetch` revalidate cannot cache a 404, so a hidden product would keep
 * serving its last 200 payload forever after revalidation starts answering
 * not found. Caching the lookup result keeps the 60 second window and lets the
 * not found result replace the previous payload.
 */
// Next 16 currently marks unstable_cache as unstable. Keep this usage narrow and
// revisit it when adopting the stable cache APIs described in the Next docs.
const loadProductDetail = unstable_cache(
  async (slug: string): Promise<DetailLookup<ProductDetailDto>> => {
    try {
      const { data } = await request<CatalogProductDetailResponse>(
        `/products/${encodeURIComponent(slug)}`,
        "no-store",
      );
      return { status: "found", data };
    } catch (error) {
      if (isCatalogNotFound(error)) {
        return {
          status: "not-found",
          message: error.message,
          code: error.code,
        };
      }
      throw error;
    }
  },
  ["catalog-product-detail"],
  { revalidate: 60 },
);

/**
 * Fetches one visible product by slug.
 *
 * @param slug Product slug.
 * @returns The product detail payload.
 */
export async function fetchCatalogProduct(
  slug: string,
): Promise<ProductDetailDto> {
  const lookup = await loadProductDetail(slug);
  if (lookup.status === "not-found") {
    throw new CatalogApiError(lookup.message, 404, lookup.code);
  }
  return lookup.data;
}

/**
 * Fetches every category with its subtree count and cover.
 *
 * @returns Category summaries.
 */
export async function fetchCatalogCategories(): Promise<CategorySummaryDto[]> {
  const response = await request<CatalogCategoryListResponse>("/categories");
  return response.data;
}

/**
 * Loads the category detail, caching a not found result as a value.
 *
 * Same reason as the product lookup: a 404 is not written back to the fetch
 * cache, so a deleted category would otherwise serve its stale page forever.
 */
const loadCategoryDetail = unstable_cache(
  async (slug: string): Promise<DetailLookup<CategoryDetailDto>> => {
    try {
      const { data } = await request<CatalogCategoryDetailResponse>(
        `/categories/${encodeURIComponent(slug)}`,
        "no-store",
      );
      return { status: "found", data };
    } catch (error) {
      if (isCatalogNotFound(error)) {
        return {
          status: "not-found",
          message: error.message,
          code: error.code,
        };
      }
      throw error;
    }
  },
  ["catalog-category-detail"],
  { revalidate: 60 },
);

/**
 * Fetches one category with its breadcrumb and children.
 *
 * @param slug Category slug.
 * @returns The category detail payload.
 */
export async function fetchCatalogCategory(
  slug: string,
): Promise<CategoryDetailDto> {
  const lookup = await loadCategoryDetail(slug);
  if (lookup.status === "not-found") {
    throw new CatalogApiError(lookup.message, 404, lookup.code);
  }
  return lookup.data;
}

/**
 * Reads a catalog response, translating failures into a typed error.
 *
 * @param path API path.
 * @param cacheMode `revalidate` keeps the 60 second data cache used by list
 * reads. `no-store` fetches fresh data for callers that cache the lookup
 * result themselves, including not found results.
 * @returns Parsed response body.
 */
async function request<T>(
  path: string,
  cacheMode: "revalidate" | "no-store" = "revalidate",
): Promise<T> {
  const { apiInternalUrl } = getCatalogEnv();
  let response: Response;

  try {
    response = await fetch(
      `${apiInternalUrl}${path}`,
      cacheMode === "no-store"
        ? { cache: "no-store" }
        : { next: { revalidate: 60 } },
    );
  } catch {
    throw new CatalogApiError(
      "We could not reach the catalog. Please try again.",
      0,
    );
  }

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    throw new CatalogApiError(
      readErrorMessage(payload, response.status),
      response.status,
      readErrorCode(payload),
    );
  }

  return (await response.json()) as T;
}

/** Reads the API error message from an unknown body. */
function readErrorMessage(payload: unknown, status: number): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }

  return `The catalog request failed with status ${String(status)}.`;
}

/** Reads the API error code from an unknown body. */
function readErrorCode(payload: unknown): string | undefined {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "code" in payload.error &&
    typeof payload.error.code === "string"
  ) {
    return payload.error.code;
  }

  return undefined;
}
