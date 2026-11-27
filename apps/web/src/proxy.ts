import { NextResponse, type NextRequest } from "next/server";
import { getWebAuthEnv } from "@/lib/auth/web-env";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  readSetCookie,
  writeCookie,
} from "@/lib/auth/cookies";
import { PROXY_CLIENT_IP_HEADER, readClientIp } from "@/lib/auth/client-ip";

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
  "/cart",
]);

/** What the admin guard decided, and the cookies to relay either way. */
interface GuardResult {
  /** A response that replaces the render, or null to continue. */
  rejection: NextResponse | null;
  /** Rotated or cleared auth cookies to send to the browser. */
  setCookies: string[];
  /** Cookie header carrying a refreshed access token, for the server render. */
  cookieHeader?: string;
  /** The role the API proved, so the server render need not ask again. */
  role?: string;
}

/** The role answer from the API, or null when it refused the session. */
type RoleAnswer = { role?: string } | null;

/** How long either guard call may take before the guard fails closed. */
const AUTH_FETCH_TIMEOUT_MS = 5_000;

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
 * @returns The rejection (a redirect, or null to continue) and the auth
 *   cookies to relay, including a rotated access cookie for the render.
 */
async function guardAdminPath(request: NextRequest): Promise<GuardResult> {
  const env = getWebAuthEnv();
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const signIn = NextResponse.redirect(
    new URL(`/login?next=${encodeURIComponent(nextPath)}`, request.url),
  );

  const hasSessionCookie =
    request.cookies.has(ACCESS_COOKIE) || request.cookies.has(REFRESH_COOKIE);

  if (!hasSessionCookie) {
    return { rejection: signIn, setCookies: [] };
  }

  let cookieHeader = request.headers.get("cookie") ?? "";
  const clientIp = readClientIp(request.headers);
  let setCookies: string[] = [];
  let answer = await fetchRole(cookieHeader, env, clientIp);

  if (!answer && request.cookies.has(REFRESH_COOKIE)) {
    // The access cookie has a short life. Refresh it once with the long lived
    // cookie, then judge the role from the retried answer. This is what lets an
    // open admin tab reload after the access token expires (AC-5).
    const refreshed = await refreshAccessCookie(cookieHeader, env, clientIp);
    setCookies = refreshed.setCookies;

    if (refreshed.cookieHeader) {
      cookieHeader = refreshed.cookieHeader;
      answer = await fetchRole(cookieHeader, env, clientIp);
    }
  }

  if (!answer) {
    return { rejection: signIn, setCookies };
  }

  if (answer.role !== "ADMIN") {
    return {
      rejection: NextResponse.redirect(new URL("/", request.url)),
      setCookies,
    };
  }

  return { rejection: null, setCookies, cookieHeader, role: answer.role };
}

/**
 * Asks the API who the caller is, using the cookies the proxy received.
 *
 * @param cookieHeader Raw `Cookie` header to forward.
 * @param env Web auth environment.
 * @param clientIp Client address to forward for API rate limiting.
 * @returns The role answer, or null when the API refused or could not answer.
 */
async function fetchRole(
  cookieHeader: string,
  env: ReturnType<typeof getWebAuthEnv>,
  clientIp: string,
): Promise<RoleAnswer> {
  try {
    const response = await fetch(`${env.apiInternalUrl}/auth/me`, {
      headers: {
        cookie: cookieHeader,
        "x-proxy-secret": env.proxySharedSecret,
        "x-forwarded-for": clientIp,
        [PROXY_CLIENT_IP_HEADER]: clientIp,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(AUTH_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as RoleAnswer;
  } catch {
    return null;
  }
}

/**
 * Rotates the access cookie once, using the refresh cookie.
 *
 * The rotated `Set-Cookie` values are returned so the browser keeps the new
 * pair. The rewritten cookie header is for the server render: without it the
 * layout would still read the expired access cookie in the same request.
 *
 * @param cookieHeader Raw `Cookie` header to forward.
 * @param env Web auth environment.
 * @param clientIp Client address to forward for API rate limiting.
 * @returns The rewritten cookie header (when the refresh worked) and the
 *   `Set-Cookie` values to relay, including the clearing pair on a failure.
 */
async function refreshAccessCookie(
  cookieHeader: string,
  env: ReturnType<typeof getWebAuthEnv>,
  clientIp: string,
): Promise<{ cookieHeader?: string; setCookies: string[] }> {
  try {
    const response = await fetch(`${env.apiInternalUrl}/auth/refresh`, {
      method: "POST",
      headers: {
        cookie: cookieHeader,
        "x-proxy-secret": env.proxySharedSecret,
        "x-forwarded-for": clientIp,
        [PROXY_CLIENT_IP_HEADER]: clientIp,
        origin: env.webAppUrl,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(AUTH_FETCH_TIMEOUT_MS),
    });
    const setCookies = response.headers.getSetCookie();

    if (response.status !== 200) {
      return { setCookies };
    }

    const nextAccess = readSetCookie(setCookies, ACCESS_COOKIE);
    if (!nextAccess) {
      return { setCookies };
    }

    // The API rotates the refresh token too. The render must see the new pair,
    // not a new access token beside the old, now revoked refresh token.
    const nextRefresh = readSetCookie(setCookies, REFRESH_COOKIE);
    let rewritten = writeCookie(cookieHeader, ACCESS_COOKIE, nextAccess);
    if (nextRefresh) {
      rewritten = writeCookie(rewritten, REFRESH_COOKIE, nextRefresh);
    }

    return { cookieHeader: rewritten, setCookies };
  } catch {
    return { setCookies: [] };
  }
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
  let guard: GuardResult = { rejection: null, setCookies: [] };

  if (isAdminPath(pathname)) {
    guard = await guardAdminPath(request);

    if (guard.rejection) {
      for (const cookie of guard.setCookies) {
        guard.rejection.headers.append("set-cookie", cookie);
      }
      return guard.rejection;
    }
  }

  // A refreshed access token must reach the server render in the same request,
  // not only the browser, or the layout would judge the expired cookie again.
  // The proved role rides along so the layout skips its own `/me` round trip.
  const headers = new Headers(request.headers);
  headers.delete("x-auth-role");
  headers.set(
    "x-auth-return-to",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  if (guard.cookieHeader) {
    headers.set("cookie", guard.cookieHeader);
  }
  if (guard.role) {
    headers.set("x-auth-role", guard.role);
  }
  const response = NextResponse.next({ request: { headers } });

  for (const cookie of guard.setCookies) {
    response.headers.append("set-cookie", cookie);
  }

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
    "/cart",
    "/admin",
    "/admin/:path*",
  ],
};
