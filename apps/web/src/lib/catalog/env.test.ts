/**
 * Tests for the server side catalog configuration (AC-15).
 *
 * The client and the metadata builders both read `getCatalogEnv`, so a bad
 * value has to fail loudly and a trailing slash has to be removed. The module
 * memoises its result, so every case reimports it after resetting modules.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `NODE_ENV` is read only on the Node typings, so it is set through vitest's
// stub helper. These two URL keys are plain strings.
const managedKeys = ["API_INTERNAL_URL", "WEB_APP_URL"] as const;

/** Snapshot of the URL keys the suite manages. */
const originalValues: Record<string, string | undefined> = {
  API_INTERNAL_URL: process.env["API_INTERNAL_URL"],
  WEB_APP_URL: process.env["WEB_APP_URL"],
};

function restoreEnv() {
  for (const key of managedKeys) {
    const value = originalValues[key];
    if (value === undefined) {
      Reflect.deleteProperty(process.env, key);
    } else {
      process.env[key] = value;
    }
  }
}

async function importEnv() {
  return import("./env");
}

beforeEach(() => {
  vi.resetModules();
  restoreEnv();
  delete process.env["API_INTERNAL_URL"];
  delete process.env["WEB_APP_URL"];
});

afterEach(() => {
  restoreEnv();
  vi.unstubAllEnvs();
});

describe("getCatalogEnv", () => {
  it("falls back to the local development defaults outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const { getCatalogEnv } = await importEnv();
    const env = getCatalogEnv();

    expect(env.apiInternalUrl).toBe("http://localhost:4000/api");
    expect(env.webAppUrl).toBe("http://localhost:3000");
  });

  it("uses the configured values when they are present", async () => {
    vi.stubEnv("API_INTERNAL_URL", "https://api.crochetpeakz.com/api");
    vi.stubEnv("WEB_APP_URL", "https://crochetpeakz.com");

    const { getCatalogEnv } = await importEnv();

    expect(getCatalogEnv()).toEqual({
      apiInternalUrl: "https://api.crochetpeakz.com/api",
      webAppUrl: "https://crochetpeakz.com",
    });
  });

  it("strips one trailing slash from the API base URL", async () => {
    vi.stubEnv("API_INTERNAL_URL", "https://api.crochetpeakz.com/api/");
    vi.stubEnv("WEB_APP_URL", "https://crochetpeakz.com");

    const { getCatalogEnv } = await importEnv();

    expect(getCatalogEnv().apiInternalUrl).toBe(
      "https://api.crochetpeakz.com/api",
    );
  });

  it("reduces the web app URL to its origin", async () => {
    vi.stubEnv("API_INTERNAL_URL", "https://api.crochetpeakz.com/api");
    vi.stubEnv("WEB_APP_URL", "https://crochetpeakz.com/some/path?x=1");

    const { getCatalogEnv } = await importEnv();

    expect(getCatalogEnv().webAppUrl).toBe("https://crochetpeakz.com");
  });

  it("memoises the result across calls", async () => {
    vi.stubEnv("API_INTERNAL_URL", "https://api.first.test/api");
    vi.stubEnv("WEB_APP_URL", "https://first.test");

    const { getCatalogEnv } = await importEnv();
    const first = getCatalogEnv();

    process.env["API_INTERNAL_URL"] = "https://api.second.test/api";

    expect(getCatalogEnv()).toBe(first);
    expect(getCatalogEnv().apiInternalUrl).toBe("https://api.first.test/api");
  });

  it("falls back to the local defaults during the production build phase", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");

    const { getCatalogEnv } = await importEnv();

    expect(getCatalogEnv()).toEqual({
      apiInternalUrl: "http://localhost:4000/api",
      webAppUrl: "http://localhost:3000",
    });
  });

  it("still validates the values present during the production build phase", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    vi.stubEnv("API_INTERNAL_URL", "not a url");
    vi.stubEnv("WEB_APP_URL", "https://crochetpeakz.com");

    const { getCatalogEnv } = await importEnv();

    expect(() => getCatalogEnv()).toThrow(
      "API_INTERNAL_URL must be an absolute http(s) URL.",
    );
  });

  it("falls back only for the missing key during the production build phase", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    vi.stubEnv("API_INTERNAL_URL", "https://api.crochetpeakz.com/api");

    const { getCatalogEnv } = await importEnv();

    expect(getCatalogEnv()).toEqual({
      apiInternalUrl: "https://api.crochetpeakz.com/api",
      webAppUrl: "http://localhost:3000",
    });
  });

  it("keeps production validation when NEXT_PHASE is not the build phase", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-server");
    vi.stubEnv("API_INTERNAL_URL", "https://api.crochetpeakz.com/api");
    vi.stubEnv("WEB_APP_URL", "");

    const { getCatalogEnv } = await importEnv();

    expect(() => getCatalogEnv()).toThrow(
      "WEB_APP_URL must be an absolute http(s) URL.",
    );
  });

  it("throws in production when the API base URL is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("API_INTERNAL_URL", "");
    vi.stubEnv("WEB_APP_URL", "https://crochetpeakz.com");

    const { getCatalogEnv } = await importEnv();

    expect(() => getCatalogEnv()).toThrow(
      "API_INTERNAL_URL must be an absolute http(s) URL.",
    );
  });

  it("throws in production when the web app URL is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("API_INTERNAL_URL", "https://api.crochetpeakz.com/api");
    vi.stubEnv("WEB_APP_URL", "");

    const { getCatalogEnv } = await importEnv();

    expect(() => getCatalogEnv()).toThrow(
      "WEB_APP_URL must be an absolute http(s) URL.",
    );
  });

  it.each([
    ["a relative path", "/api"],
    ["a non http protocol", "ftp://api.crochetpeakz.com"],
    ["plain text", "not a url"],
  ])("rejects %s as the API base URL", async (_label, value) => {
    vi.stubEnv("API_INTERNAL_URL", value);
    vi.stubEnv("WEB_APP_URL", "https://crochetpeakz.com");

    const { getCatalogEnv } = await importEnv();

    expect(() => getCatalogEnv()).toThrow(
      "API_INTERNAL_URL must be an absolute http(s) URL.",
    );
  });

  it.each([
    ["a relative path", "/shop"],
    ["a non http protocol", "ftp://crochetpeakz.com"],
    ["plain text", "not a url"],
  ])("rejects %s as the web app URL", async (_label, value) => {
    vi.stubEnv("API_INTERNAL_URL", "https://api.crochetpeakz.com/api");
    vi.stubEnv("WEB_APP_URL", value);

    const { getCatalogEnv } = await importEnv();

    expect(() => getCatalogEnv()).toThrow(
      "WEB_APP_URL must be an absolute http(s) URL.",
    );
  });
});
