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

  it("prunes expired keys after the prune interval and caps live keys at maxKeys", () => {
    let nowMs = 1_000_000;
    const limiter = createContactRateLimiter({
      windowMs: 60_000,
      max: 2,
      now: () => nowMs,
      maxKeys: 3,
      pruneIntervalMs: 1_000,
    });

    // Two keys expire before the next burst arrives.
    expect(limiter.consume("expired-1").allowed).toBe(true);
    expect(limiter.consume("expired-1").allowed).toBe(true);
    expect(limiter.consume("expired-2").allowed).toBe(true);

    nowMs += 61_000;
    expect(limiter.consume("live-1").allowed).toBe(true);
    expect(limiter.consume("live-1").allowed).toBe(true);
    expect(limiter.consume("live-2").allowed).toBe(true);
    expect(limiter.consume("live-2").allowed).toBe(true);

    // Pruning expired-1 and expired-2 leaves only live-1 and live-2 intact.
    expect(limiter.consume("live-1").allowed).toBe(false);
    expect(limiter.consume("live-2").allowed).toBe(false);

    // Fill up to maxKeys (3) and add a 4th key inside pruneIntervalMs:
    // the least recently active live key (live-1) is evicted to stay bounded.
    expect(limiter.consume("live-3").allowed).toBe(true);
    expect(limiter.consume("live-3").allowed).toBe(true);
    expect(limiter.consume("live-4").allowed).toBe(true);

    expect(limiter.consume("live-2").allowed).toBe(false);
    expect(limiter.consume("live-3").allowed).toBe(false);
    expect(limiter.consume("live-1").allowed).toBe(true);
  });

  it("keeps actively rate-limited keys fresh when evicting older idle keys past maxKeys", () => {
    let nowMs = 1_000_000;
    const limiter = createContactRateLimiter({
      windowMs: 60_000,
      max: 2,
      now: () => nowMs,
      maxKeys: 3,
      pruneIntervalMs: 1_000,
    });

    expect(limiter.consume("active").allowed).toBe(true);
    expect(limiter.consume("active").allowed).toBe(true);
    expect(limiter.consume("idle-1").allowed).toBe(true);
    expect(limiter.consume("idle-2").allowed).toBe(true);

    // Denied hit must refresh "active" in LRU order so "idle-1" is evicted next.
    nowMs += 500;
    expect(limiter.consume("active")).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });

    expect(limiter.consume("new-key").allowed).toBe(true);
    expect(limiter.consume("active")).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
    expect(limiter.consume("idle-2").allowed).toBe(true);
    expect(limiter.consume("idle-2").allowed).toBe(false);

    // idle-1 was evicted so it gets a full fresh allowance.
    expect(limiter.consume("idle-1").allowed).toBe(true);
    expect(limiter.consume("idle-1").allowed).toBe(true);
  });

  it("bounds memory past the default 10,000-key threshold and sweeps expired keys after the window", () => {
    let nowMs = 1_000_000;
    const limiter = createContactRateLimiter({
      windowMs: 60_000,
      max: 2,
      now: () => nowMs,
    });

    expect(limiter.consume("saturated-old").allowed).toBe(true);
    expect(limiter.consume("saturated-old").allowed).toBe(true);

    for (let index = 0; index < 10_005; index += 1) {
      expect(limiter.consume(`192.0.2.${String(index)}`).allowed).toBe(true);
    }

    // Oldest live key was evicted once the default 10,000-key cap was exceeded.
    expect(limiter.consume("saturated-old").allowed).toBe(true);

    nowMs += 65_000;
    expect(limiter.consume("post-window").allowed).toBe(true);
    expect(limiter.consume("post-window").allowed).toBe(true);
    expect(limiter.consume("post-window").allowed).toBe(false);
  });
});
