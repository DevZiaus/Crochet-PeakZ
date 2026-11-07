/**
 * Tests for the server session read.
 *
 * The admin guard calls this from a server component, so there is no browser
 * request to carry the client address. The read has to forward the address it
 * received, otherwise every render shares one rate limit bucket on the API and
 * a busy storefront throttles itself.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@crochet-peakz/shared";

const { cookiesMock, headersMock } = vi.hoisted(() => {
  const cookiesMock = vi.fn((): Promise<{ toString: () => string }> =>
    Promise.resolve({ toString: () => "" }),
  );
  const headersMock = vi.fn((): Promise<Headers> =>
    Promise.resolve(new Headers()),
  );
  return { cookiesMock, headersMock };
});

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
  headers: headersMock,
}));

const originalEnv = { ...process.env };

const fetchMock = vi.fn();

const user: AuthUser = {
  id: "user-1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  role: "CUSTOMER",
  avatarUrl: null,
  emailVerified: true,
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  process.env = {
    ...originalEnv,
    API_INTERNAL_URL: "http://api.test/api",
    PROXY_SHARED_SECRET: "test-secret-0123456789",
    WEB_APP_URL: "https://shop.example.com",
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  process.env = { ...originalEnv };
});

describe("getSessionUser", () => {
  it("forwards the client address the edge appended to the API", async () => {
    cookiesMock.mockReturnValue(
      Promise.resolve({ toString: () => "cp_access=abc" }),
    );
    headersMock.mockReturnValue(
      Promise.resolve(new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })),
    );
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(user), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const { getSessionUser } = await import("./session");
    const result = await getSessionUser();

    expect(result).toEqual(user);
    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toBe("http://api.test/api/auth/me");
    const sent = new Headers(call[1].headers);
    expect(sent.get("x-forwarded-for")).toBe("5.6.7.8");
    expect(sent.get("x-proxy-secret")).toBe("test-secret-0123456789");
    expect(sent.get("cookie")).toBe("cp_access=abc");
  });

  it("returns null without calling the API when there is no cookie", async () => {
    cookiesMock.mockReturnValue(Promise.resolve({ toString: () => "" }));

    const { getSessionUser } = await import("./session");

    expect(await getSessionUser()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
