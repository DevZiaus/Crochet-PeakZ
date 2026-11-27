import type {
  CartAddItemBody,
  CartAddItemResponse,
  CartLineInput,
  CartMergeBody,
  CartQuoteResponse,
  CartResponse,
} from "@crochet-peakz/shared";

/** Upper bound for one browser cart API request. */
const CART_FETCH_TIMEOUT_MS = 10_000;

/** Error raised by the cart HTTP client when a request fails or returns non-2xx. */
export class CartApiError extends Error {
  /** HTTP status code, or `0` for network / timeout errors. */
  readonly status: number;
  /** Optional API error code (for example `ITEM_UNAVAILABLE` or `NOT_IN_CART`). */
  readonly code?: string;
  /** Optional cart DTO attached to 409 conflict responses. */
  readonly cartData?: CartResponse["data"];

  constructor(
    status: number,
    message: string,
    options?: { code?: string; cartData?: CartResponse["data"] },
  ) {
    super(message);
    this.name = "CartApiError";
    this.status = status;
    this.code = options?.code;
    this.cartData = options?.cartData;
  }
}

/** Parses an error body returned by the API or cart web proxy. */
async function toCartApiError(response: Response): Promise<CartApiError> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string; code?: string };
      data?: CartResponse["data"];
    };
    return new CartApiError(
      response.status,
      body.error?.message ?? "Could not update your cart, please try again",
      {
        code: body.error?.code,
        cartData: body.data,
      },
    );
  } catch {
    return new CartApiError(
      response.status,
      "Could not update your cart, please try again",
    );
  }
}

/** Sends one same-origin cart request through the Next.js cart proxy. */
async function requestCartJson<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      cache: "no-store",
      credentials: "same-origin",
      signal: AbortSignal.timeout(CART_FETCH_TIMEOUT_MS),
      ...init,
    });
  } catch {
    throw new CartApiError(0, "The cart service did not answer. Try again.");
  }

  if (!response.ok) {
    throw await toCartApiError(response);
  }

  return (await response.json()) as T;
}

/**
 * Quotes visitor cart lines against live catalog stock and pricing.
 *
 * @param lines Browser cart lines to resolve.
 * @returns Live resolved lines.
 */
export async function quoteCartLines(
  lines: readonly CartLineInput[],
): Promise<CartQuoteResponse> {
  return requestCartJson<CartQuoteResponse>("/api/cart/quote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lines }),
  });
}

/** Fetches the signed in customer's server cart. */
export async function fetchAccountCart(): Promise<CartResponse> {
  return requestCartJson<CartResponse>("/api/cart", {
    method: "GET",
  });
}

/** Adds one unit of a variant to the signed in customer's cart. */
export async function addAccountCartItem(
  body: CartAddItemBody,
): Promise<CartAddItemResponse> {
  return requestCartJson<CartAddItemResponse>("/api/cart/items", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Sets the quantity of an existing line in the signed in customer's cart. */
export async function updateAccountCartItem(
  variantId: string,
  quantity: number,
): Promise<CartResponse> {
  return requestCartJson<CartResponse>(
    `/api/cart/items/${encodeURIComponent(variantId)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ quantity }),
    },
  );
}

/** Removes one variant line from the signed in customer's cart. */
export async function removeAccountCartItem(
  variantId: string,
): Promise<CartResponse> {
  return requestCartJson<CartResponse>(
    `/api/cart/items/${encodeURIComponent(variantId)}`,
    {
      method: "DELETE",
    },
  );
}

/** Clears every line from the signed in customer's cart. */
export async function clearAccountCart(): Promise<CartResponse> {
  return requestCartJson<CartResponse>("/api/cart", {
    method: "DELETE",
  });
}

/** Merges a visitor browser cart into the signed in customer's account cart. */
export async function mergeGuestCart(
  body: CartMergeBody,
): Promise<CartResponse> {
  return requestCartJson<CartResponse>("/api/cart/merge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
