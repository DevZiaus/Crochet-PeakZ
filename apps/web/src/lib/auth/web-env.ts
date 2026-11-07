/**
 * Server only auth configuration for the Next.js proxy.
 *
 * These values never reach the browser. They are read lazily so a missing
 * value fails the request loudly instead of breaking the build.
 */

/** Validated server side auth configuration. */
export interface WebAuthEnv {
  /** Base URL the proxy forwards to, including `/api`. */
  apiInternalUrl: string;
  /** Shared secret sent to the API on every auth request. */
  proxySharedSecret: string;
  /** Public web origin, used for the Origin check. */
  webAppUrl: string;
}

let cached: WebAuthEnv | undefined;

/** Minimum secret length the API also enforces at startup. */
const MIN_PROXY_SECRET_LENGTH = 16;

/**
 * Values that still look like samples.
 *
 * Kept in step with the API's placeholder check so the web tier cannot start
 * with a secret the API would refuse.
 */
const PLACEHOLDER_PATTERN =
  /change[-_ ]?me|placeholder|your[-_ ]?(secret|key|value)|^\.+$/i;

/**
 * Reads and validates the server side auth variables.
 *
 * @returns Validated configuration with a trailing slash removed.
 */
export function getWebAuthEnv(): WebAuthEnv {
  if (cached) {
    return cached;
  }

  const isProduction = process.env.NODE_ENV === "production";
  const apiInternalUrl = requireUrl(
    "API_INTERNAL_URL",
    process.env["API_INTERNAL_URL"] ??
      (isProduction ? "" : "http://localhost:4000/api"),
  );
  const proxySharedSecret = process.env["PROXY_SHARED_SECRET"]?.trim();
  const webAppUrl = requireOrigin(
    "WEB_APP_URL",
    process.env["WEB_APP_URL"] ?? (isProduction ? "" : "http://localhost:3000"),
  );

  if (!proxySharedSecret) {
    throw new Error(
      "Missing PROXY_SHARED_SECRET. Set it in apps/web/.env.local to the same value as the API.",
    );
  }

  if (proxySharedSecret.length < MIN_PROXY_SECRET_LENGTH) {
    throw new Error(
      `PROXY_SHARED_SECRET must be at least ${String(MIN_PROXY_SECRET_LENGTH)} characters long. Use the same value as the API.`,
    );
  }

  if (PLACEHOLDER_PATTERN.test(proxySharedSecret)) {
    throw new Error(
      "PROXY_SHARED_SECRET is still set to a placeholder value. Use the same real secret as the API.",
    );
  }

  cached = { apiInternalUrl, proxySharedSecret, webAppUrl };
  return cached;
}

function requireUrl(name: string, value: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("protocol");
    }
    return value.replace(/\/$/, "");
  } catch {
    throw new Error(`${name} must be an absolute http(s) URL.`);
  }
}

/**
 * Validates a public origin and drops any path, query, or trailing slash.
 *
 * The Origin header is compared against this value, so `https://shop.test/`
 * and `https://shop.test/store` must both become `https://shop.test`.
 */
function requireOrigin(name: string, value: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("protocol");
    }
    return parsed.origin;
  } catch {
    throw new Error(`${name} must be an absolute http(s) URL.`);
  }
}
