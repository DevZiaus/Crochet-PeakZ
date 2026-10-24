/**
 * Returns a safe, same origin relative path for post sign in navigation.
 *
 * Only a path that starts with a single `/` is accepted. Protocol relative
 * values (`//evil.example`), absolute URLs, backslashes, and control characters
 * fall back to the supplied default. This is the single rule shared by the API
 * (which validates `next` before signing it into OAuth state) and the web app
 * (which validates it again before navigating).
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

  return trimmed;
}

/**
 * Returns the destination a customer lands on after sign in.
 *
 * A valid same origin relative `next` wins. Otherwise ADMIN lands on the admin
 * area and everyone else lands on the storefront.
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
  return sanitizeNextPath(next, fallback);
}
