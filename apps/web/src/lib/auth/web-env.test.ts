import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

afterEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
});

describe("getWebAuthEnv", () => {
  it("reduces WEB_APP_URL to its origin and keeps the API path", async () => {
    process.env = {
      ...originalEnv,
      API_INTERNAL_URL: "http://api.test/api/",
      PROXY_SHARED_SECRET: "test-secret",
      WEB_APP_URL: "https://shop.example.com/store/?from=email",
    };

    const { getWebAuthEnv } = await import("./web-env");

    expect(getWebAuthEnv()).toEqual({
      apiInternalUrl: "http://api.test/api",
      proxySharedSecret: "test-secret",
      webAppUrl: "https://shop.example.com",
    });
  });

  it("refuses a WEB_APP_URL that is not an absolute http(s) URL", async () => {
    process.env = {
      ...originalEnv,
      API_INTERNAL_URL: "http://api.test/api",
      PROXY_SHARED_SECRET: "test-secret",
      WEB_APP_URL: "shop.example.com",
    };

    const { getWebAuthEnv } = await import("./web-env");

    expect(() => getWebAuthEnv()).toThrow(
      "WEB_APP_URL must be an absolute http(s) URL.",
    );
  });
});
