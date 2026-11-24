import { describe, expect, it } from "vitest";
import { getContactEmailStartupWarning, loadEnv } from "./env.js";

/** Minimal environment that satisfies every required value. */
const baseEnv: NodeJS.ProcessEnv = {
  DATABASE_URL: "postgresql://user:password@localhost:5432/crochet_peakz",
  NODE_ENV: "test",
  JWT_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
  PROXY_SHARED_SECRET: "proxy-secret-0123456789",
  WEB_APP_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  FACEBOOK_APP_ID: "facebook-app-id",
  FACEBOOK_APP_SECRET: "facebook-app-secret",
  RESEND_API_KEY: "re_test_key",
  EMAIL_FROM: "Crochet PeakZ <hello@example.com>",
  CLOUDINARY_CLOUD_NAME: "crochet-peakz",
};

describe("loadEnv startup validation", () => {
  it("accepts a complete environment", () => {
    expect(() => loadEnv(baseEnv)).not.toThrow();
  });

  it.each([
    "DATABASE_URL",
    "JWT_SECRET",
    "JWT_REFRESH_SECRET",
    "PROXY_SHARED_SECRET",
    "WEB_APP_URL",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "FACEBOOK_APP_ID",
    "FACEBOOK_APP_SECRET",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "CLOUDINARY_CLOUD_NAME",
  ])("refuses to start when %s is missing and names it (AC-15)", (name) => {
    const source = Object.fromEntries(
      Object.entries(baseEnv).filter(([key]) => key !== name),
    );

    expect(() => loadEnv(source)).toThrow(new RegExp(name));
  });

  it("refuses a placeholder JWT secret (AC-15)", () => {
    expect(() =>
      loadEnv({
        ...baseEnv,
        JWT_SECRET: "change-me-change-me-change-me-change",
      }),
    ).toThrow(/JWT_SECRET is still set to a placeholder/);
  });

  it("refuses a JWT secret shorter than 32 characters (AC-15)", () => {
    expect(() => loadEnv({ ...baseEnv, JWT_SECRET: "too-short" })).toThrow(
      /JWT_SECRET must be at least 32 characters/,
    );
  });

  it("refuses the same value for both JWT secrets (AC-15)", () => {
    expect(() =>
      loadEnv({
        ...baseEnv,
        JWT_SECRET: "c".repeat(32),
        JWT_REFRESH_SECRET: "c".repeat(32),
      }),
    ).toThrow(/must be different values/);
  });

  it("refuses a malformed WEB_APP_URL (AC-15)", () => {
    expect(() =>
      loadEnv({ ...baseEnv, WEB_APP_URL: "not-an-absolute-url" }),
    ).toThrow(/Invalid WEB_APP_URL/);
  });

  it("refuses a WEB_APP_URL that is not http or https (AC-15)", () => {
    expect(() =>
      loadEnv({ ...baseEnv, WEB_APP_URL: "ftp://shop.example.com" }),
    ).toThrow(/WEB_APP_URL must use http or https/);
  });

  it("refuses an EMAIL_FROM without an address (AC-15)", () => {
    expect(() => loadEnv({ ...baseEnv, EMAIL_FROM: "Crochet PeakZ" })).toThrow(
      /EMAIL_FROM/,
    );
  });

  it.each(["foo@", "@example.com", "foo@bar", "Crochet PeakZ <hello>"])(
    "refuses a malformed EMAIL_FROM address %s (AC-15)",
    (value) => {
      expect(() => loadEnv({ ...baseEnv, EMAIL_FROM: value })).toThrow(
        /EMAIL_FROM/,
      );
    },
  );

  it("accepts a display name with a real address (AC-15)", () => {
    expect(() =>
      loadEnv({
        ...baseEnv,
        EMAIL_FROM: "Crochet PeakZ <hello@example.com>",
      }),
    ).not.toThrow();
  });

  it("accepts a localhost sender outside production", () => {
    expect(() =>
      loadEnv({
        ...baseEnv,
        EMAIL_FROM: "Crochet PeakZ <hello@localhost>",
      }),
    ).not.toThrow();
  });

  it("refuses a localhost sender in production", () => {
    expect(() =>
      loadEnv({
        ...baseEnv,
        NODE_ENV: "production",
        EMAIL_FROM: "hello@localhost",
      }),
    ).toThrow(/EMAIL_FROM/);
  });

  it("defaults CONTACT_EMAIL to hello@crochetpeakz.tech when unset", () => {
    const env = loadEnv(baseEnv);
    expect(env.contactEmail).toBe("hello@crochetpeakz.tech");
  });

  it("accepts a valid CONTACT_EMAIL override", () => {
    const env = loadEnv({
      ...baseEnv,
      CONTACT_EMAIL: "support@crochetpeakz.tech",
    });
    expect(env.contactEmail).toBe("support@crochetpeakz.tech");
  });

  it("rejects an invalid or placeholder CONTACT_EMAIL", () => {
    expect(() =>
      loadEnv({ ...baseEnv, CONTACT_EMAIL: "not-an-email" }),
    ).toThrow(/CONTACT_EMAIL/);
    expect(() =>
      loadEnv({ ...baseEnv, CONTACT_EMAIL: "change-me@example.com" }),
    ).toThrow(/CONTACT_EMAIL/);
  });
});

