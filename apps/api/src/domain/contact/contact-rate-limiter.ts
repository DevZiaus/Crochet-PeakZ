/** Decision returned when consuming one contact rate-limit slot. */
export type ContactRateLimitResult =
  | { allowed: true; release: () => void }
  | { allowed: false; retryAfterSeconds: number };

/** Rate limiter port for throttling contact form submissions per client key. */
export interface ContactRateLimiter {
  /**
   * Attempts to consume one slot for `key`.
   *
   * When allowed, the returned `release` handle rolls back only that specific
   * slot so an upstream delivery failure does not penalize the caller.
   */
  consume(key: string): ContactRateLimitResult;
}
