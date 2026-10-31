import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

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
};

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
