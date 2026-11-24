/**
 * Tests for the shared secret guard on the auth routes (AC-14).
 *
 * The browser never talks to the API directly. The Next.js proxy adds a shared
 * secret header, and for a state changing call it also speaks for the web
 * origin so a cross site form post cannot ride a customer's cookies. These
 * tests lock in that a caller without the secret is refused, that a write from
 * a lookalike origin is refused, and that the forwarded client address is read
 * from the last header value added by the edge so a caller cannot pick its own
 * rate limit bucket.
 */
import type { NextFunction, Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { AppError } from "../middleware/errorHandler.js";
import { createProxyGuard, getClientIp } from "./proxy-guard.js";

const SHARED_SECRET = "proxy-secret-0123456789";
const WEB_APP_URL = "https://shop.example.com";

/** Builds a request stub whose `get` matches Express header lookup. */
function makeRequest(init: {
  method?: string;
  headers?: Record<string, string>;
}): Request {
  const headers = new Map(
    Object.entries(init.headers ?? {}).map(([name, value]) => [
      name.toLowerCase(),
      value,
    ]),
  );

  return {
    method: init.method ?? "GET",
    get: (name: string) => headers.get(name.toLowerCase()),
  } as unknown as Request;
}

/**
 * Runs the middleware once and resolves with whatever it passed to `next`.
 *
 * @param handler Middleware under test.
 * @param request Request stub.
 * @returns The error passed to `next`, or null when it continued.
 */
async function run(
  handler: ReturnType<typeof createProxyGuard>,
  request: Request,
): Promise<unknown> {
  return new Promise((resolve) => {
    const next = ((error?: unknown) => {
      resolve(error ?? null);
    }) as NextFunction;

    handler(request, {} as Response, next);
  });
}

const guard = createProxyGuard({
  sharedSecret: SHARED_SECRET,
  webAppUrl: WEB_APP_URL,
});

describe("createProxyGuard", () => {
  it("refuses a request that carries no proxy secret", async () => {
    const error = await run(guard, makeRequest({}));

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).statusCode).toBe(401);
  });

  it("refuses a request whose proxy secret is wrong", async () => {
    const error = await run(
      guard,
      makeRequest({ headers: { "x-proxy-secret": "proxy-secret-0123456788" } }),
    );

    expect((error as AppError).statusCode).toBe(401);
  });

  it("refuses a truncated proxy secret without crashing the comparison", async () => {
    // A length mismatch must be handled without throwing and without leaking
    // the secret's length through timing.
    const error = await run(
      guard,
      makeRequest({ headers: { "x-proxy-secret": "proxy" } }),
    );

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).statusCode).toBe(401);
  });

  it("continues a read when the secret matches", async () => {
    const error = await run(
      guard,
      makeRequest({ headers: { "x-proxy-secret": SHARED_SECRET } }),
    );

    expect(error).toBeNull();
  });

  it("allows a HEAD request without an origin", async () => {
    const error = await run(
      guard,
      makeRequest({
        method: "HEAD",
        headers: { "x-proxy-secret": SHARED_SECRET },
      }),
    );

    expect(error).toBeNull();
  });

  it("refuses a write whose origin is a different site", async () => {
    const error = await run(
      guard,
      makeRequest({
        method: "POST",
        headers: {
          "x-proxy-secret": SHARED_SECRET,
          origin: "https://evil.example",
        },
      }),
    );

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).statusCode).toBe(403);
  });

  it("refuses a write whose origin only looks like the web app", async () => {
    const error = await run(
      guard,
      makeRequest({
        method: "POST",
        headers: {
          "x-proxy-secret": SHARED_SECRET,
          origin: `${WEB_APP_URL}.evil.example`,
        },
      }),
    );

    expect((error as AppError).statusCode).toBe(403);
  });

  it("refuses a write that carries no origin at all", async () => {
    const error = await run(
      guard,
      makeRequest({
        method: "POST",
        headers: { "x-proxy-secret": SHARED_SECRET },
      }),
    );

    expect((error as AppError).statusCode).toBe(403);
  });

  it("continues a write that carries the configured origin", async () => {
    const error = await run(
      guard,
      makeRequest({
        method: "POST",
        headers: { "x-proxy-secret": SHARED_SECRET, origin: WEB_APP_URL },
      }),
    );

    expect(error).toBeNull();
  });
});

