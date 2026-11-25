// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

process.env.API_INTERNAL_URL = "http://api.test/api";
process.env.WEB_APP_URL = "http://web.test";

interface FetchCall {
  url: string;
  init?: RequestInit;
}

const calls: FetchCall[] = [];
const fetchMock = vi.fn();

beforeEach(() => {
  calls.length = 0;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("contact proxy route", () => {
  it("rejects cross-site requests and untrusted origins with 403", async () => {
    const crossSite = new NextRequest("http://web.test/api/contact", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "sec-fetch-site": "cross-site",
      },
      body: JSON.stringify({ name: "Ada" }),
    });
    expect((await POST(crossSite)).status).toBe(403);

    const badOrigin = new NextRequest("http://web.test/api/contact", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.test",
        host: "web.test",
      },
      body: JSON.stringify({ name: "Ada" }),
    });
    expect((await POST(badOrigin)).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects non-JSON content types with 415", async () => {
    const request = new NextRequest("http://web.test/api/contact", {
      method: "POST",
      headers: {
        "content-type": "text/plain",
        origin: "http://web.test",
      },
      body: "hello",
    });

    const response = await POST(request);
    expect(response.status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects bodies larger than 20KB with 413", async () => {
    const request = new NextRequest("http://web.test/api/contact", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://web.test",
      },
      body: JSON.stringify({ message: "a".repeat(25_000) }),
    });

    const response = await POST(request);
    expect(response.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards valid same-origin requests and relays 200 responses", async () => {
    fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        calls.push({ url, init });
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      },
    );

    const request = new NextRequest("http://web.test/api/contact", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://web.test",
        "x-forwarded-for": "203.0.113.9",
      },
      body: JSON.stringify({
        name: "Ada",
        email: "ada@example.com",
        topic: "general",
        message: "Hello there!",
        website: "",
        elapsedMs: 4000,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("http://api.test/api/contact");
    const forwardedHeaders = new Headers(calls[0]?.init?.headers);
    expect(forwardedHeaders.get("origin")).toBe("http://web.test");
    expect(forwardedHeaders.get("x-forwarded-for")).toBe("203.0.113.9");
    // With no secret configured the relay forwards without one, and the API's
    // contact route, which has no proxy guard, keys on X-Forwarded-For alone.
    expect(forwardedHeaders.get("x-proxy-secret")).toBeNull();
    expect(forwardedHeaders.get("x-proxy-client-ip")).toBeNull();
  });

  it("relays 429 status and Retry-After header from upstream", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            message:
              "Please wait about 5 minutes before sending another message.",
            statusCode: 429,
          },
        }),
        {
          status: 429,
          headers: {
            "content-type": "application/json",
            "retry-after": "300",
          },
        },
      ),
    );

    const request = new NextRequest("http://web.test/api/contact", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://web.test",
      },
      body: JSON.stringify({ name: "Ada" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("300");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 502 when the upstream API request throws", async () => {
    fetchMock.mockRejectedValueOnce(new Error("connect ECONNREFUSED"));

    const request = new NextRequest("http://web.test/api/contact", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://web.test",
      },
      body: JSON.stringify({ name: "Ada" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as {
      error: { message: string; statusCode: number };
    };
    expect(body.error.statusCode).toBe(502);
  });

  it("forwards the 2-hop CDN visitor IP and x-proxy-client-ip when TRUSTED_PROXY_HOPS=2", async () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "2");
    vi.stubEnv("PROXY_SHARED_SECRET", "proxy-secret-0123456789");
    fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        calls.push({ url, init });
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      },
    );

    const request = new NextRequest("http://web.test/api/contact", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://web.test",
        "x-forwarded-for": "9.9.9.9, 203.0.113.50, 172.70.1.1",
      },
      body: JSON.stringify({
        name: "Ada",
        email: "ada@example.com",
        topic: "general",
        message: "Hello there!",
        website: "",
        elapsedMs: 4000,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const forwardedHeaders = new Headers(calls[0]?.init?.headers);
    expect(forwardedHeaders.get("x-forwarded-for")).toBe("203.0.113.50");
    expect(forwardedHeaders.get("x-proxy-client-ip")).toBe("203.0.113.50");
    expect(forwardedHeaders.get("x-proxy-secret")).toBe(
      "proxy-secret-0123456789",
    );
  });
});
