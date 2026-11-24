import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

afterEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
});

describe("register", () => {
  it("validates the auth env when the node server starts", async () => {
    process.env = { ...originalEnv, NEXT_RUNTIME: "nodejs" };
    delete process.env["NEXT_PHASE"];
    delete process.env["PROXY_SHARED_SECRET"];

    const { register } = await import("./instrumentation");

    await expect(register()).rejects.toThrow("Missing PROXY_SHARED_SECRET");
  });

  it("stays quiet during the build phase", async () => {
    process.env = {
      ...originalEnv,
      NEXT_RUNTIME: "nodejs",
      NEXT_PHASE: "phase-production-build",
    };
    delete process.env["PROXY_SHARED_SECRET"];

    const { register } = await import("./instrumentation");

    await expect(register()).resolves.toBeUndefined();
  });

  it("stays quiet outside the node runtime", async () => {
    process.env = { ...originalEnv, NEXT_RUNTIME: "edge" };
    delete process.env["NEXT_PHASE"];
    delete process.env["PROXY_SHARED_SECRET"];

    const { register } = await import("./instrumentation");

    await expect(register()).resolves.toBeUndefined();
  });

  it("rejects an invalid TRUSTED_PROXY_HOPS when starting the node runtime", async () => {
    process.env = {
      ...originalEnv,
      NEXT_RUNTIME: "nodejs",
      API_INTERNAL_URL: "http://api.test/api",
      PROXY_SHARED_SECRET: "test-secret-0123456789",
      WEB_APP_URL: "https://shop.example.com",
      TRUSTED_PROXY_HOPS: "0",
    };
    delete process.env["NEXT_PHASE"];

    const { register } = await import("./instrumentation");

    await expect(register()).rejects.toThrow(/Invalid TRUSTED_PROXY_HOPS/);
  });
});
