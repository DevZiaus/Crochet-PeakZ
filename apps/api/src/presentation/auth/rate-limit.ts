import type { Request, RequestHandler } from "express";
import { AppError } from "../middleware/errorHandler.js";
import { type ClientIpOptions, getClientIp } from "../auth/proxy-guard.js";

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
  /** Optional clock override for deterministic tests. */
  now?: () => number;
  /**
   * Maximum distinct keys retained in memory before evicting the least
   * recently active entry. Defaults to 10,000.
   */
  maxKeys?: number;
  /**
   * Minimum interval in milliseconds between full expired-key sweeps when
   * `maxKeys` is exceeded. Defaults to 1,000.
   */
  pruneIntervalMs?: number;
  /** Client IP extraction options (trusted hop count and proxy secret). */
  clientIp?: ClientIpOptions;
}

/** Largest number of distinct keys retained in memory per limiter instance. */
const DEFAULT_MAX_KEYS = 10_000;
const DEFAULT_PRUNE_INTERVAL_MS = 1_000;

/**
 * Builds a fixed window, in-memory rate limiter.
 *
 * The spec accepts this tradeoff: limits reset on deploy and are per instance,
 * so a horizontally scaled API needs a shared store later. Every rejection
 * carries `Retry-After` in seconds.
 *
 * @param options Window, limit, and optional key builder or memory bounds.
 * @returns Express middleware.
 */
export function createRateLimit(options: RateLimitOptions): RequestHandler {
  const hits = new Map<string, number[]>();
  const keyFor = options.key ?? ((_req: Request, ip: string) => ip);
  const getNow = options.now ?? Date.now;
  const maxKeys = Math.max(1, options.maxKeys ?? DEFAULT_MAX_KEYS);
  const pruneIntervalMs = Math.max(
    0,
    options.pruneIntervalMs ?? DEFAULT_PRUNE_INTERVAL_MS,
  );
  let lastPruneAt = Number.NEGATIVE_INFINITY;

  function pruneAndEvict(now: number, currentKey: string): void {
    if (hits.size <= maxKeys) {
      return;
    }

    if (now - lastPruneAt >= pruneIntervalMs) {
      for (const [entryKey, timestamps] of hits) {
        if (
          timestamps.every((timestamp) => now - timestamp >= options.windowMs)
        ) {
          hits.delete(entryKey);
        }
      }
      lastPruneAt = now;
    }

    while (hits.size > maxKeys) {
      const oldestKey = hits.keys().next().value;
      if (oldestKey === undefined || oldestKey === currentKey) {
        break;
      }
      hits.delete(oldestKey);
    }
  }

  return (req, res, next) => {
    const now = getNow();
    const ip = getClientIp(req, options.clientIp) ?? "unknown";
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
      // Re-insert so actively rate-limited keys stay at the tail of LRU order.
      hits.delete(key);
      hits.set(key, recent);
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
    hits.delete(key);
    hits.set(key, recent);

    pruneAndEvict(now, key);

    next();
  };
}
