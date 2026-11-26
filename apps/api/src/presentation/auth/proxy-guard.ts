import type { RequestHandler } from "express";
import { AppError } from "../middleware/errorHandler.js";
import { timingSafeStringEquals } from "./timing-safe.js";

/** Header the web proxy uses to prove it sent the request. */
export const PROXY_SECRET_HEADER = "x-proxy-secret";

/** Authenticated client IP header forwarded by the Next.js proxy. */
export const PROXY_CLIENT_IP_HEADER = "x-proxy-client-ip";

/** Options controlling how {@link getClientIp} resolves the caller address. */
export interface ClientIpOptions {
  /** Number of trusted reverse proxies appending to `X-Forwarded-For` before the API. Defaults to `1`. */
  trustedHops?: number;
  /** Shared secret authorizing `x-proxy-client-ip` from the Next.js proxy. */
  proxySharedSecret?: string;
}

/**
 * Rejects requests that did not come through the web proxy.
 *
 * The secret comparison is timing safe, including its length, so a caller
 * cannot time it to learn the secret or how long it is. After the secret
 * matches, every state changing request must also carry the configured web
 * origin, which blocks a cross site form post from riding the customer's
 * cookies.
 *
 * @param options Proxy shared secret and the one accepted web origin.
 * @returns Express middleware.
 */
export function createProxyGuard(options: {
  sharedSecret: string;
  webAppUrl: string;
}): RequestHandler {
  const expected = options.sharedSecret;

  return (req, _res, next) => {
    const provided = req.get(PROXY_SECRET_HEADER) ?? "";

    if (!timingSafeStringEquals(provided, expected)) {
      next(
        new AppError(
          401,
          "This endpoint is only available through the storefront.",
        ),
      );
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      const origin = req.get("origin");
      if (origin !== options.webAppUrl) {
        next(new AppError(403, "This request came from an untrusted origin."));
        return;
      }
    }

    next();
  };
}

/**
 * Returns the client IP the edge or web proxy forwarded.
 *
 * When a request proves it came from the Next.js proxy via `x-proxy-secret` and
 * carries `x-proxy-client-ip`, that authenticated visitor IP takes precedence so
 * intermediate server-to-server platform routers (for example Vercel to Render)
 * cannot shift the `X-Forwarded-For` hop count. Otherwise it reads the entry
 * `trustedHops` positions from the end of `X-Forwarded-For` (default `1`,
 * clamped to index `0` for single-entry requests). The raw API still trusts
 * these headers, so it must not be reachable directly past the trusted edge.
 *
 * @param req Express request.
 * @param options Optional hop count and proxy shared secret.
 * @returns An IP address, or null when no header is present.
 */
export function getClientIp(
  req: {
    get(name: string): string | undefined;
  },
  options?: ClientIpOptions,
): string | null {
  if (
    options?.proxySharedSecret &&
    timingSafeStringEquals(
      req.get(PROXY_SECRET_HEADER) ?? "",
      options.proxySharedSecret,
    )
  ) {
    const proxiedIp = req.get(PROXY_CLIENT_IP_HEADER)?.trim();
    if (proxiedIp && proxiedIp.length > 0) {
      return proxiedIp.slice(0, 45);
    }
  }

  const forwarded = req.get("x-forwarded-for");
  const entries = forwarded
    ?.split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (!entries || entries.length === 0) {
    return null;
  }

  const hops = Math.max(1, Math.trunc(options?.trustedHops ?? 1));
  const selected = entries[Math.max(0, entries.length - hops)];
  return selected ? selected.slice(0, 45) : null;
}
