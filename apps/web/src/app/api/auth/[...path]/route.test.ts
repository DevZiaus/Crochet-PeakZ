// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

process.env.API_INTERNAL_URL = "http://api.test/api";
process.env.PROXY_SHARED_SECRET = "test-secret";
process.env.WEB_APP_URL = "http://web.test";

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

    if (url.endsWith("/auth/login")) {
      return new Response(
        JSON.stringify({
          error: { message: "Invalid email or password.", statusCode: 401 },
        }),
        { status: 401, headers: { "content-type": "application/json" } },
      );
    }

    if (cookieOf(init).includes("cp_access=new-access")) {
      return new Response(JSON.stringify({ id: "user-1", role: "CUSTOMER" }), {
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

beforeEach(() => {
  calls.length = 0;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("auth proxy refresh and replay", () => {
  it("refreshes and replays when only the refresh cookie is present", async () => {
    const request = new NextRequest("http://web.test/api/auth/me", {
      headers: { cookie: "cp_refresh=old-refresh" },
    });

    const response = await GET(request, {
      params: Promise.resolve({ path: ["me"] }),
    });

    expect(response.status).toBe(200);
    expect(calls.map((call) => new URL(call.url).pathname)).toEqual([
      "/api/auth/me",
      "/api/auth/refresh",
      "/api/auth/me",
    ]);
    expect(cookieOf(calls[2]?.init)).toContain("cp_access=new-access");
    expect(response.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("cp_access=new-access"),
        expect.stringContaining("cp_refresh=new-refresh"),
      ]),
    );
  });

  it("refreshes an expired access token when both cookies are present", async () => {
    const request = new NextRequest("http://web.test/api/auth/me", {
      headers: { cookie: "cp_access=old-access; cp_refresh=old-refresh" },
    });

    const response = await GET(request, {
      params: Promise.resolve({ path: ["me"] }),
    });

    expect(response.status).toBe(200);
    expect(calls).toHaveLength(3);
  });

  it("does not refresh a failed login", async () => {
    const request = new NextRequest("http://web.test/api/auth/login", {
      method: "POST",
      headers: {
        origin: "http://web.test",
        cookie: "cp_refresh=old-refresh",
      },
    });

    const response = await POST(request, {
      params: Promise.resolve({ path: ["login"] }),
    });

    expect(response.status).toBe(401);
    expect(calls).toHaveLength(1);
    expect(response.headers.getSetCookie()).toEqual([]);
  });
});
