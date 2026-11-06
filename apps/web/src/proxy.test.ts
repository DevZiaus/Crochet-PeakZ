// @vitest-environment node
/**
 * Tests for the request proxy that guards the admin area (AC-10, AC-13).
 *
 * The admin check has to happen before the route renders. A server layout that
 * redirects is too late, because Next renders the page alongside the layout and
 * the admin markup is already in the payload. These tests lock in the decision
 * the proxy makes, and the noindex header the six auth screens depend on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

process.env.API_INTERNAL_URL = "http://api.test/api";
process.env.PROXY_SHARED_SECRET = "test-secret";
process.env.WEB_APP_URL = "http://web.test";

interface FetchCall {
  url: string;
  init?: RequestInit;
}

const calls: FetchCall[] = [];

/**
 * Answers `/auth/me` the way the API would for a given caller.
 *
 * The proxy reads only the role from the body, so a minimal payload is enough.
 */
const fetchMock = vi.fn(
  (input: RequestInfo | URL, init?: RequestInit): Response => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    calls.push({ url, init });

    const cookie = new Headers(init?.headers).get("cookie") ?? "";

    if (url.endsWith("/auth/refresh")) {
      const headers = new Headers();

      if (cookie.includes("cp_refresh=dead-refresh")) {
        headers.append(
          "set-cookie",
          "cp_access=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax",
        );
        headers.append(
          "set-cookie",
          "cp_refresh=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax",
        );
        return new Response(
          JSON.stringify({
            error: { message: "Session expired.", statusCode: 401 },
          }),
          { status: 401, headers },
        );
      }

      const access = cookie.includes("cp_refresh=customer-refresh")
        ? "customer-token"
        : "admin-token";
      headers.append(
        "set-cookie",
        `cp_access=${access}; Max-Age=900; Path=/; HttpOnly; SameSite=Lax`,
      );
      headers.append(
        "set-cookie",
        "cp_refresh=new-refresh; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax",
      );
      return new Response(JSON.stringify({ id: "user-1" }), {
        status: 200,
        headers,
      });
    }

    if (cookie.includes("cp_access=admin-token")) {
      return new Response(JSON.stringify({ role: "ADMIN" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (cookie.includes("cp_access=customer-token")) {
      return new Response(JSON.stringify({ role: "CUSTOMER" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        error: { message: "Sign in to continue.", statusCode: 401 },
      }),
      { status: 401, headers: { "content-type": "application/json" } },
    );
  },
);

import { proxy } from "./proxy";

beforeEach(() => {
  calls.length = 0;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Builds an incoming request for a path with optional cookies and headers. */
function request(
  path: string,
  cookie?: string,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(`http://web.test${path}`, {
    headers: cookie ? { cookie, ...headers } : headers,
  });
}

/** The path a redirect response points at, relative to the web origin. */
function redirectTarget(response: Response): string {
  const location = response.headers.get("location");
  if (!location) {
    throw new Error("Expected a redirect, but no Location header was set.");
  }
  const url = new URL(location);
  return `${url.pathname}${url.search}`;
}

describe("admin guard", () => {
  it("sends an anonymous caller to sign in and keeps the admin path as next", async () => {
    const response = await proxy(request("/admin"));

    expect(response.status).toBe(307);
    expect(redirectTarget(response)).toBe("/login?next=%2Fadmin");
  });

  it("does not call the API for a caller with no session cookie", async () => {
    await proxy(request("/admin/products"));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends an anonymous caller on a nested admin path to sign in", async () => {
    const response = await proxy(request("/admin/products/new"));

    expect(redirectTarget(response)).toBe(
      "/login?next=%2Fadmin%2Fproducts%2Fnew",
    );
  });

  it("keeps the query string in the next target after sign in", async () => {
    const response = await proxy(request("/admin/products?page=2"));

    expect(redirectTarget(response)).toBe(
      "/login?next=%2Fadmin%2Fproducts%3Fpage%3D2",
    );
  });

  it("sends a signed in customer to the storefront", async () => {
    const response = await proxy(request("/admin", "cp_access=customer-token"));

    expect(response.status).toBe(307);
    expect(redirectTarget(response)).toBe("/");
  });

  it("lets an admin through without a redirect", async () => {
    const response = await proxy(request("/admin", "cp_access=admin-token"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("ignores a client supplied x-auth-role when there is no session", async () => {
    // A caller can set any request header. The proxy must judge the session
    // itself, so a forged admin role changes nothing.
    const response = await proxy(
      request("/admin", undefined, { "x-auth-role": "ADMIN" }),
    );

    expect(response.status).toBe(307);
    expect(redirectTarget(response)).toBe("/login?next=%2Fadmin");
    expect(response.headers.get("x-middleware-request-x-auth-role")).toBeNull();
  });

  it("refuses a customer even when they claim x-auth-role: ADMIN", async () => {
    const response = await proxy(
      request("/admin", "cp_access=customer-token", {
        "x-auth-role": "ADMIN",
      }),
    );

    expect(redirectTarget(response)).toBe("/");
  });

  it("overwrites a forged x-auth-role with the role the API proved", async () => {
    const response = await proxy(
      request("/admin", "cp_access=admin-token", { "x-auth-role": "CUSTOMER" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-request-x-auth-role")).toBe(
      "ADMIN",
    );
  });

  it("refreshes with the refresh cookie alone, so a reload still works (AC-5)", async () => {
    const forwardedFor = "203.0.113.7";
    const response = await proxy(
      request("/admin", "cp_refresh=live-refresh", {
        "x-forwarded-for": forwardedFor,
      }),
    );

    expect(calls.map((call) => new URL(call.url).pathname)).toEqual([
      "/api/auth/me",
      "/api/auth/refresh",
      "/api/auth/me",
    ]);
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("cp_access=admin-token"),
        expect.stringContaining("cp_refresh=new-refresh"),
      ]),
    );

    // The real API refuses a refresh without the origin and proxy secret, and
    // buckets every guard call by the forwarded address. A mock that ignores
    // these would let a regression pass here and fail only in the browser.
    const refresh = calls.find((call) => call.url.endsWith("/auth/refresh"));
    const refreshHeaders = new Headers(refresh?.init?.headers);
    expect(refreshHeaders.get("origin")).toBe("http://web.test");
    expect(refreshHeaders.get("x-proxy-secret")).toBe("test-secret");
    expect(refreshHeaders.get("cookie")).toContain("cp_refresh=live-refresh");
    expect(refreshHeaders.get("x-forwarded-for")).toBe(forwardedFor);
    for (const call of calls) {
      expect(new Headers(call.init?.headers).get("x-forwarded-for")).toBe(
        forwardedFor,
      );
    }

    // The server render reads the request cookies from this header, not from
    // the browser's Set-Cookie. Both rotated values must reach it.
    const requestCookie = response.headers.get("x-middleware-request-cookie");
    expect(requestCookie).toContain("cp_access=admin-token");
    expect(requestCookie).toContain("cp_refresh=new-refresh");
  });

  it("refreshes an expired access cookie instead of sending an admin to sign in (AC-5)", async () => {
    const response = await proxy(
      request("/admin", "cp_access=expired-token; cp_refresh=live-refresh"),
    );

    expect(response.status).toBe(200);
    expect(calls.map((call) => new URL(call.url).pathname)).toEqual([
      "/api/auth/me",
      "/api/auth/refresh",
      "/api/auth/me",
    ]);
    expect(new Headers(calls[2]?.init?.headers).get("cookie")).toContain(
      "cp_access=admin-token",
    );
  });

  it("relays the clearing cookies when the refresh cookie is also dead", async () => {
    const response = await proxy(
      request("/admin", "cp_access=expired-token; cp_refresh=dead-refresh"),
    );

    expect(redirectTarget(response)).toBe("/login?next=%2Fadmin");
    expect(response.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("cp_access=; Max-Age=0"),
        expect.stringContaining("cp_refresh=; Max-Age=0"),
      ]),
    );
  });

  it("refreshes a customer and still sends them to the storefront", async () => {
    const response = await proxy(
      request("/admin", "cp_access=expired-token; cp_refresh=customer-refresh"),
    );

    expect(redirectTarget(response)).toBe("/");
    expect(response.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("cp_access=customer-token"),
      ]),
    );
  });

  it("asks the API for the role rather than trusting the cookie", async () => {
    await proxy(request("/admin", "cp_access=admin-token"));

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("http://api.test/api/auth/me");
  });

  it("forwards the caller cookie and the proxy secret to the API", async () => {
    await proxy(request("/admin", "cp_access=admin-token"));

    const headers = new Headers(calls[0]?.init?.headers);
    expect(headers.get("cookie")).toBe("cp_access=admin-token");
    expect(headers.get("x-proxy-secret")).toBe("test-secret");
  });

  it("never caches the role answer", async () => {
    await proxy(request("/admin", "cp_access=customer-token"));

    expect(calls[0]?.init?.cache).toBe("no-store");
  });

  it("sends a caller to sign in when the API refuses the session", async () => {
    const response = await proxy(request("/admin", "cp_access=expired-token"));

    expect(redirectTarget(response)).toBe("/login?next=%2Fadmin");
  });

  it("fails closed to sign in when the API cannot be reached", async () => {
    fetchMock.mockRejectedValueOnce(new Error("connect ECONNREFUSED"));

    const response = await proxy(request("/admin", "cp_access=admin-token"));

    expect(redirectTarget(response)).toBe("/login?next=%2Fadmin");
  });

  it("fails closed when the API answers with a body that carries no role", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "user-1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await proxy(request("/admin", "cp_access=admin-token"));

    expect(redirectTarget(response)).toBe("/");
  });

  it("guards the admin path with a trailing slash", async () => {
    const response = await proxy(
      request("/admin/", "cp_access=customer-token"),
    );

    expect(redirectTarget(response)).toBe("/");
  });

  it("leaves the auth API proxy alone", async () => {
    const response = await proxy(request("/api/auth/me", "cp_refresh=live"));

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("leaves a storefront page that merely starts with admin alone", async () => {
    const response = await proxy(request("/administrator"));

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("noindex header", () => {
  it.each([
    "/login",
    "/register",
    "/verify-email",
    "/forgot-password",
    "/reset-password",
    "/auth/callback",
  ])("marks %s as noindex", (path) => {
    return proxy(request(path)).then((response) => {
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    });
  });

  it("does not mark a storefront page", async () => {
    const response = await proxy(request("/shop"));

    expect(response.headers.get("x-robots-tag")).toBeNull();
  });
});
