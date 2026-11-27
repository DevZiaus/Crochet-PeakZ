import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import { cartQuoteBodySchema } from "@crochet-peakz/shared";
import type { ZodError } from "zod";
import type { CartQuoteDependencies } from "../../application/cart/dependencies.js";
import { quoteCart } from "../../application/cart/quote-cart.js";
import { createProxyGuard } from "../auth/proxy-guard.js";
import { createRateLimit } from "../auth/rate-limit.js";
import { AppError } from "../middleware/errorHandler.js";

/** Rate limit for public cart quotes (60 requests per minute per client IP). */
export const CART_QUOTE_RATE_LIMIT = {
  windowMs: 60_000,
  max: 60,
} as const;

/** Configuration for {@link createCartRouter}. */
export interface CartRouterOptions {
  /** Cart quote dependencies. */
  quote: CartQuoteDependencies;
  /** Shared secret proving requests came through the storefront proxy. */
  proxySharedSecret: string;
  /** Exact storefront origin accepted on state changing requests. */
  webAppUrl: string;
  /** Number of trusted reverse proxies before the API. */
  trustedProxyHops: number;
  /** Optional clock override for deterministic rate limit tests. */
  rateLimitNow?: () => number;
}

/**
 * Builds an `INVALID_CART` 400 error from a Zod validation failure.
 */
function toInvalidCartError(error: ZodError): AppError {
  return new AppError(400, "Invalid cart request.", {
    code: "INVALID_CART",
    details: {
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    },
  });
}

/**
 * Wraps an async Express cart route handler so rejections reach `errorHandler`.
 */
function asyncCartHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch((error: unknown) => {
      next(error);
    });
  };
}

/**
 * Creates the Express router mounted at `/api/cart`.
 *
 * Every cart route sits behind `createProxyGuard` (401 on missing or wrong
 * `x-proxy-secret`; 403 on write `Origin` mismatch).
 *
 * @param options Cart router options.
 * @returns Configured Express router.
 */
export function createCartRouter(options: CartRouterOptions): Router {
  const router = Router();

  router.use(
    createProxyGuard({
      sharedSecret: options.proxySharedSecret,
      webAppUrl: options.webAppUrl,
    }),
  );

  const quoteRateLimit = createRateLimit({
    windowMs: CART_QUOTE_RATE_LIMIT.windowMs,
    max: CART_QUOTE_RATE_LIMIT.max,
    ...(options.rateLimitNow ? { now: options.rateLimitNow } : {}),
    clientIp: {
      trustedHops: options.trustedProxyHops,
      proxySharedSecret: options.proxySharedSecret,
    },
  });

  router.post(
    "/quote",
    quoteRateLimit,
    asyncCartHandler(async (request, response) => {
      const parsed = cartQuoteBodySchema.safeParse(request.body);
      if (!parsed.success) {
        throw toInvalidCartError(parsed.error);
      }

      const result = await quoteCart(options.quote, parsed.data);
      response.json(result);
    }),
  );

  return router;
}
