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
      if (cookieOf(init).includes("cp_refresh=dead-refresh")) {
        const headers = new Headers();
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

    if (new URL(url).pathname === "/api/auth/google") {
      const headers = new Headers();
      headers.set(
        "location",
        "https://accounts.google.com/o/oauth2/v2/auth?state=state-1",
      );
      headers.append(
        "set-cookie",
        "cp_oauth_state=state-1; Max-Age=600; Path=/; HttpOnly; SameSite=Lax",
      );
      return new Response(null, { status: 302, headers });
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

  it("relays the rotated cookies when the replay fails after a refresh", async () => {
    let originalSent = false;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

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
          return Promise.resolve(
            new Response(JSON.stringify({ id: "user-1" }), {
              status: 200,
              headers,
            }),
          );
        }

        if (!originalSent) {
          originalSent = true;
          return Promise.resolve(
            new Response(
              JSON.stringify({
                error: { message: "Sign in to continue.", statusCode: 401 },
              }),
              { status: 401, headers: { "content-type": "application/json" } },
            ),
          );
        }

        return Promise.reject(
          new DOMException("The operation timed out.", "TimeoutError"),
        );
      }),
    );

    const request = new NextRequest("http://web.test/api/auth/me", {
      headers: { cookie: "cp_access=old-access; cp_refresh=old-refresh" },
    });

    const response = await GET(request, {
      params: Promise.resolve({ path: ["me"] }),
    });

    // The refresh already revoked the old token, so the browser must still
    // receive the rotated pair even though the replay failed.
    expect(response.status).toBe(502);
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

  it("relays a failed refresh and its cookie clearing instead of retrying again (AC-5)", async () => {
    const request = new NextRequest("http://web.test/api/auth/me", {
      headers: {
        cookie: "cp_access=old-access; cp_refresh=dead-refresh",
      },
    });

    const response = await GET(request, {
      params: Promise.resolve({ path: ["me"] }),
    });

    expect(response.status).toBe(401);
    expect(calls.map((call) => new URL(call.url).pathname)).toEqual([
      "/api/auth/me",
      "/api/auth/refresh",
    ]);
    const cookies = response.headers.getSetCookie();
    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.stringContaining("cp_access=; Max-Age=0"),
        expect.stringContaining("cp_refresh=; Max-Age=0"),
      ]),
    );
  });

  it("forwards the last X-Forwarded-For hop, the address the edge added", async () => {
    const request = new NextRequest("http://web.test/api/auth/me", {
      headers: {
        cookie: "cp_access=new-access",
        "x-forwarded-for": "1.2.3.4, 5.6.7.8",
      },
    });

    await GET(request, { params: Promise.resolve({ path: ["me"] }) });

    expect(new Headers(calls[0]?.init?.headers).get("x-forwarded-for")).toBe(
      "5.6.7.8",
    );
  });

  it("falls back to X-Real-IP when X-Forwarded-For is absent", async () => {
    const request = new NextRequest("http://web.test/api/auth/me", {
      headers: { cookie: "cp_access=new-access", "x-real-ip": "9.9.9.9" },
    });

    await GET(request, { params: Promise.resolve({ path: ["me"] }) });

    expect(new Headers(calls[0]?.init?.headers).get("x-forwarded-for")).toBe(
      "9.9.9.9",
    );
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

describe("auth proxy allowlist and upstream failures", () => {
  it("refuses a path outside the auth surface without calling the API", async () => {
    const request = new NextRequest("http://web.test/api/auth/admin", {
      headers: { cookie: "cp_access=new-access" },
    });

    const response = await GET(request, {
      params: Promise.resolve({ path: ["admin"] }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { message: "Unknown auth endpoint.", statusCode: 404 },
    });
    expect(calls).toHaveLength(0);
  });

  it("refuses a method that is neither GET nor POST without calling the API", async () => {
    const request = new NextRequest("http://web.test/api/auth/me", {
      method: "OPTIONS",
      headers: { cookie: "cp_access=new-access" },
    });

    const response = await GET(request, {
      params: Promise.resolve({ path: ["me"] }),
    });

    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({
      error: { message: "Method not allowed.", statusCode: 405 },
    });
    expect(calls).toHaveLength(0);
  });

  it("refuses a body larger than the API accepts without calling the API", async () => {
    const request = new NextRequest("http://web.test/api/auth/login", {
      method: "POST",
      headers: {
        origin: "http://web.test",
        "content-type": "application/json",
      },
      body: "x".repeat(1024 * 1024 + 1),
    });

    const response = await POST(request, {
      params: Promise.resolve({ path: ["login"] }),
    });

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      error: {
        message: "The request body is too large.",
        statusCode: 413,
      },
    });
    expect(calls).toHaveLength(0);
  });

  it("answers 502 when the API times out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.reject(
          new DOMException("The operation timed out.", "TimeoutError"),
        ),
      ),
    );
    const request = new NextRequest("http://web.test/api/auth/me", {
      headers: { cookie: "cp_access=new-access" },
    });

    const response = await GET(request, {
      params: Promise.resolve({ path: ["me"] }),
    });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: {
        message: "The auth service did not answer. Try again.",
        statusCode: 502,
      },
    });
  });
});

describe("auth proxy origin guard and redirect relay", () => {
  it("rejects a write from another origin without calling the API (AC-14)", async () => {
    const request = new NextRequest("http://web.test/api/auth/login", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });

    const response = await POST(request, {
      params: Promise.resolve({ path: ["login"] }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: {
        message: "This request came from an untrusted origin.",
        statusCode: 403,
      },
    });
    expect(calls).toHaveLength(0);
  });

  it("rejects a write with no Origin header (AC-14)", async () => {
    const request = new NextRequest("http://web.test/api/auth/register", {
      method: "POST",
    });

    const response = await POST(request, {
      params: Promise.resolve({ path: ["register"] }),
    });

    expect(response.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("relays an OAuth redirect and its state cookie without refreshing (AC-8)", async () => {
    const request = new NextRequest(
      "http://web.test/api/auth/google?next=%2F",
      {
        headers: { cookie: "cp_refresh=old-refresh" },
      },
    );

    const response = await GET(request, {
      params: Promise.resolve({ path: ["google"] }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth?state=state-1",
    );
    expect(response.headers.getSetCookie()).toEqual([
      expect.stringContaining("cp_oauth_state=state-1"),
    ]);
    expect(calls).toHaveLength(1);
    expect(new URL(calls[0]?.url ?? "").search).toBe("?next=%2F");
  });
});
