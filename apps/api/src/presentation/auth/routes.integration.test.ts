/**
 * Integration tests for the auth routes over a live Express app and database.
 *
 * These exercise the HTTP surface the acceptance criteria land on, not the use
 * cases directly. The shared secret guard, the cookie headers, the JSON
 * envelope for each error code, and the rate limit responses are all verified
 * against a real PostgreSQL database and a real listening server.
 *
 * The database is shared with other suites, so every address is randomized and
 * every created account is deleted afterwards.
 */
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
import { BcryptPasswordHasher } from "../../infrastructure/auth/bcrypt-password-hasher.js";
import { JwtTokenService } from "../../infrastructure/auth/jwt-token-service.js";
import {
  createDatabase,
  type Database,
} from "../../infrastructure/database/prisma.js";
import { PrismaSessionRepository } from "../../infrastructure/database/session.repository.js";
import { PrismaUserRepository } from "../../infrastructure/database/user.repository.js";
import { RecordingEmailSender } from "../../test-support/auth-fakes.js";
import { createOAuthAuthenticator } from "../../infrastructure/oauth/passport.js";
import { startMockOAuthProvider } from "../../test-support/mock-oauth-provider.js";
import { createAuthRouter } from "./auth.routes.js";

loadDotEnv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});

const databaseUrl = process.env["DATABASE_URL"];
const describeWithDatabase = databaseUrl ? describe : describe.skip;

const PROXY_SECRET = "routes-integration-proxy-secret-01";
const WEB_APP_URL = "https://shop.example.com";
const PASSWORD = "correct horse battery";

