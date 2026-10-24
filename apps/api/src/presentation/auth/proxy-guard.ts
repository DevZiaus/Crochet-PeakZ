import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { AppError } from "../middleware/errorHandler.js";

/** Header the web proxy uses to prove it sent the request. */
export const PROXY_SECRET_HEADER = "x-proxy-secret";

/**
 * Rejects requests that did not come through the web proxy.
 *
 * The secret comparison is timing safe. After the secret matches, every state
 * changing request must also carry the configured web origin, which blocks a
 * cross site form post from riding the customer's cookies.
 *
 * @param options Proxy shared secret and the one accepted web origin.
 * @returns Express middleware.
 */
export function createProxyGuard(options: {
  sharedSecret: string;
  webAppUrl: string;
}): RequestHandler {
  const expected = Buffer.from(options.sharedSecret);

  return (req, _res, next) => {
    const provided = req.get(PROXY_SECRET_HEADER) ?? "";
    const given = Buffer.from(provided);

    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
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
 * Returns the client IP the proxy forwarded.
 *
 * The proxy overwrites `X-Forwarded-For` with the socket peer address, so the
 * first value is the only one the API honours.
 *
 * @param req Express request.
 * @returns An IP address, or null when no header is present.
 */
export function getClientIp(req: {
  get(name: string): string | undefined;
}): string | null {
  const forwarded = req.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first && first.length > 0 ? first.slice(0, 45) : null;
}
