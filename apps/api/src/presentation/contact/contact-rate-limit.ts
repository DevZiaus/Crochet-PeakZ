import type {
  ContactRateLimitResult,
  ContactRateLimiter,
} from "../../domain/contact/contact-rate-limiter.js";

export type { ContactRateLimitResult, ContactRateLimiter };

/** Options configuring the contact submission rate limiter. */
export interface ContactRateLimiterOptions {
  /** Window duration in milliseconds. */
  windowMs: number;
  /** Maximum submissions permitted inside one window per key. */
  max: number;
  /** Optional clock override for deterministic tests. */
  now?: () => number;
}

interface RateLimitSlot {
  id: number;
  timestamp: number;
}

const PRUNE_THRESHOLD = 10_000;

/**
 * Creates a fixed-window, in-memory rate limiter for contact submissions.
 *
 * Each accepted call receives an idempotent `release()` handle bound to its own
 * slot id so concurrent failures never pop another request's entry.
 *
 * @param options Window duration, maximum hits, and optional clock.
 * @returns {@link ContactRateLimiter} instance.
 */
export function createContactRateLimiter(
  options: ContactRateLimiterOptions,
): ContactRateLimiter {
  const hits = new Map<string, RateLimitSlot[]>();
  const getNow = options.now ?? Date.now;
  let nextSlotId = 0;

  return {
    consume(key: string): ContactRateLimitResult {
      const now = getNow();
      const recent = (hits.get(key) ?? []).filter(
        (slot) => now - slot.timestamp < options.windowMs,
      );

      if (recent.length >= options.max) {
        const oldest = recent[0]?.timestamp ?? now;
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((options.windowMs - (now - oldest)) / 1000),
        );
        hits.set(key, recent);
        return { allowed: false, retryAfterSeconds };
      }

      nextSlotId += 1;
      const slotId = nextSlotId;
      recent.push({ id: slotId, timestamp: now });
      hits.set(key, recent);

      if (hits.size > PRUNE_THRESHOLD) {
        for (const [entryKey, slots] of hits) {
          if (slots.every((slot) => now - slot.timestamp >= options.windowMs)) {
            hits.delete(entryKey);
          }
        }
      }

      let released = false;
      const release = (): void => {
        if (released) {
          return;
        }
        released = true;

        const slots = hits.get(key);
        if (!slots) {
          return;
        }

        const remaining = slots.filter((slot) => slot.id !== slotId);
        if (remaining.length === 0) {
          hits.delete(key);
        } else {
          hits.set(key, remaining);
        }
      };

      return { allowed: true, release };
    },
  };
}
