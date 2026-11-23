import { describe, expect, it } from "vitest";
import { createContactRateLimiter } from "./contact-rate-limit.js";

describe("createContactRateLimiter", () => {
  it("enforces max hits per window, reports Retry-After, and resets after expiry", () => {
    let nowMs = 1_000_000;
    const limiter = createContactRateLimiter({
      windowMs: 60_000,
      max: 2,
      now: () => nowMs,
    });

    expect(limiter.consume("203.0.113.10").allowed).toBe(true);
    nowMs += 10_000;
    expect(limiter.consume("203.0.113.10").allowed).toBe(true);

    nowMs += 5_000;
    const denied = limiter.consume("203.0.113.10");
    expect(denied).toEqual({ allowed: false, retryAfterSeconds: 45 });

    // Separate key has its own independent bucket.
    expect(limiter.consume("203.0.113.11").allowed).toBe(true);

    // Advance past the first hit (60s from t=1_000_000) while second hit stays active.
    nowMs = 1_060_000;
    expect(limiter.consume("203.0.113.10").allowed).toBe(true);
  });

  it("releases only its own slot under concurrent interleaving and is idempotent", () => {
    let nowMs = 1_000_000;
    const limiter = createContactRateLimiter({
      windowMs: 60_000,
      max: 2,
      now: () => nowMs,
    });

    const slotA = limiter.consume("198.51.100.1");
    expect(slotA.allowed).toBe(true);

    nowMs += 5_000;
    const slotB = limiter.consume("198.51.100.1");
    expect(slotB.allowed).toBe(true);

    // Request A fails delivery while Request B has already acquired a newer slot.
    // Releasing A must remove A's t=0 entry and leave B's t=5000 entry intact.
    if (slotA.allowed) {
      slotA.release();
      // Calling release twice on A must not remove B's slot.
      slotA.release();
    }

    const slotC = limiter.consume("198.51.100.1");
    expect(slotC.allowed).toBe(true);

    nowMs += 5_000;
    const denied = limiter.consume("198.51.100.1");
    expect(denied).toEqual({ allowed: false, retryAfterSeconds: 55 });
  });
});
