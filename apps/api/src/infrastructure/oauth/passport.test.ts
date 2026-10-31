import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import {
  createOAuthAuthenticator,
  type OAuthProviderEndpoints,
  type OAuthStrategyConfig,
} from "./passport.js";

const BASE_CONFIG: OAuthStrategyConfig = {
  webAppUrl: "http://localhost:3000",
  google: { id: "google-id", secret: "google-secret" },
  facebook: { id: "facebook-id", secret: "facebook-secret" },
};

/**
 * Builds the provider redirect for one start request without touching the
 * network. Passport only builds the authorization URL at this step.
 */
function startUrl(
  provider: "google" | "facebook",
  endpoints?: OAuthProviderEndpoints,
): string {
  const config: OAuthStrategyConfig = endpoints
    ? {
        ...BASE_CONFIG,
        [provider]: {
          ...BASE_CONFIG[provider],
          endpoints,
        },
      }
    : BASE_CONFIG;
  const authenticator = createOAuthAuthenticator(config);

  const setHeader = vi.fn<(name: string, value: string) => void>();
  const request = {
    query: {},
    headers: {},
    method: "GET",
    url: "/api/auth/" + provider,
  } as unknown as Request;
  const response = {
    statusCode: 200,
    setHeader,
    end: vi.fn(),
  } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;

  authenticator.authenticate(provider, { session: false })(
    request,
    response,
    next,
  );

  const location = setHeader.mock.calls.find(
    ([name]) => name === "Location",
  )?.[1];

  if (typeof location !== "string") {
    throw new Error(`${provider} did not redirect to the provider.`);
  }

  return location;
}

/** Tests that each provider start asks for the identity fields the app needs. */
describe("createOAuthAuthenticator", () => {
  it("asks Facebook for the account email", () => {
    const url = new URL(startUrl("facebook"));

    expect(url.searchParams.get("scope")).toBe("email");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/auth/facebook/callback",
    );
  });

  it("asks Google for the profile and email", () => {
    const url = new URL(startUrl("google"));

    expect(url.searchParams.get("scope")).toBe("profile email");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/auth/google/callback",
    );
  });

  it("sends Google to a configured local mock endpoint", () => {
    const url = new URL(
      startUrl("google", {
        authorizationUrl: "http://127.0.0.1:9099/oauth/google/authorize",
        tokenUrl: "http://127.0.0.1:9099/oauth/google/token",
        profileUrl: "http://127.0.0.1:9099/oauth/google/userinfo",
      }),
    );

    expect(url.origin).toBe("http://127.0.0.1:9099");
    expect(url.pathname).toBe("/oauth/google/authorize");
    expect(url.searchParams.get("client_id")).toBe("google-id");
  });

  it("sends Facebook to a configured local mock endpoint", () => {
    const url = new URL(
      startUrl("facebook", {
        authorizationUrl: "http://127.0.0.1:9099/oauth/facebook/authorize",
        tokenUrl: "http://127.0.0.1:9099/oauth/facebook/token",
        profileUrl: "http://127.0.0.1:9099/oauth/facebook/profile",
      }),
    );

    expect(url.origin).toBe("http://127.0.0.1:9099");
    expect(url.pathname).toBe("/oauth/facebook/authorize");
    expect(url.searchParams.get("client_id")).toBe("facebook-id");
  });
});