describe("loadEnv OAuth endpoint overrides", () => {
  it("leaves the provider endpoints at their defaults when unset", () => {
    const env = loadEnv(baseEnv);

    expect(env.googleClient.endpoints).toBeUndefined();
    expect(env.facebookClient.endpoints).toBeUndefined();
  });

  it("reads local mock provider endpoints in a non-production environment", () => {
    const env = loadEnv({
      ...baseEnv,
      GOOGLE_AUTH_URL: "http://127.0.0.1:9099/oauth/google/authorize",
      GOOGLE_TOKEN_URL: "http://127.0.0.1:9099/oauth/google/token",
      GOOGLE_USERINFO_URL: "http://127.0.0.1:9099/oauth/google/userinfo",
      FACEBOOK_AUTH_URL: "http://127.0.0.1:9099/oauth/facebook/authorize",
      FACEBOOK_TOKEN_URL: "http://127.0.0.1:9099/oauth/facebook/token",
      FACEBOOK_PROFILE_URL: "http://127.0.0.1:9099/oauth/facebook/profile",
    });

    expect(env.googleClient.endpoints).toEqual({
      authorizationUrl: "http://127.0.0.1:9099/oauth/google/authorize",
      tokenUrl: "http://127.0.0.1:9099/oauth/google/token",
      profileUrl: "http://127.0.0.1:9099/oauth/google/userinfo",
    });
    expect(env.facebookClient.endpoints).toEqual({
      authorizationUrl: "http://127.0.0.1:9099/oauth/facebook/authorize",
      tokenUrl: "http://127.0.0.1:9099/oauth/facebook/token",
      profileUrl: "http://127.0.0.1:9099/oauth/facebook/profile",
    });
  });

  it("rejects an invalid override URL", () => {
    expect(() => loadEnv({ ...baseEnv, GOOGLE_AUTH_URL: "not-a-url" })).toThrow(
      /Invalid GOOGLE_AUTH_URL/,
    );
  });

  it("rejects endpoint overrides in production", () => {
    expect(() =>
      loadEnv({
        ...baseEnv,
        NODE_ENV: "production",
        GOOGLE_AUTH_URL: "http://127.0.0.1:9099/oauth/google/authorize",
      }),
    ).toThrow(/test-only overrides/);
  });
});

describe("getContactEmailStartupWarning", () => {
  it("warns when EMAIL_FROM uses resend.dev in display-name form with default CONTACT_EMAIL", () => {
    const env = loadEnv({
      ...baseEnv,
      EMAIL_FROM: "Crochet PeakZ <onboarding@resend.dev>",
    });

    const warning = getContactEmailStartupWarning(env);
    expect(warning).toContain("onboarding@resend.dev");
    expect(warning).toContain("hello@crochetpeakz.tech");
    expect(warning).toContain("CONTACT_EMAIL");
  });

  it("warns when EMAIL_FROM uses bare onboarding@resend.dev with default CONTACT_EMAIL", () => {
    const env = loadEnv({
      ...baseEnv,
      EMAIL_FROM: "onboarding@resend.dev",
    });

    expect(getContactEmailStartupWarning(env)).not.toBeNull();
  });

  it("returns null when CONTACT_EMAIL is overridden away from the default", () => {
    const env = loadEnv({
      ...baseEnv,
      EMAIL_FROM: "Crochet PeakZ <onboarding@resend.dev>",
      CONTACT_EMAIL: "owner@example.com",
    });

    expect(getContactEmailStartupWarning(env)).toBeNull();
  });

  it("returns null when EMAIL_FROM uses a custom domain", () => {
    const env = loadEnv({
      ...baseEnv,
      EMAIL_FROM: "Crochet PeakZ <no-reply@crochetpeakz.tech>",
    });

    expect(getContactEmailStartupWarning(env)).toBeNull();
  });
});
