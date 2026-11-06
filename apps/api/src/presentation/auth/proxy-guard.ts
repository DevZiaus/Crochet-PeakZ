import type { RequestHandler } from "express";
import { AppError } from "../middleware/errorHandler.js";
import { timingSafeStringEquals } from "./timing-safe.js";

/** Header the web proxy uses to prove it sent the request. */
export const PROXY_SECRET_HEADER = "x-proxy-secret";

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
 * Returns the client IP the proxy forwarded.
 *
 * The web proxy selects the last hop added by the trusted edge and sends that
 * single value, so the first entry here is the one it chose. The raw API still
 * trusts this header, so it must not be reachable from untrusted networks. This
 * assumes exactly one trusted edge in front of the web app.
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
