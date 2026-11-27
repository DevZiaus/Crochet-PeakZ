import type { NextRequest } from "next/server";
import { proxyApiRequest, type ApiProxyConfig } from "@/lib/api-proxy";

/** Forces request time evaluation on every call. */
export const dynamic = "force-dynamic";

/** The API's JSON limit for auth calls. */
const MAX_AUTH_BODY_BYTES = 1024 * 1024;

/**
 * The only API paths this proxy will call.
 *
 * The catch all route must not become an open relay that adds the shared
 * secret to any path a caller invents.
 */
const ALLOWED_AUTH_PATHS = new Set([
  "register",
  "verify-email",
  "resend-verification",
  "login",
  "refresh",
  "logout",
  "me",
  "forgot-password",
  "reset-password",
  "google",
  "google/callback",
  "facebook",
  "facebook/callback",
]);

const AUTH_PROXY_CONFIG: ApiProxyConfig = {
  upstreamBasePath: "/auth",
  allowedMethods: ["GET", "POST"],
  isAllowedPath: (_method, targetPath) => ALLOWED_AUTH_PATHS.has(targetPath),
  maxBodyBytes: MAX_AUTH_BODY_BYTES,
  notFoundMessage: "Unknown auth endpoint.",
  unavailableMessage: "The auth service did not answer. Try again.",
  shouldRefreshOn401: (targetPath) =>
    targetPath !== "refresh" && targetPath !== "login",
};

/** Next.js route context with the catch all auth path. */
interface RouteContext {
  params: Promise<{ path: string[] }>;
}

/**
 * Forwards GET auth requests (including OAuth entry points and callbacks).
 *
 * @param request Incoming browser request.
 * @param context Dynamic route parameters.
 * @returns The API response, cookies and redirects included.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  const { path } = await context.params;
  return proxyApiRequest(request, path, AUTH_PROXY_CONFIG);
}

/**
 * Forwards POST auth requests.
 *
 * @param request Incoming browser request.
 * @param context Dynamic route parameters.
 * @returns The API response, cookies and redirects included.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  const { path } = await context.params;
  return proxyApiRequest(request, path, AUTH_PROXY_CONFIG);
}
