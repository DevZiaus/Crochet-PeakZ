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
  const webAppUrl = requireUrl(
    "WEB_APP_URL",
    process.env["WEB_APP_URL"] ?? (isProduction ? "" : "http://localhost:3000"),
  );

  if (!proxySharedSecret) {
    throw new Error(
      "Missing PROXY_SHARED_SECRET. Set it in apps/web/.env.local to the same value as the API.",
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
