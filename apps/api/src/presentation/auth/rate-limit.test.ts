import type { NextFunction, Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { AppError } from "../middleware/errorHandler.js";
import { createRateLimit } from "./rate-limit.js";

function makeRequest(ip: string): Request {
  const headers = new Map([["x-forwarded-for", ip]]);
  return {
    get: (name: string) => headers.get(name.toLowerCase()),
  } as unknown as Request;
}

async function runLimiter(
  middleware: ReturnType<typeof createRateLimit>,
  ip: string,
): Promise<{ error: unknown; retryAfter: string | undefined }> {
  const responseHeaders = new Map<string, string>();
  const res = {
    setHeader: (name: string, value: string) => {
      responseHeaders.set(name.toLowerCase(), value);
    },
  } as unknown as Response;

  const error = await new Promise<unknown>((resolve) => {
    const next = ((err?: unknown) => {
      resolve(err ?? null);
    }) as NextFunction;
    middleware(makeRequest(ip), res, next);
  });

  return {
    error,
    retryAfter: responseHeaders.get("retry-after"),
  };
}

describe("createRateLimit", () => {
  it("enforces max hits per window and sets Retry-After on 429", async () => {
    let nowMs = 1_000_000;
    const limiter = createRateLimit({
      windowMs: 60_000,
      max: 2,
      now: () => nowMs,
    });

    expect((await runLimiter(limiter, "203.0.113.10")).error).toBeNull();
    nowMs += 10_000;
    expect((await runLimiter(limiter, "203.0.113.10")).error).toBeNull();

    nowMs += 5_000;
    const denied = await runLimiter(limiter, "203.0.113.10");
    expect(denied.error).toBeInstanceOf(AppError);
    expect((denied.error as AppError).statusCode).toBe(429);
    expect(denied.retryAfter).toBe("45");

    nowMs = 1_060_000;
    expect((await runLimiter(limiter, "203.0.113.10")).error).toBeNull();
  });

  it("prunes expired keys after the prune interval and caps live keys at maxKeys", async () => {
    let nowMs = 1_000_000;
    const limiter = createRateLimit({
      windowMs: 60_000,
      max: 2,
      now: () => nowMs,
      maxKeys: 3,
      pruneIntervalMs: 1_000,
    });

    expect((await runLimiter(limiter, "expired-1")).error).toBeNull();
    expect((await runLimiter(limiter, "expired-1")).error).toBeNull();
    expect((await runLimiter(limiter, "expired-2")).error).toBeNull();

    nowMs += 61_000;
    expect((await runLimiter(limiter, "live-1")).error).toBeNull();
    expect((await runLimiter(limiter, "live-1")).error).toBeNull();
    expect((await runLimiter(limiter, "live-2")).error).toBeNull();
    expect((await runLimiter(limiter, "live-2")).error).toBeNull();

    expect((await runLimiter(limiter, "live-1")).error).toBeInstanceOf(
      AppError,
    );
    expect((await runLimiter(limiter, "live-2")).error).toBeInstanceOf(
      AppError,
    );

    expect((await runLimiter(limiter, "live-3")).error).toBeNull();
    expect((await runLimiter(limiter, "live-3")).error).toBeNull();
    expect((await runLimiter(limiter, "live-4")).error).toBeNull();

    expect((await runLimiter(limiter, "live-2")).error).toBeInstanceOf(
      AppError,
    );
    expect((await runLimiter(limiter, "live-3")).error).toBeInstanceOf(
      AppError,
    );
    expect((await runLimiter(limiter, "live-1")).error).toBeNull();
  });

  it("keeps actively rate-limited keys fresh when evicting older idle keys past maxKeys", async () => {
    let nowMs = 1_000_000;
    const limiter = createRateLimit({
      windowMs: 60_000,
      max: 2,
      now: () => nowMs,
      maxKeys: 3,
      pruneIntervalMs: 1_000,
    });

    expect((await runLimiter(limiter, "active")).error).toBeNull();
    expect((await runLimiter(limiter, "active")).error).toBeNull();
    expect((await runLimiter(limiter, "idle-1")).error).toBeNull();
    expect((await runLimiter(limiter, "idle-2")).error).toBeNull();

    nowMs += 500;
    expect((await runLimiter(limiter, "active")).error).toBeInstanceOf(
      AppError,
    );

    expect((await runLimiter(limiter, "new-key")).error).toBeNull();
    expect((await runLimiter(limiter, "active")).error).toBeInstanceOf(
      AppError,
    );
    expect((await runLimiter(limiter, "idle-2")).error).toBeNull();
    expect((await runLimiter(limiter, "idle-2")).error).toBeInstanceOf(
      AppError,
    );

    expect((await runLimiter(limiter, "idle-1")).error).toBeNull();
    expect((await runLimiter(limiter, "idle-1")).error).toBeNull();
  });
});
