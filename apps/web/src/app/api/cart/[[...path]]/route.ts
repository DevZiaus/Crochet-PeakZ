import type { NextRequest } from "next/server";
import { CART_MAX_BODY_BYTES } from "@crochet-peakz/shared";
import { proxyApiRequest, type ApiProxyConfig } from "@/lib/api-proxy";

/** Forces request time evaluation on every call. */
export const dynamic = "force-dynamic";

/** Matches `items/<uuid>` for single line PATCH and DELETE routes. */
const CART_ITEM_PATH_PATTERN =
  /^items\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks whether a method and subpath pair belongs to the shopping cart API.
 */
function isAllowedCartPath(method: string, targetPath: string): boolean {
  if (method === "GET") {
    return targetPath === "";
  }
  if (method === "POST") {
    return (
      targetPath === "quote" || targetPath === "items" || targetPath === "merge"
    );
  }
  if (method === "PATCH") {
    return CART_ITEM_PATH_PATTERN.test(targetPath);
  }
  if (method === "DELETE") {
    return targetPath === "" || CART_ITEM_PATH_PATTERN.test(targetPath);
  }
  return false;
}

const CART_PROXY_CONFIG: ApiProxyConfig = {
  upstreamBasePath: "/cart",
  allowedMethods: ["GET", "POST", "PATCH", "DELETE"],
  isAllowedPath: isAllowedCartPath,
  maxBodyBytes: CART_MAX_BODY_BYTES,
  notFoundMessage: "Unknown cart endpoint.",
  unavailableMessage: "The cart service did not answer. Try again.",
  shouldRefreshOn401: (targetPath) => targetPath !== "quote",
};

/** Next.js route context with optional catch all cart segments. */
interface CartRouteContext {
  params: Promise<{ path?: string[] }>;
}

/**
 * Forwards `GET /api/cart`.
 */
export async function GET(
  request: NextRequest,
  context: CartRouteContext,
): Promise<Response> {
  const { path = [] } = await context.params;
  return proxyApiRequest(request, path, CART_PROXY_CONFIG);
}

/**
 * Forwards `POST /api/cart/quote`, `/api/cart/items`, and `/api/cart/merge`.
 */
export async function POST(
  request: NextRequest,
  context: CartRouteContext,
): Promise<Response> {
  const { path = [] } = await context.params;
  return proxyApiRequest(request, path, CART_PROXY_CONFIG);
}

/**
 * Forwards `PATCH /api/cart/items/:variantId`.
 */
export async function PATCH(
  request: NextRequest,
  context: CartRouteContext,
): Promise<Response> {
  const { path = [] } = await context.params;
  return proxyApiRequest(request, path, CART_PROXY_CONFIG);
}

/**
 * Forwards `DELETE /api/cart` and `DELETE /api/cart/items/:variantId`.
 */
export async function DELETE(
  request: NextRequest,
  context: CartRouteContext,
): Promise<Response> {
  const { path = [] } = await context.params;
  return proxyApiRequest(request, path, CART_PROXY_CONFIG);
}
