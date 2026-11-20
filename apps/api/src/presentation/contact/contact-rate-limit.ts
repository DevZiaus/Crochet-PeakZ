/** Options configuring the contact submission rate limiter. */
export interface ContactRateLimiterOptions {
  /** Window duration in milliseconds. */
  windowMs: number;
  /** Maximum submissions permitted inside one window per key. */
  max: number;
  /** Optional clock override for deterministic tests. */
  now?: () => number;
}

/** Decision returned when consuming one contact rate-limit slot. */
export type ContactRateLimitResult =
  { allowed: true } | { allowed: false; retryAfterSeconds: number };

/** Fixed-window in-memory rate limiter with rollback on delivery failure. */
export interface ContactRateLimiter {
  /** Records a request for `key`, or denies it with a retry delay when full. */
  consume(key: string): ContactRateLimitResult;
  /** Releases the most recent slot consumed for `key` after an upstream failure. */
  release(key: string): void;
}

const PRUNE_THRESHOLD = 10_000;

/**
 * Creates a fixed-window, in-memory rate limiter for contact submissions.
 *
 * @param options Window duration, maximum hits, and optional clock.
 * @returns {@link ContactRateLimiter} instance.
 */
export function createContactRateLimiter(
  options: ContactRateLimiterOptions,
): ContactRateLimiter {
  const hits = new Map<string, number[]>();
  const getNow = options.now ?? Date.now;

  return {
    consume(key: string): ContactRateLimitResult {
      const now = getNow();
      const recent = (hits.get(key) ?? []).filter(
        (timestamp) => now - timestamp < options.windowMs,
      );

      if (recent.length >= options.max) {
        const oldest = recent[0] ?? now;
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((options.windowMs - (now - oldest)) / 1000),
        );
        hits.set(key, recent);
        return { allowed: false, retryAfterSeconds };
      }

      recent.push(now);
      hits.set(key, recent);

      if (hits.size > PRUNE_THRESHOLD) {
        for (const [entryKey, timestamps] of hits) {
          if (
            timestamps.every((timestamp) => now - timestamp >= options.windowMs)
          ) {
            hits.delete(entryKey);
          }
        }
      }

      return { allowed: true };
    },

    release(key: string): void {
      const timestamps = hits.get(key);
      if (!timestamps || timestamps.length === 0) {
        return;
      }

      timestamps.pop();
      if (timestamps.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, timestamps);
      }
    },
  };
}