describeWithDatabase("auth routes over HTTP", () => {
  let database: Database;
  let deps: AuthDependencies;
  let server: Server;
  let apiUrl = "";
  const createdEmails: string[] = [];

  beforeAll(async () => {
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required.");
    }

    database = createDatabase(databaseUrl);
    const tokens = new JwtTokenService({
      jwtSecret: "routes-integration-access-secret-0123456789",
      refreshSecret: "routes-integration-refresh-secret-0123456789",
    });

    deps = {
      users: new PrismaUserRepository(database.client),
      sessions: new PrismaSessionRepository(database.client),
      passwords: new BcryptPasswordHasher(),
      tokens,
      emails: new RecordingEmailSender(),
      clock: { now: () => new Date() },
      webAppUrl: WEB_APP_URL,
    };

    const provider = await startMockOAuthProvider();
    const env: ApiEnv = {
      nodeEnv: "test",
      host: "127.0.0.1",
      port: 0,
      databaseUrl,
      corsOrigins: [WEB_APP_URL],
      trustProxy: false,
      webAppUrl: WEB_APP_URL,
      proxySharedSecret: PROXY_SECRET,
      jwtSecret: "routes-integration-access-secret-0123456789",
      jwtRefreshSecret: "routes-integration-refresh-secret-0123456789",
      googleClient: { id: "google-id", secret: "google-secret" },
      facebookClient: { id: "facebook-id", secret: "facebook-secret" },
      resendApiKey: "re_test_key",
      emailFrom: "Crochet PeakZ <hello@shop.example.com>",
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
        authenticator: createOAuthAuthenticator({
          webAppUrl: WEB_APP_URL,
          google: { id: "google-id", secret: "google-secret" },
          facebook: { id: "facebook-id", secret: "facebook-secret" },
        }),
      }),
    );

    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    apiUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    afterAll(async () => {
      await provider.close();
    });
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      await database.client.user.deleteMany({
        where: { email: { in: createdEmails } },
      });
    }
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
      server.closeAllConnections();
    });
    await database.disconnect();
  });

  /**
   * Hands out a distinct forwarded client address per call.
   *
   * The rate limits are per client IP, so a suite that shares one address would
   * exhaust the register and sign in buckets partway through and then fail on
   * limits it never meant to test. Each call gets its own bucket; the tests
   * that do mean to trip a limit pass an address explicitly.
   */
  let ipCounter = 0;
  function nextIp(): string {
    ipCounter += 1;
    return `10.9.${String(Math.floor(ipCounter / 250))}.${String(ipCounter % 250)}`;
  }

  /** Creates a unique address and schedules it for cleanup. */
  function uniqueEmail(prefix: string): string {
    const email = `${prefix}-${randomUUID()}@example.com`;
    createdEmails.push(email);
    return email;
  }

  /**
   * Posts JSON to an auth route through the proxy secret check.
   *
   * @param path Route path after `/api/auth`.
   * @param body JSON body.
   * @param options Cookie header, origin, and whether to omit the secret.
   * @returns The response, redirects left unfollowed.
   */
  async function post(
    path: string,
    body: unknown,
    options: {
      cookie?: string;
      origin?: string | null;
      withSecret?: boolean;
      ip?: string;
    } = {},
  ): Promise<Response> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };

    if (options.withSecret !== false) {
      headers["x-proxy-secret"] = PROXY_SECRET;
    }
    if (options.origin !== null) {
      headers["origin"] = options.origin ?? WEB_APP_URL;
    }
    if (options.cookie) {
      headers["cookie"] = options.cookie;
    }
    headers["x-forwarded-for"] = options.ip ?? nextIp();

    return fetch(`${apiUrl}/api/auth/${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      redirect: "manual",
    });
  }

  /**
   * Posts a raw string body so a malformed JSON request can be sent.
   *
   * The JSON `post` helper always serializes a valid body, which is exactly
   * what a body parser rejection test must avoid.
   *
   * @param path Route path after `/api/auth`.
   * @param body Raw request body.
   * @returns The response, redirects left unfollowed.
   */
  async function postRaw(path: string, body: string): Promise<Response> {
    return fetch(`${apiUrl}/api/auth/${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-proxy-secret": PROXY_SECRET,
        origin: WEB_APP_URL,
        "x-forwarded-for": nextIp(),
      },
      body,
      redirect: "manual",
    });
  }

  /** Calls a route with GET. */
  async function get(
    path: string,
    options: { cookie?: string; withSecret?: boolean; ip?: string } = {},
  ): Promise<Response> {
    const headers: Record<string, string> = {};
    if (options.withSecret !== false) {
      headers["x-proxy-secret"] = PROXY_SECRET;
    }
    if (options.cookie) {
      headers["cookie"] = options.cookie;
    }
    headers["x-forwarded-for"] = options.ip ?? nextIp();

    return fetch(`${apiUrl}/api/auth/${path}`, {
      headers,
      redirect: "manual",
    });
  }

  /** Registers and verifies an account, returning its credentials. */
  async function createVerifiedAccount(
    prefix: string,
  ): Promise<{ email: string; password: string }> {
    const email = uniqueEmail(prefix);
    const registered = await post("register", {
      name: "Route Customer",
      email,
      password: PASSWORD,
    });
    expect(registered.status).toBe(201);

    const row = await database.client.user.findUniqueOrThrow({
      where: { email },
    });
    await database.client.user.update({
      where: { id: row.id },
      data: { emailVerified: true },
    });

    return { email, password: PASSWORD };
  }

  /** Signs in and returns the cookie header from the response. */
  async function signIn(email: string, password: string): Promise<string> {
    const response = await post("login", { email, password });
    expect(response.status).toBe(200);
    return response.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .join("; ");
  }

  describe("proxy secret guard", () => {
    it("refuses a direct call with no shared secret (AC-14)", async () => {
      const response = await post(
        "forgot-password",
        { email: "someone@example.com" },
        { withSecret: false },
      );

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error: { message: string } };
      expect(body.error.message).toMatch(/storefront/i);
    });

    it("accepts the call once the shared secret is present", async () => {
      const response = await post("forgot-password", {
        email: "nobody@example.com",
      });

      expect(response.status).toBe(202);
    });

    it("refuses a write whose Origin is not the web app (AC-14)", async () => {
      const response = await post(
        "forgot-password",
        { email: "nobody@example.com" },
        { origin: "https://evil.example" },
      );

      expect(response.status).toBe(403);
    });
  });

  describe("POST /register", () => {
    it("creates a CUSTOMER account and omits a token (AC-1)", async () => {
      const email = uniqueEmail("register");

      const response = await post("register", {
        name: "  Ada Lovelace  ",
        email: `  ${email.toUpperCase()}  `,
        password: PASSWORD,
      });

      expect(response.status).toBe(201);
      const body = (await response.json()) as Record<string, unknown>;

      expect(Object.keys(body).sort()).toEqual([
        "avatarUrl",
        "email",
        "emailVerified",
        "id",
        "name",
        "role",
      ]);
      expect(body["email"]).toBe(email);
      expect(body["name"]).toBe("Ada Lovelace");
      expect(body["role"]).toBe("CUSTOMER");
      expect(body["emailVerified"]).toBe(false);
      expect(body["avatarUrl"]).toBeNull();

      const row = await database.client.user.findUniqueOrThrow({
        where: { email },
      });
      expect(row.passwordHash).not.toBeNull();
      expect(row.passwordHash).not.toBe(PASSWORD);
      expect(row.emailVerificationToken).not.toBeNull();
    });

    it("returns 409 for an email that already has an account (AC-1)", async () => {
      const email = uniqueEmail("duplicate");
      const first = await post("register", {
        name: "First",
        email,
        password: PASSWORD,
      });
      expect(first.status).toBe(201);

      const second = await post("register", {
        name: "Second",
        email,
        password: PASSWORD,
      });

      expect(second.status).toBe(409);
      const body = (await second.json()) as { error: { code: string } };
      expect(body.error.code).toBe("EMAIL_TAKEN");
    });

    it("rejects a password above 72 bytes with 422 (AC-1)", async () => {
      const response = await post("register", {
        name: "Too Long",
        email: uniqueEmail("long-password"),
        password: "a".repeat(73),
      });

      expect(response.status).toBe(422);
    });

    it("rejects a password below 8 bytes with 422", async () => {
      const response = await post("register", {
        name: "Too Short",
        email: uniqueEmail("short-password"),
        password: "short",
      });

      expect(response.status).toBe(422);
    });

    it("tells the customer which field failed validation", async () => {
      const response = await post("register", {
        name: "Bad Email",
        email: "not-an-email",
        password: PASSWORD,
      });

      expect(response.status).toBe(422);
      const body = (await response.json()) as {
        error: { code: string; details: { issues: { path: string }[] } };
      };
      expect(body.error.code).toBe("VALIDATION_FAILED");
      expect(body.error.details.issues.map((issue) => issue.path)).toContain(
        "email",
      );
    });
  });

  describe("POST /login", () => {
    it("sets both cookies for a verified account (AC-4)", async () => {
      const account = await createVerifiedAccount("login-ok");

      const response = await post("login", account);

      expect(response.status).toBe(200);
      const cookies = response.headers.getSetCookie();
      const access = cookies.find((cookie) => cookie.startsWith("cp_access="));
      const refresh = cookies.find((cookie) =>
        cookie.startsWith("cp_refresh="),
      );

      expect(access).toBeDefined();
      expect(refresh).toBeDefined();
      expect(access?.toLowerCase()).toContain("httponly");
      expect(access?.toLowerCase()).toContain("path=/");
      expect(access?.toLowerCase()).toContain("samesite=lax");
      expect(access?.toLowerCase()).not.toContain("secure");
      expect(access).toContain("Max-Age=900");

      const body = (await response.json()) as { role: string };
      expect(body.role).toBe("CUSTOMER");
    });

    it("returns the same message for a wrong password and an unknown email (AC-4)", async () => {
      const account = await createVerifiedAccount("login-generic");

      const wrongPassword = await post("login", {
        email: account.email,
        password: "not the password",
      });
      const unknownEmail = await post("login", {
        email: uniqueEmail("never-registered"),
        password: PASSWORD,
      });

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      expect(await wrongPassword.json()).toEqual(await unknownEmail.json());
    });

    it("refuses an unverified account with 403 and no cookie (AC-2)", async () => {
      const email = uniqueEmail("unverified");
      const registered = await post("register", {
        name: "Unverified",
        email,
        password: PASSWORD,
      });
      expect(registered.status).toBe(201);

      const response = await post("login", { email, password: PASSWORD });

      expect(response.status).toBe(403);
      const body = (await response.json()) as {
        error: { code: string; details: { email: string } };
      };
      expect(body.error.code).toBe("EMAIL_UNVERIFIED");
      expect(body.error.details.email).toBe(email);
      expect(response.headers.getSetCookie()).toHaveLength(0);

      const row = await database.client.user.findUniqueOrThrow({
        where: { email },
      });
      expect(row.failedLoginAttempts).toBe(0);
    });

    it("never returns the password hash or the session token in the body", async () => {
      const account = await createVerifiedAccount("login-secrets");

      const response = await post("login", account);
      const text = await response.text();

      expect(text).not.toContain("passwordHash");
      expect(text).not.toContain("$2");
      const body = JSON.parse(text) as Record<string, unknown>;
      expect(body).not.toHaveProperty("accessToken");
      expect(body).not.toHaveProperty("refreshToken");
    });

    it("answers 400, not 500, for a malformed JSON body", async () => {
      const response = await postRaw("login", "{not json");

      expect(response.status).toBe(400);
      const body = (await response.json()) as {
        error: { message: string; statusCode: number };
      };
      expect(body.error.statusCode).toBe(400);
      expect(body.error.message).toBe("The request could not be read.");
    });
  });

  describe("GET /me", () => {
    it("returns the signed in account, so a reload keeps the session (AC-5)", async () => {
      const account = await createVerifiedAccount("me");
      const cookie = await signIn(account.email, account.password);

      const response = await get("me", { cookie });

      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<string, unknown>;
      expect(Object.keys(body).sort()).toEqual([
        "avatarUrl",
        "email",
        "emailVerified",
        "id",
        "name",
        "role",
      ]);
      expect(body["email"]).toBe(account.email);
    });

    it("refuses a caller with no cookie", async () => {
      const response = await get("me");

      expect(response.status).toBe(401);
    });

    it("refuses a forged access token", async () => {
      const response = await get("me", { cookie: "cp_access=not.a.token" });

      expect(response.status).toBe(401);
    });

    it("answers 401, not 500, for a malformed percent sequence", async () => {
      const response = await get("me", { cookie: "cp_access=%E0%A4%A" });

      expect(response.status).toBe(401);
    });
  });

  describe("POST /refresh", () => {
    it("rotates the refresh token and replaces both cookies (AC-5)", async () => {
      const account = await createVerifiedAccount("refresh");
      const cookie = await signIn(account.email, account.password);

      const response = await post("refresh", {}, { cookie });

      expect(response.status).toBe(200);
      const cookies = response.headers.getSetCookie();
      expect(cookies.some((value) => value.startsWith("cp_access="))).toBe(
        true,
      );
      const rotated = cookies.find((value) => value.startsWith("cp_refresh="));
      expect(rotated).toBeDefined();
      expect(rotated?.toLowerCase()).toContain("httponly");
    });

    it("answers 401 without a Set-Cookie when nothing is sent", async () => {
      const response = await post("refresh", {});

      expect(response.status).toBe(401);
      expect(response.headers.getSetCookie()).toHaveLength(0);
    });

    it("clears a lingering access cookie when the refresh cookie is absent", async () => {
      const response = await post("refresh", {}, { cookie: "cp_access=stale" });

      expect(response.status).toBe(401);
      const cookies = response.headers.getSetCookie();
      expect(cookies.some((value) => value.startsWith("cp_access="))).toBe(
        true,
      );
      expect(
        cookies.every((value) => /Max-Age=0|Expires=Thu/i.test(value)),
      ).toBe(true);
    });

    it("refuses an unknown refresh token and clears cookies (AC-6)", async () => {
      const response = await post(
        "refresh",
        {},
        { cookie: "cp_refresh=never-issued" },
      );

      expect(response.status).toBe(401);
      const cookies = response.headers.getSetCookie();
      expect(cookies.some((value) => value.startsWith("cp_access="))).toBe(
        true,
      );
      expect(cookies.some((value) => value.startsWith("cp_refresh="))).toBe(
        true,
      );
      expect(
        cookies.every((value) => /Max-Age=0|Expires=Thu/i.test(value)),
      ).toBe(true);
    });

    it("answers 401, not 500, for a malformed refresh cookie", async () => {
      const response = await post(
        "refresh",
        {},
        { cookie: "cp_refresh=%E0%A4%A" },
      );

      expect(response.status).toBe(401);
    });
  });

  describe("POST /logout", () => {
    it("revokes the session and clears both cookies (AC-7)", async () => {
      const account = await createVerifiedAccount("logout");
      const cookie = await signIn(account.email, account.password);

      const response = await post("logout", {}, { cookie });

      expect(response.status).toBe(204);
      const cookies = response.headers.getSetCookie();
      expect(cookies.some((value) => value.startsWith("cp_access="))).toBe(
        true,
      );
      expect(cookies.some((value) => value.startsWith("cp_refresh="))).toBe(
        true,
      );

      const afterLogout = await post("refresh", {}, { cookie });
      expect(afterLogout.status).toBe(401);
    });

    it("is idempotent without a session cookie", async () => {
      const response = await post("logout", {});

      expect(response.status).toBe(204);
    });

    it("answers 204, not 500, for a malformed refresh cookie", async () => {
      const response = await post(
        "logout",
        {},
        { cookie: "cp_refresh=%E0%A4%A" },
      );

      expect(response.status).toBe(204);
    });
  });

  describe("verification and reset links", () => {
    it("answers 202 for a resend without revealing the account exists (AC-3)", async () => {
      const known = await createVerifiedAccount("resend-known");

      const existing = await post("resend-verification", {
        email: known.email,
      });
      const unknown = await post("resend-verification", {
        email: uniqueEmail("resend-unknown"),
      });

      expect(existing.status).toBe(202);
      expect(unknown.status).toBe(202);
      expect(await existing.json()).toEqual(await unknown.json());
    });

    it("rejects a verification token that was never issued (AC-3)", async () => {
      const response = await post("verify-email", { token: "never-issued" });

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: { code: string } };
      expect(body.error.code).toBe("INVALID_TOKEN");
    });

    it("answers 202 for a reset request and never names the account (AC-9)", async () => {
      const response = await post("forgot-password", {
        email: uniqueEmail("forgot"),
      });

      expect(response.status).toBe(202);
      const body = (await response.json()) as { message: string };
      expect(body.message).toMatch(/if an account/i);
    });

    it("rejects a reset token that was never issued (AC-9)", async () => {
      const response = await post("reset-password", {
        token: "never-issued",
        password: PASSWORD,
      });

      expect(response.status).toBe(400);
    });

    it("applies the registration password rule to a reset (AC-9)", async () => {
      const response = await post("reset-password", {
        token: "never-issued",
        password: "a".repeat(73),
      });

      expect(response.status).toBe(422);
    });
  });

  describe("rate limits (AC-12)", () => {
    it("answers 429 with Retry-After once sign in is over the limit", async () => {
      const ip = "198.51.100.42";
      let limited: Response | null = null;

      for (let attempt = 0; attempt < 12; attempt += 1) {
        const response = await post(
          "login",
          { email: "nobody@example.com", password: PASSWORD },
          { ip },
        );
        if (response.status === 429) {
          limited = response;
          break;
        }
      }

      expect(limited).not.toBeNull();
      const retryAfter = Number(limited?.headers.get("retry-after"));
      expect(Number.isInteger(retryAfter)).toBe(true);
      expect(retryAfter).toBeGreaterThan(0);
    });

    it("answers 429 for forgot password after three requests (AC-12)", async () => {
      const ip = "198.51.100.43";
      const statuses: number[] = [];

      for (let attempt = 0; attempt < 4; attempt += 1) {
        const response = await post(
          "forgot-password",
          { email: "nobody@example.com" },
          { ip },
        );
        statuses.push(response.status);
      }

      expect(statuses.slice(0, 3)).toEqual([202, 202, 202]);
      expect(statuses[3]).toBe(429);
    });

    it("answers 429 for registration after five requests (AC-12)", async () => {
      const ip = "198.51.100.46";
      const statuses: number[] = [];

      for (let attempt = 0; attempt < 6; attempt += 1) {
        const response = await post(
          "register",
          {
            name: "Rate Limited",
            email: uniqueEmail("rate-register"),
            password: PASSWORD,
          },
          { ip },
        );
        statuses.push(response.status);
      }

      expect(statuses.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
      expect(statuses[5]).toBe(429);
    });

    it("answers 429 for refresh after sixty requests (AC-12)", async () => {
      const ip = "198.51.100.47";
      const statuses: number[] = [];

      for (let attempt = 0; attempt < 61; attempt += 1) {
        const response = await post("refresh", {}, { ip });
        statuses.push(response.status);
      }

      expect(statuses.slice(0, 60).every((status) => status === 401)).toBe(
        true,
      );
      expect(statuses[60]).toBe(429);
    });

    it("answers 429 for verification after ten requests (AC-12)", async () => {
      const ip = "198.51.100.48";
      const statuses: number[] = [];
      let limited: Response | null = null;

      for (let attempt = 0; attempt < 11; attempt += 1) {
        const response = await post(
          "verify-email",
          { token: "never-issued" },
          { ip },
        );
        statuses.push(response.status);
        if (response.status === 429) {
          limited = response;
        }
      }

      expect(statuses.slice(0, 10).every((status) => status === 400)).toBe(
        true,
      );
      expect(limited).not.toBeNull();
      const retryAfter = Number(limited?.headers.get("retry-after"));
      expect(Number.isInteger(retryAfter)).toBe(true);
      expect(retryAfter).toBeGreaterThan(0);
    });

    it("answers 429 for password reset after ten requests (AC-12)", async () => {
      const ip = "198.51.100.49";
      const statuses: number[] = [];
      let limited: Response | null = null;

      for (let attempt = 0; attempt < 11; attempt += 1) {
        const response = await post(
          "reset-password",
          { token: "never-issued", password: PASSWORD },
          { ip },
        );
        statuses.push(response.status);
        if (response.status === 429) {
          limited = response;
        }
      }

      expect(statuses.slice(0, 10).every((status) => status === 400)).toBe(
        true,
      );
      expect(limited).not.toBeNull();
      const retryAfter = Number(limited?.headers.get("retry-after"));
      expect(Number.isInteger(retryAfter)).toBe(true);
      expect(retryAfter).toBeGreaterThan(0);
    });

    it("allows one resend per account per minute and sets Retry-After (AC-3, AC-12)", async () => {
      const email = uniqueEmail("resend-throttle");
      const registered = await post("register", {
        name: "Resend Throttle",
        email,
        password: PASSWORD,
      });
      expect(registered.status).toBe(201);

      await database.client.user.update({
        where: { email },
        data: { emailVerificationSentAt: new Date(Date.now() - 120_000) },
      });

      const first = await post("resend-verification", { email });
      const second = await post("resend-verification", { email });

      expect(first.status).toBe(202);
      expect(second.status).toBe(429);
      const retryAfter = Number(second.headers.get("retry-after"));
      expect(Number.isInteger(retryAfter)).toBe(true);
      expect(retryAfter).toBeGreaterThan(0);
    });

    it("throttles repeated resends for an unknown address too (AC-3, AC-12)", async () => {
      const email = uniqueEmail("resend-unknown-throttle");

      const first = await post("resend-verification", { email });
      const second = await post("resend-verification", { email });

      expect(first.status).toBe(202);
      expect(second.status).toBe(429);
      const retryAfter = Number(second.headers.get("retry-after"));
      expect(Number.isInteger(retryAfter)).toBe(true);
      expect(retryAfter).toBeGreaterThan(0);
    });

    it("throttles sign out after sixty requests (AC-12)", async () => {
      const ip = "198.51.100.46";

      for (let attempt = 0; attempt < 60; attempt += 1) {
        const response = await post("logout", {}, { ip });
        expect(response.status).toBe(204);
      }

      const limited = await post("logout", {}, { ip });
      expect(limited.status).toBe(429);
      expect(limited.headers.get("retry-after")).not.toBeNull();
    });

    it("throttles unauthenticated probes of /me (AC-12)", async () => {
      const ip = "198.51.100.48";

      for (let attempt = 0; attempt < 120; attempt += 1) {
        const response = await get("me", {
          cookie: "cp_access=not.a.token",
          ip,
        });
        expect(response.status).toBe(401);
      }

      const limited = await get("me", {
        cookie: "cp_access=not.a.token",
        ip,
      });
      expect(limited.status).toBe(429);
      expect(limited.headers.get("retry-after")).not.toBeNull();
    });

    it("throttles the OAuth entry point after sixty requests (AC-12)", async () => {
      const ip = "198.51.100.47";

      for (let attempt = 0; attempt < 60; attempt += 1) {
        const response = await get("google", { ip });
        expect(response.status).toBe(302);
      }

      const limited = await get("google", { ip });
      expect(limited.status).toBe(429);
      expect(limited.headers.get("retry-after")).not.toBeNull();
    });

    it("keeps rate limit buckets per client address", async () => {
      const exhausted = "198.51.100.44";
      for (let attempt = 0; attempt < 4; attempt += 1) {
        await post(
          "forgot-password",
          { email: "nobody@example.com" },
          { ip: exhausted },
        );
      }

      const other = await post(
        "forgot-password",
        { email: "nobody@example.com" },
        { ip: "198.51.100.45" },
      );

      expect(other.status).toBe(202);
    });
  });

  describe("health", () => {
    it("reports readiness for a reachable database", async () => {
      const response = await fetch(`${apiUrl}/api/health/ready`);

      expect(response.status).toBe(200);
    });

    it("answers auth routes on the same app without the health router leaking", async () => {
      const response = await fetch(`${apiUrl}/api/health`);

      expect(response.status).toBe(200);
      const body = (await response.json()) as { status: string };
      expect(body.status).toBe("ok");
    });
  });
});
