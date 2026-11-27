// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DELETE, GET, PATCH, POST } from "./route";

process.env.API_INTERNAL_URL = "http://api.test/api";
process.env.PROXY_SHARED_SECRET = "test-secret-0123456789";
process.env.WEB_APP_URL = "http://web.test";

const VARIANT_ID = "550e8400-e29b-41d4-a716-446655440000";

interface FetchCall {
  url: string;
  init?: RequestInit;
}

const calls: FetchCall[] = [];

function cookieOf(init?: RequestInit): string {
  return new Headers(init?.headers).get("cookie") ?? "";
}

const fetchMock = vi.fn(
  (input: RequestInfo | URL, init?: RequestInit): Response => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    calls.push({ url, init });

    if (url.endsWith("/auth/refresh")) {
      const headers = new Headers();
      headers.append(
        "set-cookie",
        "cp_access=new-access; Max-Age=900; Path=/; HttpOnly; SameSite=Lax",
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

    if (url.endsWith("/cart/quote")) {
      return new Response(JSON.stringify({ data: { lines: [] } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (
      url.endsWith("/cart") ||
      url.includes(`/cart/items/${VARIANT_ID}`) ||
      url.endsWith("/cart/items") ||
      url.endsWith("/cart/merge")
    ) {
      if (cookieOf(init).includes("cp_access=new-access")) {
        return new Response(
          JSON.stringify({ data: { lines: [], adjustments: [] } }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          error: { message: "Sign in to continue.", statusCode: 401 },
        }),
        { status: 401, headers: { "content-type": "application/json" } },
      );
    }

    return new Response(null, { status: 404 });
  },
);

beforeEach(() => {
  calls.length = 0;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cart proxy allowlist, limits, and refresh", () => {
  it("forwards allowed quote, item patch, and empty DELETE calls with proxy headers", async () => {
    const quoteReq = new NextRequest("http://web.test/api/cart/quote", {
      method: "POST",
      headers: {
        origin: "http://web.test",
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.10",
      },
      body: JSON.stringify({ lines: [] }),
    });
    const quoteRes = await POST(quoteReq, {
      params: Promise.resolve({ path: ["quote"] }),
    });
    expect(quoteRes.status).toBe(200);
    expect(quoteRes.headers.get("cache-control")).toBe("no-store");
    expect(new URL(calls[0]?.url ?? "").pathname).toBe("/api/cart/quote");
    expect(new Headers(calls[0]?.init?.headers).get("x-proxy-secret")).toBe(
      "test-secret-0123456789",
    );

    const patchReq = new NextRequest(
      `http://web.test/api/cart/items/${VARIANT_ID}`,
      {
        method: "PATCH",
        headers: {
          origin: "http://web.test",
          cookie: "cp_access=new-access",
          "content-type": "application/json",
        },
        body: JSON.stringify({ quantity: 2 }),
      },
    );
    const patchRes = await PATCH(patchReq, {
      params: Promise.resolve({ path: ["items", VARIANT_ID] }),
    });
    expect(patchRes.status).toBe(200);
    expect(new URL(calls[1]?.url ?? "").pathname).toBe(
      `/api/cart/items/${VARIANT_ID}`,
    );

    const deleteReq = new NextRequest("http://web.test/api/cart", {
      method: "DELETE",
      headers: {
        origin: "http://web.test",
        cookie: "cp_access=new-access",
      },
    });
    const deleteRes = await DELETE(deleteReq, {
      params: Promise.resolve({}),
    });
    expect(deleteRes.status).toBe(200);
    expect(new URL(calls[2]?.url ?? "").pathname).toBe("/api/cart");
    expect(calls[2]?.init?.body).toBeUndefined();
  });

  it("refreshes and replays once on 401 for GET /api/cart", async () => {
    const req = new NextRequest("http://web.test/api/cart", {
      headers: { cookie: "cp_refresh=old-refresh" },
    });

    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(calls.map((c) => new URL(c.url).pathname)).toEqual([
      "/api/cart",
      "/api/auth/refresh",
      "/api/cart",
    ]);
    expect(res.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("cp_access=new-access"),
        expect.stringContaining("cp_refresh=new-refresh"),
      ]),
    );
  });

  it("rejects non allowlisted paths and non UUID item params with 404", async () => {
    const badPath = await GET(
      new NextRequest("http://web.test/api/cart/quote"),
      {
        params: Promise.resolve({ path: ["quote"] }),
      },
    );
    expect(badPath.status).toBe(404);

    const badUuid = await PATCH(
      new NextRequest("http://web.test/api/cart/items/not-a-uuid", {
        method: "PATCH",
        headers: { origin: "http://web.test" },
      }),
      { params: Promise.resolve({ path: ["items", "not-a-uuid"] }) },
    );
    expect(badUuid.status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  it("rejects writes above 16 KB with 413 and mismatched origin with 403", async () => {
    const bigReq = new NextRequest("http://web.test/api/cart/quote", {
      method: "POST",
      headers: {
        origin: "http://web.test",
        "content-type": "application/json",
      },
      body: "a".repeat(16 * 1024 + 1),
    });
    const bigRes = await POST(bigReq, {
      params: Promise.resolve({ path: ["quote"] }),
    });
    expect(bigRes.status).toBe(413);

    const badOriginReq = new NextRequest("http://web.test/api/cart", {
      method: "DELETE",
      headers: { origin: "https://evil.example" },
    });
    const badOriginRes = await DELETE(badOriginReq, {
      params: Promise.resolve({}),
    });
    expect(badOriginRes.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("returns 502 with the cart service message on upstream failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("connect ECONNREFUSED"))),
    );

    const req = new NextRequest("http://web.test/api/cart", {
      headers: { cookie: "cp_access=new-access" },
    });
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: {
        message: "The cart service did not answer. Try again.",
        statusCode: 502,
      },
    });
  });
});
