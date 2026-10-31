import { NextResponse, type NextRequest } from "next/server";
import { getWebAuthEnv } from "@/lib/auth/web-env";

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

/** The access cookie written by a successful sign in or refresh. */
const ACCESS_COOKIE = "cp_access";

/** The long lived cookie that proves a refresh is possible. */
const REFRESH_COOKIE = "cp_refresh";

/**
 * Whether a path belongs to the admin area.
 *
 * @param pathname Request path with any trailing slash removed.
 * @returns True for `/admin` and everything under it.
 */
function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/**
 * Rejects a caller who may not open the admin area.
 *
 * This runs before the route renders, which is the only way to keep admin
 * markup out of the response. A server layout that redirects is too late: Next
 * renders the page alongside it, so the markup is already in the payload.
 *
 * The role is read from the API, not from the access token, so a role removed
 * in the database takes effect on the next request. A caller has to send a
 * session cookie to be considered at all, and anything the API cannot confirm
 * fails closed to the sign in screen.
 *
 * @param request Incoming admin request.
 * @returns A redirect for a caller who is not an admin, or null to continue.
 */
async function guardAdminPath(
  request: NextRequest,
): Promise<NextResponse | null> {
  const env = getWebAuthEnv();
  const signIn = NextResponse.redirect(
    new URL(
      `/login?next=${encodeURIComponent(request.nextUrl.pathname)}`,
      request.url,
    ),
  );

  const hasSessionCookie =
    request.cookies.has(ACCESS_COOKIE) || request.cookies.has(REFRESH_COOKIE);

  if (!hasSessionCookie) {
    return signIn;
  }

  let role: string | undefined;
  try {
    const response = await fetch(`${env.apiInternalUrl}/auth/me`, {
      headers: {
        cookie: request.headers.get("cookie") ?? "",
        "x-proxy-secret": env.proxySharedSecret,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return signIn;
    }

    role = ((await response.json()) as { role?: string }).role;
  } catch {
    return signIn;
  }

  if (role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return null;
}

/**
 * Guards the admin area and marks the auth screens as noindex.
 *
 * Next.js 16 runs this file as the request proxy. The admin check happens here
 * rather than in a layout so a caller who is not an admin never receives admin
 * markup, only a redirect. The auth API proxy under `/api/auth` is untouched.
 *
 * @param request Incoming request.
 * @returns A redirect for a non admin caller, or the response to continue with.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname.replace(/\/+$/, "") || "/";

  if (isAdminPath(pathname)) {
    const rejection = await guardAdminPath(request);
    if (rejection) {
      return rejection;
    }
  }

  const response = NextResponse.next();

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
    "/admin",
    "/admin/:path*",
  ],
};
