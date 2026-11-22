import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { config as loadDotEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import type { ApiEnv } from "../../config/env.js";
import type { AuthDependencies } from "../../application/dependencies.js";
import { loginUser } from "../../application/use-cases/login.js";
import { JwtTokenService } from "../../infrastructure/auth/jwt-token-service.js";
import { BcryptPasswordHasher } from "../../infrastructure/auth/bcrypt-password-hasher.js";
import { PrismaUserRepository } from "../../infrastructure/database/user.repository.js";
import { PrismaSessionRepository } from "../../infrastructure/database/session.repository.js";
import {
  createDatabase,
  type Database,
} from "../../infrastructure/database/prisma.js";
import { createOAuthAuthenticator } from "../../infrastructure/oauth/passport.js";
import {
  startMockOAuthProvider,
  type MockOAuthProfile,
  type MockOAuthProvider,
} from "../../test-support/mock-oauth-provider.js";
import {
  createTestClock,
  RecordingEmailSender,
  type TestClock,
} from "../../test-support/auth-fakes.js";
import { createAuthRouter } from "./auth.routes.js";

loadDotEnv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});

const databaseUrl = process.env["DATABASE_URL"];
const describeWithDatabase = databaseUrl ? describe : describe.skip;

const PROXY_SECRET = "oauth-integration-proxy-secret-0123456789";
const WEB_APP_URL = "https://shop.example.com";
const GOOGLE_ID = "google-client-id";
const FACEBOOK_ID = "facebook-client-id";

/**
 * Exercises the complete OAuth round trip against a local mock provider.
 *
 * The test plays the browser: it starts at the API, follows the provider
 * redirect, and calls the callback with the state cookie. Passport, the auth
 * router, PostgreSQL, and the JWT and cookie layers are all real. Only the
 * provider's HTML login page and profile API are simulated, so no live Google
 * or Facebook account, CAPTCHA, or automation block is involved.
 */
