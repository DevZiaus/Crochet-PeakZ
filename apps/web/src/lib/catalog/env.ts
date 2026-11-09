/**
 * Server only catalog configuration.
 *
 * These values never reach the browser. They are read lazily so a missing
 * value fails the request loudly instead of breaking the build.
 */

/** Validated server side catalog configuration. */
export interface CatalogEnv {
  /** Base URL the server side catalog client calls, including `/api`. */
  apiInternalUrl: string;
  /** Public web origin, used for metadata and canonical URLs. */
  webAppUrl: string;
}

let cached: CatalogEnv | undefined;

/**
 * Reads and validates the server side catalog variables.
 *
 * @returns Validated configuration with a trailing slash removed.
 */
export function getCatalogEnv(): CatalogEnv {
  if (cached) {
    return cached;
  }

  const isProduction = process.env.NODE_ENV === "production";
  const apiInternalUrl = requireUrl(
    "API_INTERNAL_URL",
    process.env["API_INTERNAL_URL"] ??
      (isProduction ? "" : "http://localhost:4000/api"),
  );
  const webAppUrl = requireOrigin(
    "WEB_APP_URL",
    process.env["WEB_APP_URL"] ?? (isProduction ? "" : "http://localhost:3000"),
  );

  cached = { apiInternalUrl, webAppUrl };
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
