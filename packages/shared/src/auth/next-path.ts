/**
 * Screens a customer should never land on after signing in.
 *
 * They are part of the sign in flow itself, so returning to one after a
 * successful sign in either shows the form again or, for the OAuth result
 * page, reports a failure that did not happen. A `next` pointing at one falls
 * back to the role default.
 */
const AUTH_SCREEN_PATHS = new Set([
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
]);

/**
 * Returns a safe, same origin relative path for post sign in navigation.
 *
 * Only a path that starts with a single `/` is accepted. Protocol relative
 * values (`//evil.example`), absolute URLs, backslashes, control characters,
 * and the auth screens themselves fall back to the supplied default. This is
 * the single rule shared by the API (which validates `next` before signing it
 * into OAuth state) and the web app (which validates it again before
 * navigating).
 *
 * @param value Untrusted `next` value from a query string.
 * @param fallback Destination used when the value is missing or unsafe.
 * @returns A relative path safe to pass to the router.
 */
export function sanitizeNextPath(
  value: string | null | undefined,
  fallback = "/",
): string {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  if (trimmed.includes("\\") || trimmed.includes("://")) {
    return fallback;
  }

  // Reject raw control characters, spaces, and anything a browser would decode
  // into a scheme or a new host.
  if (/[\p{Cc}\s]/u.test(trimmed)) {
    return fallback;
  }

  const pathname = trimmed.split(/[?#]/, 1)[0] ?? "";
  if (AUTH_SCREEN_PATHS.has(pathname.replace(/\/+$/, ""))) {
    return fallback;
  }

  return trimmed;
}

/**
 * Returns the destination a customer lands on after sign in.
 *
 * A valid same origin relative `next` wins when the account may open it.
 * Otherwise ADMIN lands on the admin area and everyone else lands on the
 * storefront. A CUSTOMER asking for an admin path is sent to the storefront
 * instead of bouncing off the admin guard.
 *
 * @param next Untrusted `next` value from a query string.
 * @param role The signed in account role.
 * @returns A relative path.
 */
export function resolvePostSignInPath(
  next: string | null | undefined,
  role: "CUSTOMER" | "ADMIN",
): string {
  const fallback = role === "ADMIN" ? "/admin" : "/";
  const destination = sanitizeNextPath(next, fallback);

  if (role !== "ADMIN" && isAdminPath(destination)) {
    return fallback;
  }

  return destination;
}

/**
 * Whether a relative path belongs to the admin area.
 *
 * Query and hash suffixes are ignored so `/admin?tab=orders` is treated the
 * same as `/admin`. A path such as `/administrator` is a different screen and
 * is not matched.
 *
 * @param path Sanitized relative path.
 * @returns True for `/admin` and its descendants.
 */
function isAdminPath(path: string): boolean {
  const pathname = path.split(/[?#]/, 1)[0] ?? "";
  return pathname === "/admin" || pathname.startsWith("/admin/");
}