describeWithDatabase("OAuth sign in against a mock provider", () => {
  let database: Database;
  let deps: AuthDependencies;
  let clock: TestClock;
  let provider!: MockOAuthProvider;
  let apiServer!: Server;
  let apiUrl = "";
  const createdEmails: string[] = [];

  beforeAll(async () => {
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required.");
    }

    database = createDatabase(databaseUrl);
    clock = createTestClock(new Date("2026-01-01T00:00:00Z"));
    deps = {
      users: new PrismaUserRepository(database.client),
      sessions: new PrismaSessionRepository(database.client),
      passwords: new BcryptPasswordHasher(),
      tokens: new JwtTokenService({
        jwtSecret: "oauth-integration-access-secret-0123456789",
        refreshSecret: "oauth-integration-refresh-secret-0123456789",
      }),
      emails: new RecordingEmailSender(),
      clock,
      webAppUrl: WEB_APP_URL,
    };

    provider = await startMockOAuthProvider();
    const authenticator = createOAuthAuthenticator({
      webAppUrl: WEB_APP_URL,
      google: {
        id: GOOGLE_ID,
        secret: "google-client-secret",
        endpoints: {
          authorizationUrl: `${provider.url}/oauth/google/authorize`,
          tokenUrl: `${provider.url}/oauth/google/token`,
          profileUrl: `${provider.url}/oauth/google/userinfo`,
        },
      },
      facebook: {
        id: FACEBOOK_ID,
        secret: "facebook-client-secret",
        endpoints: {
          authorizationUrl: `${provider.url}/oauth/facebook/authorize`,
          tokenUrl: `${provider.url}/oauth/facebook/token`,
          profileUrl: `${provider.url}/oauth/facebook/profile`,
        },
      },
    });

    const env: ApiEnv = {
      nodeEnv: "test",
      host: "127.0.0.1",
      port: 0,
      databaseUrl,
      corsOrigins: [WEB_APP_URL],
      trustProxy: false,
      webAppUrl: WEB_APP_URL,
      proxySharedSecret: PROXY_SECRET,
      jwtSecret: "oauth-integration-access-secret-0123456789",
      jwtRefreshSecret: "oauth-integration-refresh-secret-0123456789",
      googleClient: { id: GOOGLE_ID, secret: "google-client-secret" },
      facebookClient: {
        id: FACEBOOK_ID,
        secret: "facebook-client-secret",
      },
      resendApiKey: "re_integration_key",
      emailFrom: "Crochet PeakZ <hello@shop.example.com>",
      contactEmail: "hello@crochetpeakz.tech",
      cloudinaryCloudName: "crochet-peakz",
    };

    const app = createApp(
      env,
      () => Promise.resolve(true),
      createAuthRouter({
        auth: deps,
        proxySharedSecret: PROXY_SECRET,
        webAppUrl: WEB_APP_URL,
        isProduction: false,
        authenticator,
      }),
    );

    apiServer = app.listen(0, "127.0.0.1");
    await once(apiServer, "listening");
    apiUrl = `http://127.0.0.1:${(apiServer.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await provider.close();
    await new Promise<void>((resolve) => {
      apiServer.close(() => {
        resolve();
      });
      apiServer.closeAllConnections();
    });
    if (createdEmails.length > 0) {
      await database.client.user.deleteMany({
        where: { email: { in: createdEmails } },
      });
    }
    await database.disconnect();
  });

  it("completes a Google sign in with the signed next and session cookies (U18, S13, S18–S22, S28)", async () => {
    const email = uniqueEmail("google-customer");
    const firstProfile = makeProfile({
      id: "google-sub-1",
      name: "Ada Google",
      email,
      pictureUrl: "https://cdn.example.com/google-1.png",
    });
    provider.setProfile("google", firstProfile);

    clock.advance(60_000);
    const roundTrip = await beginRoundTrip("google", "/orders");
    const authorizeUrl = roundTrip.authorizeUrl;

    expect(authorizeUrl.origin).toBe(provider.url);
    expect(authorizeUrl.pathname).toBe("/oauth/google/authorize");
    expect(authorizeUrl.searchParams.get("client_id")).toBe(GOOGLE_ID);
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      `${WEB_APP_URL}/api/auth/google/callback`,
    );
    expect(authorizeUrl.searchParams.get("response_type")).toBe("code");
    expect(authorizeUrl.searchParams.get("scope")).toBe("profile email");
    expect(authorizeUrl.searchParams.get("state")).toBeTruthy();

    const stateCookie = roundTrip.stateCookie.toLowerCase();
    expect(stateCookie).toContain("httponly");
    expect(stateCookie).toContain("path=/api/auth");
    expect(stateCookie).toContain("max-age=600");

    const response = await completeRoundTrip("google", roundTrip);
    expect(response.status).toBe(302);

    const result = resultOf(response);
    expect(result.origin).toBe(WEB_APP_URL);
    expect(result.pathname).toBe("/auth/callback");
    expect(result.searchParams.get("provider")).toBe("google");
    expect(result.searchParams.get("status")).toBe("success");
    expect(result.searchParams.get("next")).toBe("/orders");

    const access = setCookie(response, "cp_access");
    const refresh = setCookie(response, "cp_refresh");
    expect(access.toLowerCase()).toContain("httponly");
    expect(access.toLowerCase()).toContain("path=/");
    expect(refresh.toLowerCase()).toContain("httponly");
    expect(setCookie(response, "cp_oauth_state").toLowerCase()).toContain(
      "expires=thu, 01 jan 1970",
    );

    const me = await fetch(`${apiUrl}/api/auth/me`, {
      headers: {
        "x-proxy-secret": PROXY_SECRET,
        cookie: `cp_access=${cookieValue(access)}`,
      },
    });
    expect(me.status).toBe(200);
    const user = (await me.json()) as Record<string, unknown>;
    expect(user).toMatchObject({
      name: "Ada Google",
      email,
      role: "CUSTOMER",
      avatarUrl: firstProfile.pictureUrl,
      emailVerified: true,
    });
    expect(Object.keys(user).sort()).toEqual([
      "avatarUrl",
      "email",
      "emailVerified",
      "id",
      "name",
      "role",
    ]);

    const row = await database.client.user.findUniqueOrThrow({
      where: { email },
    });
    expect(row.authProvider).toBe("GOOGLE");
    expect(row.providerId).toBe("google-sub-1");
    expect(row.avatarUrl).toBe(firstProfile.pictureUrl);
    expect(row.emailVerified).toBe(true);
    expect(row.passwordHash).toBeNull();
    expect(row.lastLoginAt?.getTime()).toBe(clock.now().getTime());

    expect(provider.requests.token).toHaveLength(1);
    expect(provider.requests.token[0]?.body?.get("grant_type")).toBe(
      "authorization_code",
    );
    expect(provider.requests.token[0]?.body?.get("code")).toBe(roundTrip.code);

    provider.setProfile("google", {
      ...firstProfile,
      pictureUrl: "https://cdn.example.com/google-2.png",
    });
    clock.advance(60_000);
    const secondTrip = await beginRoundTrip("google");
    const second = await completeRoundTrip("google", secondTrip);
    expect(resultOf(second).searchParams.get("status")).toBe("success");

    const secondRow = await database.client.user.findUniqueOrThrow({
      where: { email },
    });
    expect(secondRow.avatarUrl).toBe(firstProfile.pictureUrl);
    expect(secondRow.lastLoginAt?.getTime()).toBe(clock.now().getTime());
  });

  it("completes a Facebook sign in and lands on the role default (U19, S18, S28)", async () => {
    const email = uniqueEmail("facebook-customer");
    const facebookProfile = makeProfile({
      id: "facebook-sub-1",
      name: "Nadia Facebook",
      email,
      pictureUrl: "https://cdn.example.com/facebook-1.png",
    });
    provider.setProfile("facebook", facebookProfile);

    const roundTrip = await beginRoundTrip("facebook");
    expect(roundTrip.authorizeUrl.pathname).toBe("/oauth/facebook/authorize");
    expect(roundTrip.authorizeUrl.searchParams.get("client_id")).toBe(
      FACEBOOK_ID,
    );
    expect(roundTrip.authorizeUrl.searchParams.get("redirect_uri")).toBe(
      `${WEB_APP_URL}/api/auth/facebook/callback`,
    );
    expect(roundTrip.authorizeUrl.searchParams.get("scope")).toBe("email");

    const response = await completeRoundTrip("facebook", roundTrip);
    const result = resultOf(response);
    expect(result.searchParams.get("provider")).toBe("facebook");
    expect(result.searchParams.get("status")).toBe("success");
    expect(result.searchParams.get("next")).toBe("/");

    const row = await database.client.user.findUniqueOrThrow({
      where: { email },
    });
    expect(row.authProvider).toBe("FACEBOOK");
    expect(row.providerId).toBe("facebook-sub-1");
    expect(row.avatarUrl).toBe(facebookProfile.pictureUrl);
    expect(row.emailVerified).toBe(true);
    expect(row.passwordHash).toBeNull();

    const facebookProfileRequest = [...provider.requests.profile]
      .reverse()
      .find((entry) => entry.provider === "facebook");
    expect(facebookProfileRequest?.url.searchParams.get("fields")).toBe(
      "id,name,email,picture",
    );
    expect(
      facebookProfileRequest?.url.searchParams.get("appsecret_proof"),
    ).toBeTruthy();
  });

  it("refuses a Facebook profile when no email is returned (AC-8)", async () => {
    provider.setProfile(
      "facebook",
      makeProfile({
        id: "facebook-sub-no-email",
        name: "Phone Only Nadia",
        email: null,
      }),
    );

    const roundTrip = await beginRoundTrip("facebook");
    const response = await completeRoundTrip("facebook", roundTrip);

    expect(response.status).toBe(302);
    const result = resultOf(response);
    expect(result.searchParams.get("provider")).toBe("facebook");
    expect(result.searchParams.get("error")).toBe("email_missing");
    expect(hasCookie(response, "cp_access")).toBe(false);
    expect(hasCookie(response, "cp_refresh")).toBe(false);
  });

  it("refuses a Google email the provider has not explicitly verified (M1)", async () => {
    const email = uniqueEmail("google-unattested");
    provider.setProfile(
      "google",
      makeProfile({
        id: "google-sub-unattested",
        name: "Unproven Ada",
        email,
        omitEmailVerified: true,
      }),
    );

    const roundTrip = await beginRoundTrip("google");
    const response = await completeRoundTrip("google", roundTrip);

    expect(response.status).toBe(302);
    const result = resultOf(response);
    expect(result.searchParams.get("provider")).toBe("google");
    expect(result.searchParams.get("error")).toBe("email_unverified");
    expect(hasCookie(response, "cp_access")).toBe(false);
    expect(hasCookie(response, "cp_refresh")).toBe(false);
    expect(
      await database.client.user.findUnique({ where: { email } }),
    ).toBeNull();
  });

  it("refuses a Google email with email_verified set to false (AC-8)", async () => {
    const email = uniqueEmail("google-unverified");
    provider.setProfile(
      "google",
      makeProfile({
        id: "google-sub-unverified",
        name: "Unverified Ada",
        email,
        emailVerified: false,
      }),
    );

    const roundTrip = await beginRoundTrip("google");
    const response = await completeRoundTrip("google", roundTrip);

    expect(response.status).toBe(302);
    const result = resultOf(response);
    expect(result.searchParams.get("provider")).toBe("google");
    expect(result.searchParams.get("error")).toBe("email_unverified");
    expect(hasCookie(response, "cp_access")).toBe(false);
    expect(hasCookie(response, "cp_refresh")).toBe(false);
    expect(
      await database.client.user.findUnique({ where: { email } }),
    ).toBeNull();
  });

  it("links an unverified local account, verifies it, and clears its password (U22, S19)", async () => {
    const email = uniqueEmail("link-customer");
    const local = await deps.users.createLocal({
      name: "Local Ada",
      email,
      passwordHash: await deps.passwords.hash("local password 123"),
    });
    const before = await database.client.user.findUniqueOrThrow({
      where: { id: local.id },
    });
    expect(before.emailVerified).toBe(false);
    expect(before.passwordHash).not.toBeNull();

    provider.setProfile(
      "google",
      makeProfile({
        id: "google-link-1",
        name: "Ada Linked",
        email,
        pictureUrl: "https://cdn.example.com/linked.png",
      }),
    );

    const roundTrip = await beginRoundTrip("google");
    const response = await completeRoundTrip("google", roundTrip);
    expect(resultOf(response).searchParams.get("status")).toBe("success");

    const row = await database.client.user.findUniqueOrThrow({
      where: { email },
    });
    expect(row.emailVerified).toBe(true);
    expect(row.passwordHash).toBeNull();
    // The account stays LOCAL, so no provider id is stored for it.
    expect(row.providerId).toBeNull();
    expect(row.avatarUrl).toBe("https://cdn.example.com/linked.png");

    await expect(
      loginUser(
        deps,
        { email, password: "local password 123" },
        { deviceInfo: null, ipAddress: null },
      ),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });

    const again = await beginRoundTrip("google");
    const againResponse = await completeRoundTrip("google", again);
    expect(resultOf(againResponse).searchParams.get("status")).toBe("success");
  });

  it("returns the access denied result without opening a session (U20)", async () => {
    provider.setProfile(
      "google",
      makeProfile({ email: uniqueEmail("denied-customer") }),
    );

    const roundTrip = await beginRoundTrip("google");
    const response = await completeRoundTrip(
      "google",
      roundTrip,
      `error=access_denied&state=${encodeURIComponent(roundTrip.state)}`,
    );

    expect(response.status).toBe(302);
    const result = resultOf(response);
    expect(result.searchParams.get("error")).toBe("access_denied");
    expect(hasCookie(response, "cp_access")).toBe(false);
    expect(hasCookie(response, "cp_refresh")).toBe(false);
  });

  it("rejects a tampered, missing, or foreign state (S20)", async () => {
    provider.setProfile(
      "google",
      makeProfile({ email: uniqueEmail("state-customer") }),
    );

    const roundTrip = await beginRoundTrip("google");
    const code = encodeURIComponent(roundTrip.code);
    const state = encodeURIComponent(roundTrip.state);

    const tampered = await completeRoundTrip(
      "google",
      roundTrip,
      `code=${code}&state=${state}tampered`,
    );
    expect(resultOf(tampered).searchParams.get("error")).toBe("provider_error");

    const foreignTrip = await beginRoundTrip("google");
    const foreign = await completeRoundTrip(
      "google",
      roundTrip,
      `code=${code}&state=${encodeURIComponent(foreignTrip.state)}`,
    );
    expect(resultOf(foreign).searchParams.get("error")).toBe("provider_error");

    const noCookie = await fetch(
      `${apiUrl}/api/auth/google/callback?code=${code}&state=${state}`,
      {
        headers: { "x-proxy-secret": PROXY_SECRET },
        redirect: "manual",
      },
    );
    expect(resultOf(noCookie).searchParams.get("error")).toBe("provider_error");

    const noState = await fetch(
      `${apiUrl}/api/auth/google/callback?code=${code}`,
      {
        headers: {
          "x-proxy-secret": PROXY_SECRET,
          cookie: `cp_oauth_state=${cookieValue(roundTrip.stateCookie)}`,
        },
        redirect: "manual",
      },
    );
    expect(resultOf(noState).searchParams.get("error")).toBe("provider_error");
  });

  it("redirects to a provider error, not a 500, for a malformed state cookie", async () => {
    provider.setProfile(
      "google",
      makeProfile({ email: uniqueEmail("state-malformed") }),
    );

    const roundTrip = await beginRoundTrip("google");
    const code = encodeURIComponent(roundTrip.code);
    const state = encodeURIComponent(roundTrip.state);

    const response = await fetch(
      `${apiUrl}/api/auth/google/callback?code=${code}&state=${state}`,
      {
        headers: {
          "x-proxy-secret": PROXY_SECRET,
          cookie: "cp_oauth_state=%E0%A4%A",
        },
        redirect: "manual",
      },
    );

    expect(response.status).toBe(302);
    expect(resultOf(response).searchParams.get("error")).toBe("provider_error");
  });

  it("honours the role default and sanitizes next (U21, S20)", async () => {
    const adminEmail = uniqueEmail("oauth-admin");
    const admin = await deps.users.createLocal({
      name: "OAuth Admin",
      email: adminEmail,
      passwordHash: await deps.passwords.hash("admin password 123"),
    });
    await database.client.user.update({
      where: { id: admin.id },
      data: { role: "ADMIN", emailVerified: true },
    });
    provider.setProfile(
      "google",
      makeProfile({
        id: "google-admin-1",
        name: "OAuth Admin",
        email: adminEmail,
      }),
    );

    const adminTrip = await beginRoundTrip("google", "/admin");
    const adminResponse = await completeRoundTrip("google", adminTrip);
    expect(resultOf(adminResponse).searchParams.get("next")).toBe("/admin");

    provider.setProfile(
      "google",
      makeProfile({ email: uniqueEmail("role-customer") }),
    );
    const customerTrip = await beginRoundTrip("google", "/admin");
    const customerResponse = await completeRoundTrip("google", customerTrip);
    expect(resultOf(customerResponse).searchParams.get("next")).toBe("/");

    const externalTrip = await beginRoundTrip(
      "google",
      "https://evil.example/steal",
    );
    const externalResponse = await completeRoundTrip("google", externalTrip);
    expect(resultOf(externalResponse).searchParams.get("next")).toBe("/");

    const authScreenTrip = await beginRoundTrip("google", "/auth/callback");
    const authScreenResponse = await completeRoundTrip(
      "google",
      authScreenTrip,
    );
    expect(resultOf(authScreenResponse).searchParams.get("next")).toBe("/");
  });

  /** Creates a unique address and schedules it for cleanup. */
  function uniqueEmail(prefix: string): string {
    const email = `${prefix}-${randomUUID()}@example.com`;
    createdEmails.push(email);
    return email;
  }

  /**
   * Starts one round trip and follows the mock provider's approval redirect.
   *
   * @param name Provider path segment.
   * @param nextPath Relative destination to request, when any.
   * @returns The authorization URL, code, state, and state cookie.
   */
  async function beginRoundTrip(
    name: "google" | "facebook",
    nextPath?: string,
  ): Promise<{
    authorizeUrl: URL;
    code: string;
    state: string;
    stateCookie: string;
  }> {
    const query = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    const response = await fetch(`${apiUrl}/api/auth/${name}${query}`, {
      headers: { "x-proxy-secret": PROXY_SECRET },
      redirect: "manual",
    });
    expect(response.status).toBe(302);

    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    const authorizeUrl = new URL(location ?? "");
    const stateCookie = setCookie(response, "cp_oauth_state");

    const approval = await fetch(authorizeUrl, { redirect: "manual" });
    expect(approval.status).toBe(302);
    const callback = new URL(approval.headers.get("location") ?? "");

    return {
      authorizeUrl,
      code: callback.searchParams.get("code") ?? "",
      state: callback.searchParams.get("state") ?? "",
      stateCookie,
    };
  }

  /**
   * Calls the API callback as the browser would after the provider redirect.
   *
   * @param name Provider path segment.
   * @param roundTrip Values from `beginRoundTrip`.
   * @param query Override query string, for failure cases.
   * @returns The callback response, with redirects left unfollowed.
   */
  async function completeRoundTrip(
    name: "google" | "facebook",
    roundTrip: { code: string; state: string; stateCookie: string },
    query?: string,
  ): Promise<Response> {
    const params =
      query ??
      `code=${encodeURIComponent(roundTrip.code)}&state=${encodeURIComponent(roundTrip.state)}`;

    return fetch(`${apiUrl}/api/auth/${name}/callback?${params}`, {
      headers: {
        "x-proxy-secret": PROXY_SECRET,
        cookie: `cp_oauth_state=${encodeURIComponent(cookieValue(roundTrip.stateCookie))}`,
      },
      redirect: "manual",
    });
  }
});

/** Builds a complete provider fixture. */
function makeProfile(
  overrides: Partial<MockOAuthProfile> = {},
): MockOAuthProfile {
  return {
    id: `provider-${randomUUID()}`,
    name: "OAuth Customer",
    email: null,
    emailVerified: true,
    pictureUrl: null,
    ...overrides,
  };
}

/** Reads one Set-Cookie value by name. */
function setCookie(response: Response, name: string): string {
  const cookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith(`${name}=`));

  if (!cookie) {
    throw new Error(`Missing ${name} in Set-Cookie.`);
  }
  return cookie;
}

/** Returns whether a response carries a cookie by name. */
function hasCookie(response: Response, name: string): boolean {
  return response.headers
    .getSetCookie()
    .some((value) => value.startsWith(`${name}=`));
}

/** Reads the value from a Set-Cookie string. */
function cookieValue(cookie: string): string {
  const first = cookie.split(";")[0] ?? "";
  return first.slice(first.indexOf("=") + 1);
}

/** Reads the redirect target of a response. */
function resultOf(response: Response): URL {
  const location = response.headers.get("location");
  if (!location) {
    throw new Error("Expected a redirect location.");
  }
  return new URL(location);
}
