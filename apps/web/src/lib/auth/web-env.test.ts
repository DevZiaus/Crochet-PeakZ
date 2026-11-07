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
      PROXY_SHARED_SECRET: "test-secret-0123456789",
      WEB_APP_URL: "https://shop.example.com/store/?from=email",
    };

    const { getWebAuthEnv } = await import("./web-env");

    expect(getWebAuthEnv()).toEqual({
      apiInternalUrl: "http://api.test/api",
      proxySharedSecret: "test-secret-0123456789",
      webAppUrl: "https://shop.example.com",
    });
  });

  it("refuses a WEB_APP_URL that is not an absolute http(s) URL", async () => {
    process.env = {
      ...originalEnv,
      API_INTERNAL_URL: "http://api.test/api",
      PROXY_SHARED_SECRET: "test-secret-0123456789",
      WEB_APP_URL: "shop.example.com",
    };

    const { getWebAuthEnv } = await import("./web-env");

    expect(() => getWebAuthEnv()).toThrow(
      "WEB_APP_URL must be an absolute http(s) URL.",
    );
  });

  it("refuses a proxy secret shorter than the API accepts", async () => {
    process.env = {
      ...originalEnv,
      API_INTERNAL_URL: "http://api.test/api",
      PROXY_SHARED_SECRET: "too-short",
      WEB_APP_URL: "https://shop.example.com",
    };

    const { getWebAuthEnv } = await import("./web-env");

    expect(() => getWebAuthEnv()).toThrow(
      "PROXY_SHARED_SECRET must be at least 16 characters long.",
    );
  });

  it("refuses a placeholder proxy secret the API would reject", async () => {
    process.env = {
      ...originalEnv,
      API_INTERNAL_URL: "http://api.test/api",
      PROXY_SHARED_SECRET: "change-me-proxy-secret",
      WEB_APP_URL: "https://shop.example.com",
    };

    const { getWebAuthEnv } = await import("./web-env");

    expect(() => getWebAuthEnv()).toThrow(
      "PROXY_SHARED_SECRET is still set to a placeholder value.",
    );
  });
});
