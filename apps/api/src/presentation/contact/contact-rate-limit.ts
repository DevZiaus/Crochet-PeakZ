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
}

interface RateLimitSlot {
  id: number;
  timestamp: number;
}

const DEFAULT_MAX_KEYS = 10_000;
const DEFAULT_PRUNE_INTERVAL_MS = 1_000;

/**
 * Creates a fixed-window, in-memory rate limiter for contact submissions.
 *
 * Each accepted call receives an idempotent `release()` handle bound to its own
 * slot id so concurrent failures never pop another request's entry.
 *
 * @param options Window duration, maximum hits, and optional limits/clock.
 * @returns {@link ContactRateLimiter} instance.
 */
export function createContactRateLimiter(
  options: ContactRateLimiterOptions,
): ContactRateLimiter {
  const hits = new Map<string, RateLimitSlot[]>();
  const getNow = options.now ?? Date.now;
  const maxKeys = Math.max(1, options.maxKeys ?? DEFAULT_MAX_KEYS);
  const pruneIntervalMs = Math.max(
    0,
    options.pruneIntervalMs ?? DEFAULT_PRUNE_INTERVAL_MS,
  );
  let lastPruneAt = Number.NEGATIVE_INFINITY;
  let nextSlotId = 0;

  function pruneAndEvict(now: number, currentKey: string): void {
    if (hits.size <= maxKeys) {
      return;
    }

    if (now - lastPruneAt >= pruneIntervalMs) {
      for (const [entryKey, slots] of hits) {
        if (slots.every((slot) => now - slot.timestamp >= options.windowMs)) {
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
        // Re-insert so actively rate-limited keys stay at the tail of LRU order.
        hits.delete(key);
        hits.set(key, recent);
        return { allowed: false, retryAfterSeconds };
      }

      nextSlotId += 1;
      const slotId = nextSlotId;
      recent.push({ id: slotId, timestamp: now });
      hits.delete(key);
      hits.set(key, recent);

      pruneAndEvict(now, key);

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
