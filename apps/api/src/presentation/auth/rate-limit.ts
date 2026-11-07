import type { Request, RequestHandler } from "express";
import { AppError } from "../middleware/errorHandler.js";
import { getClientIp } from "../auth/proxy-guard.js";

/** One in-memory rate limit rule. */
export interface RateLimitOptions {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Maximum requests allowed inside the window. */
  max: number;
  /**
   * Key builder. Defaults to the forwarded client IP. Return null to skip
   * limiting a request that has nothing safe to key on.
   */
  key?: (req: Request, ip: string) => string | null;
}

/** Largest number of distinct keys kept before stale entries are pruned. */
const PRUNE_THRESHOLD = 10_000;

/**
 * Builds a fixed window, in-memory rate limiter.
 *
 * The spec accepts this tradeoff: limits reset on deploy and are per instance,
 * so a horizontally scaled API needs a shared store later. Every rejection
 * carries `Retry-After` in seconds.
 *
 * @param options Window, limit, and optional key builder.
 * @returns Express middleware.
 */
export function createRateLimit(options: RateLimitOptions): RequestHandler {
  const hits = new Map<string, number[]>();
  const keyFor = options.key ?? ((_req: Request, ip: string) => ip);

  return (req, res, next) => {
    const now = Date.now();
    const ip = getClientIp(req) ?? "unknown";
    const key = keyFor(req, ip);

    if (key === null) {
      next();
      return;
    }

    const recent = (hits.get(key) ?? []).filter(
      (timestamp) => now - timestamp < options.windowMs,
    );

    if (recent.length >= options.max) {
      const oldest = recent[0] ?? now;
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((options.windowMs - (now - oldest)) / 1000),
      );
      res.setHeader("Retry-After", String(retryAfterSeconds));
      next(
        new AppError(429, "Too many requests. Please try again later.", {
          code: "RATE_LIMITED",
          details: { retryAfterSeconds },
        }),
      );
      return;
    }

    recent.push(now);
    hits.set(key, recent);

    // Pruning drops only fully stale keys, so a sustained burst of unique keys
    // keeps the map at up to PRUNE_THRESHOLD live entries for a whole window.
    // Bounded, and every entry is dropped once its own window passes.
    if (hits.size > PRUNE_THRESHOLD) {
      for (const [entryKey, timestamps] of hits) {
        if (
          timestamps.every((timestamp) => now - timestamp >= options.windowMs)
        ) {
          hits.delete(entryKey);
        }
      }
    }

    next();
  };
}
