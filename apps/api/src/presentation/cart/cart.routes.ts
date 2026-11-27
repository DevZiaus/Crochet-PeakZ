import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import {
  cartAddItemBodySchema,
  cartMergeBodySchema,
  cartQuoteBodySchema,
  cartUpdateItemBodySchema,
  cartVariantParamSchema,
} from "@crochet-peakz/shared";
import type { ZodError } from "zod";
import {
  addItem,
  clearCart,
  getCart,
  mergeCart,
  removeItem,
  setItemQuantity,
} from "../../application/cart/account-cart.js";
import type {
  AccountCartDependencies,
  CartQuoteDependencies,
} from "../../application/cart/dependencies.js";
import { CartError } from "../../application/cart/errors.js";
import { quoteCart } from "../../application/cart/quote-cart.js";
import type { TokenService } from "../../domain/ports/token-service.js";
import { createRequireAuth } from "../auth/auth-middleware.js";
import { createProxyGuard } from "../auth/proxy-guard.js";
import { createRateLimit } from "../auth/rate-limit.js";
import { AppError } from "../middleware/errorHandler.js";

/** Rate limit for public cart quotes (60 requests per minute per client IP). */
export const CART_QUOTE_RATE_LIMIT = {
  windowMs: 60_000,
  max: 60,
} as const;

/** Rate limit for `GET /api/cart` (120 requests per minute per signed in user). */
export const CART_READ_RATE_LIMIT = {
  windowMs: 60_000,
  max: 120,
} as const;

/** Shared rate limit for all signed in cart writes (120 requests per minute per user). */
export const CART_WRITE_RATE_LIMIT = {
  windowMs: 60_000,
  max: 120,
} as const;

/** Configuration for {@link createCartRouter}. */
export interface CartRouterOptions {
  /** Cart quote dependencies. */
  quote: CartQuoteDependencies;
  /** Optional signed in account cart dependencies + JWT verifier. */
  account?: AccountCartDependencies;
  /** Access token verifier powering `createRequireAuth` on account routes. */
  tokens?: TokenService;
  /** Shared secret proving requests came through the storefront proxy. */
  proxySharedSecret: string;
  /** Exact storefront origin accepted on state changing requests. */
  webAppUrl: string;
  /** Number of trusted reverse proxies before the API. */
  trustedProxyHops: number;
  /** Optional clock override for deterministic rate limit tests. */
  rateLimitNow?: () => number;
}

/** Builds an `INVALID_CART` 400 error from a Zod validation failure. */
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

/** Reads the authenticated user id attached by `createRequireAuth`. */
function requireAuthUserId(req: Request): string {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError(401, "Sign in to continue.");
  }
  return userId;
}

/**
 * Wraps an async Express cart handler, mapping `CartError` onto the spec HTTP
 * statuses and envelopes (including 409 `ITEM_UNAVAILABLE` with fresh `data`).
 */
function asyncCartHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch((error: unknown) => {
      if (error instanceof CartError) {
        if (error.code === "ITEM_UNAVAILABLE") {
          res.status(409).json({
            error: {
              message: error.message,
              statusCode: 409,
              code: "ITEM_UNAVAILABLE",
            },
            ...(error.cartData !== undefined ? { data: error.cartData } : {}),
          });
          return;
        }
        if (error.code === "NOT_IN_CART") {
          next(new AppError(404, error.message, { code: "NOT_IN_CART" }));
          return;
        }
        next(new AppError(401, error.message, { code: "INVALID_SESSION" }));
        return;
      }

      next(error);
    });
  };
}

/**
 * Creates the Express router mounted at `/api/cart`.
 *
 * Every cart route sits behind `createProxyGuard` (401 on missing or wrong
 * `x-proxy-secret`; 403 on write `Origin` mismatch). Account routes sit behind
 * `createRequireAuth` and per user rate limits.
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

  const clientIpOptions = {
    trustedHops: options.trustedProxyHops,
    proxySharedSecret: options.proxySharedSecret,
  };

  const quoteRateLimit = createRateLimit({
    windowMs: CART_QUOTE_RATE_LIMIT.windowMs,
    max: CART_QUOTE_RATE_LIMIT.max,
    ...(options.rateLimitNow ? { now: options.rateLimitNow } : {}),
    clientIp: clientIpOptions,
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

  if (options.account && options.tokens) {
    const accountDeps = options.account;
    const requireAuth = createRequireAuth(options.tokens);

    const readRateLimit = createRateLimit({
      windowMs: CART_READ_RATE_LIMIT.windowMs,
      max: CART_READ_RATE_LIMIT.max,
      ...(options.rateLimitNow ? { now: options.rateLimitNow } : {}),
      key: (req) => (req.auth?.userId ? `cart:read:${req.auth.userId}` : null),
      clientIp: clientIpOptions,
    });

    const writeRateLimit = createRateLimit({
      windowMs: CART_WRITE_RATE_LIMIT.windowMs,
      max: CART_WRITE_RATE_LIMIT.max,
      ...(options.rateLimitNow ? { now: options.rateLimitNow } : {}),
      key: (req) => (req.auth?.userId ? `cart:write:${req.auth.userId}` : null),
      clientIp: clientIpOptions,
    });

    router.get(
      "/",
      requireAuth,
      readRateLimit,
      asyncCartHandler(async (request, response) => {
        const userId = requireAuthUserId(request);
        const result = await getCart(accountDeps, userId);
        response.json(result);
      }),
    );

    router.post(
      "/items",
      requireAuth,
      writeRateLimit,
      asyncCartHandler(async (request, response) => {
        const userId = requireAuthUserId(request);
        const parsed = cartAddItemBodySchema.safeParse(request.body);
        if (!parsed.success) {
          throw toInvalidCartError(parsed.error);
        }

        const result = await addItem(accountDeps, userId, parsed.data);
        response.json(result);
      }),
    );

    router.patch(
      "/items/:variantId",
      requireAuth,
      writeRateLimit,
      asyncCartHandler(async (request, response) => {
        const userId = requireAuthUserId(request);
        const params = cartVariantParamSchema.safeParse(request.params);
        if (!params.success) {
          throw toInvalidCartError(params.error);
        }

        const body = cartUpdateItemBodySchema.safeParse(request.body);
        if (!body.success) {
          throw toInvalidCartError(body.error);
        }

        const result = await setItemQuantity(
          accountDeps,
          userId,
          params.data.variantId,
          body.data,
        );
        response.json(result);
      }),
    );

    router.delete(
      "/items/:variantId",
      requireAuth,
      writeRateLimit,
      asyncCartHandler(async (request, response) => {
        const userId = requireAuthUserId(request);
        const params = cartVariantParamSchema.safeParse(request.params);
        if (!params.success) {
          throw toInvalidCartError(params.error);
        }

        const result = await removeItem(
          accountDeps,
          userId,
          params.data.variantId,
        );
        response.json(result);
      }),
    );

    router.delete(
      "/",
      requireAuth,
      writeRateLimit,
      asyncCartHandler(async (request, response) => {
        const userId = requireAuthUserId(request);
        const result = await clearCart(accountDeps, userId);
        response.json(result);
      }),
    );

    router.post(
      "/merge",
      requireAuth,
      writeRateLimit,
      asyncCartHandler(async (request, response) => {
        const userId = requireAuthUserId(request);
        const parsed = cartMergeBodySchema.safeParse(request.body);
        if (!parsed.success) {
          throw toInvalidCartError(parsed.error);
        }

        const result = await mergeCart(accountDeps, userId, parsed.data);
        response.json(result);
      }),
    );
  }

  return router;
}