describe("getClientIp", () => {
  it("returns null when no forwarding header is present", () => {
    expect(getClientIp(makeRequest({}))).toBeNull();
  });

  it("uses only the last forwarded address added by the edge", () => {
    const request = makeRequest({
      headers: { "x-forwarded-for": "203.0.113.10, 198.51.100.7, 10.0.0.1" },
    });

    expect(getClientIp(request)).toBe("10.0.0.1");
  });

  it("trims the forwarded address", () => {
    const request = makeRequest({
      headers: { "x-forwarded-for": "   203.0.113.10  " },
    });

    expect(getClientIp(request)).toBe("203.0.113.10");
  });

  it("ignores empty leading or trailing entries and picks the last real address", () => {
    const leadingEmpty = makeRequest({
      headers: { "x-forwarded-for": " , 10.0.0.1" },
    });
    const trailingEmpty = makeRequest({
      headers: { "x-forwarded-for": "10.0.0.1,   " },
    });

    expect(getClientIp(leadingEmpty)).toBe("10.0.0.1");
    expect(getClientIp(trailingEmpty)).toBe("10.0.0.1");
  });

  it("returns null when every forwarded entry is blank", () => {
    const request = makeRequest({
      headers: { "x-forwarded-for": " ,   " },
    });

    expect(getClientIp(request)).toBeNull();
  });

  it("truncates an address to the column width", () => {
    const request = makeRequest({
      headers: { "x-forwarded-for": "a".repeat(80) },
    });

    expect(getClientIp(request)).toHaveLength(45);
  });

  it("picks the Nth hop from the end when trustedHops is configured for a CDN chain", () => {
    const cdnChain = makeRequest({
      headers: { "x-forwarded-for": "9.9.9.9, 203.0.113.10, 172.70.1.1" },
    });
    const twoEntryChain = makeRequest({
      headers: { "x-forwarded-for": "203.0.113.10, 172.70.1.1" },
    });
    const singleEntry = makeRequest({
      headers: { "x-forwarded-for": "203.0.113.10" },
    });

    expect(getClientIp(cdnChain, { trustedHops: 2 })).toBe("203.0.113.10");
    expect(getClientIp(twoEntryChain, { trustedHops: 2 })).toBe("203.0.113.10");
    expect(getClientIp(singleEntry, { trustedHops: 2 })).toBe("203.0.113.10");
  });

  it("trusts x-proxy-client-ip only when x-proxy-secret matches", () => {
    const authenticated = makeRequest({
      headers: {
        "x-proxy-secret": SHARED_SECRET,
        "x-proxy-client-ip": `  ${"203.0.113.42".padEnd(60, "0")}  `,
        "x-forwarded-for": "203.0.113.42, 76.76.21.1, 172.70.2.2",
      },
    });
    const unauthenticated = makeRequest({
      headers: {
        "x-proxy-client-ip": "1.2.3.4",
        "x-forwarded-for": "203.0.113.42, 172.70.2.2",
      },
    });
    const wrongSecret = makeRequest({
      headers: {
        "x-proxy-secret": "wrong-secret-01234567",
        "x-proxy-client-ip": "1.2.3.4",
        "x-forwarded-for": "203.0.113.42, 172.70.2.2",
      },
    });

    const opts = { trustedHops: 2, proxySharedSecret: SHARED_SECRET };
    expect(getClientIp(authenticated, opts)).toHaveLength(45);
    expect(getClientIp(authenticated, opts)).toMatch(/^203\.0\.113\.42/);
    expect(getClientIp(unauthenticated, opts)).toBe("203.0.113.42");
    expect(getClientIp(wrongSecret, opts)).toBe("203.0.113.42");
  });
});
