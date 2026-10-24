import { NextResponse, type NextRequest } from "next/server";

/**
 * The six auth screens that must never appear in search results.
 *
 * Each route segment already sets `robots: { index: false }`. This header is
 * the second layer: it also covers the raw HTML response before any client
 * JavaScript runs, and any crawler that ignores the meta tag.
 */
const NOINDEX_PATHS = new Set([
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
]);

/**
 * Adds `X-Robots-Tag` to the auth screens.
 *
 * Next.js 16 runs this file as the request proxy. It only sets a response
 * header; routing, cookies, and the auth API proxy are untouched.
 *
 * @param request Incoming request.
 * @returns The response with the noindex header on an auth path.
 */
export function proxy(request: NextRequest): NextResponse {
  const response = NextResponse.next();
  const pathname = request.nextUrl.pathname.replace(/\/+$/, "") || "/";

  if (NOINDEX_PATHS.has(pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

export const config = {
  matcher: [
    "/login",
    "/register",
    "/verify-email",
    "/forgot-password",
    "/reset-password",
    "/auth/callback",
  ],
};
