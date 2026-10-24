import { describe, expect, it } from "vitest";
import { VERIFICATION_TTL_MS } from "../../domain/auth-constants.js";
import { User } from "../../domain/entities/user.js";
import type { AuthUserDto } from "../../domain/types.js";
import { AuthError } from "../errors.js";
import { forgotPassword } from "./forgot-password.js";
import { loginUser } from "./login.js";
import { logoutSession } from "./logout.js";
import { signInWithOAuth } from "./oauth.js";
import { refreshSession } from "./refresh.js";
import { registerUser } from "./register.js";
import { resetPassword } from "./reset-password.js";
import { verifyEmail } from "./verify-email.js";
import {
  createTestDependencies,
  makeUserSnapshot,
  type InMemoryUserRepository,
} from "../../test-support/auth-fakes.js";

/**
 * Asserts that a promise rejects with a specific auth code.
 *
 * @param promise Operation under test.
 * @param code Expected machine readable code.
 */
async function expectAuthError(
  promise: Promise<unknown>,
  code: AuthError["code"],
): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code });
}

/** Seeds a user into the in-memory repository. */
function seedUser(
  users: InMemoryUserRepository,
  overrides: Parameters<typeof makeUserSnapshot>[0] = {},
): User {
  const user = User.reconstitute(makeUserSnapshot(overrides));
  users.seed(user);
  return user;
}

describe("registerUser", () => {
  it("creates the account, stores a hash, and emails a verification link", async () => {
    const { deps, users, emails } = createTestDependencies();

    const result = await registerUser(deps, {
      name: "Ada",
      email: "ada@example.com",
      password: "correct horse",
    });

    expect(result.email).toBe("ada@example.com");
    expect(result.emailVerified).toBe(false);
    expect(emails.verification).toHaveLength(1);
    expect(emails.verification[0]?.url).toBe(
      "https://shop.example.com/verify-email?token=refresh-1",
    );
    expect(users.verificationIssues.size).toBe(1);
  });

  it("maps a duplicate email to EMAIL_TAKEN", async () => {
    const { deps } = createTestDependencies();
    await registerUser(deps, {
      name: "Ada",
      email: "ada@example.com",
      password: "correct horse",
    });

    await expectAuthError(
      registerUser(deps, {
        name: "Ada Again",
        email: "ada@example.com",
        password: "correct horse",
      }),
      "EMAIL_TAKEN",
    );
  });
});

describe("loginUser", () => {
  it("uses one generic message for an unknown email and a wrong password", async () => {
    const { deps, users } = createTestDependencies();
    seedUser(users, { email: "known@example.com" });

    const unknown = await loginUser(
      deps,
      { email: "missing@example.com", password: "wrong" },
      { deviceInfo: null, ipAddress: null },
    ).catch((error: unknown) => error);
    const wrong = await loginUser(
      deps,
      { email: "known@example.com", password: "wrong" },
      { deviceInfo: null, ipAddress: null },
    ).catch((error: unknown) => error);

    expect(unknown).toBeInstanceOf(AuthError);
    expect(wrong).toBeInstanceOf(AuthError);
    expect((unknown as AuthError).message).toBe((wrong as AuthError).message);
    expect((unknown as AuthError).code).toBe("INVALID_CREDENTIALS");
  });

  it("refuses an unverified account without counting a failure", async () => {
    const { deps, users, sessions } = createTestDependencies();
    const user = seedUser(users, {
      email: "new@example.com",
      emailVerified: false,
    });

    const error = await loginUser(
      deps,
      { email: "new@example.com", password: "correct horse" },
      { deviceInfo: null, ipAddress: null },
    ).catch((failure: unknown) => failure);

    expect(error).toBeInstanceOf(AuthError);
    expect((error as AuthError).code).toBe("EMAIL_UNVERIFIED");
    expect((error as AuthError).details).toEqual({ email: user.email });
    expect(users.loginStates.has(user.id)).toBe(false);
    expect(sessions.activeCount()).toBe(0);
  });

  it("locks after five failures and does not extend the lock", async () => {
    const { deps, users, clock } = createTestDependencies();
    const user = seedUser(users, { email: "locked@example.com" });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expectAuthError(
        loginUser(
          deps,
          { email: "locked@example.com", password: "wrong" },
          { deviceInfo: null, ipAddress: null },
        ),
        "INVALID_CREDENTIALS",
      );
    }

    const lockedState = users.loginStates.get(user.id);
    expect(lockedState?.failedLoginAttempts).toBe(5);
    expect(lockedState?.lockedUntil).not.toBeNull();

    clock.advance(60_000);
    await expectAuthError(
      loginUser(
        deps,
        { email: "locked@example.com", password: "correct horse" },
        { deviceInfo: null, ipAddress: null },
      ),
      "INVALID_CREDENTIALS",
    );

    expect(users.loginStates.get(user.id)).toBe(lockedState);
  });

  it("opens a session and clears the failure counter on success", async () => {
    const { deps, users, sessions } = createTestDependencies();
    const user = seedUser(users, {
      email: "verified@example.com",
      failedLoginAttempts: 3,
    });

    const result = await loginUser(
      deps,
      { email: "verified@example.com", password: "correct horse" },
      { deviceInfo: "Test Agent", ipAddress: "203.0.113.10" },
    );

    expect(result.user).toEqual(user.toAuthUser());
    expect(result.accessToken).toBe(`access:${user.id}:CUSTOMER`);
    expect(result.refreshToken).not.toBe("");
    expect(sessions.activeCount()).toBe(1);
    expect(users.loginStates.get(user.id)).toMatchObject({
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
  });
});

describe("verifyEmail", () => {
  it("consumes a valid link exactly once", async () => {
    const { deps, users, clock } = createTestDependencies();
    const user = seedUser(users, { emailVerified: false });
    const rawToken = deps.tokens.generateOpaqueToken();
    await users.saveVerificationIssue(user.id, {
      tokenHash: deps.tokens.hashOpaqueToken(rawToken),
      expiresAt: new Date(clock.now().getTime() + VERIFICATION_TTL_MS),
      sentAt: clock.now(),
    });

    const result: AuthUserDto = await verifyEmail(deps, rawToken);

    expect(result.emailVerified).toBe(true);
    expect(users.verified.has(user.id)).toBe(true);
    await expectAuthError(verifyEmail(deps, rawToken), "INVALID_LINK");
  });

  it("rejects an expired link and returns the account email", async () => {
    const { deps, users, clock } = createTestDependencies();
    const user = seedUser(users, {
      email: "late@example.com",
      emailVerified: false,
    });
    const rawToken = deps.tokens.generateOpaqueToken();
    await users.saveVerificationIssue(user.id, {
      tokenHash: deps.tokens.hashOpaqueToken(rawToken),
      expiresAt: new Date(clock.now().getTime() - 1),
      sentAt: clock.now(),
    });

    await expect(verifyEmail(deps, rawToken)).rejects.toMatchObject({
      code: "EXPIRED_TOKEN",
      details: { email: "late@example.com" },
    });
    expect(users.verified.has(user.id)).toBe(false);
  });
});

describe("refreshSession", () => {
  it("rotates a token and treats an immediate replay as a concurrent refresh", async () => {
    const { deps, users, sessions, clock } = createTestDependencies();
    const user = seedUser(users, { email: "refresh@example.com" });
    const first = await loginUser(
      deps,
      { email: "refresh@example.com", password: "correct horse" },
      { deviceInfo: "Test Agent", ipAddress: "203.0.113.10" },
    );

    clock.advance(1_000);
    const rotated = await refreshSession(deps, first.refreshToken);

    expect(rotated.refreshToken).not.toBe(first.refreshToken);
    expect(sessions.sessions.size).toBe(2);
    const firstRow = [...sessions.sessions.values()].find(
      (row) => row.userId === user.id && row.revokedAt !== null,
    );
    expect(firstRow?.replacedByTokenId).not.toBeNull();

    clock.advance(5_000);
    const concurrent = await refreshSession(deps, first.refreshToken);

    expect(concurrent.refreshToken).not.toBe(rotated.refreshToken);
    expect(sessions.activeCount()).toBe(2);
  });

  it("revokes every session when a rotated token is reused after the grace window", async () => {
    const { deps, users, sessions, clock } = createTestDependencies();
    seedUser(users, { email: "reuse@example.com" });
    const first = await loginUser(
      deps,
      { email: "reuse@example.com", password: "correct horse" },
      { deviceInfo: null, ipAddress: null },
    );

    clock.advance(1_000);
    await refreshSession(deps, first.refreshToken);
    clock.advance(11_000);

    await expectAuthError(
      refreshSession(deps, first.refreshToken),
      "INVALID_SESSION",
    );
    expect(sessions.activeCount()).toBe(0);
  });
});

describe("password reset", () => {
  it("only emails an account that has a stored password", async () => {
    const { deps, users, emails } = createTestDependencies();
    const local = seedUser(users, { email: "local@example.com" });
    seedUser(users, {
      id: "user-2",
      email: "oauth@example.com",
      passwordHash: null,
      authProvider: "GOOGLE",
      providerId: "google-1",
    });

    await forgotPassword(deps, "missing@example.com");
    await forgotPassword(deps, "oauth@example.com");
    expect(emails.reset).toHaveLength(0);

    await forgotPassword(deps, "local@example.com");
    expect(emails.reset).toHaveLength(1);
    expect(emails.reset[0]?.url).toContain("/reset-password?token=");
    expect(users.resetIssues.has(local.id)).toBe(true);
  });

  it("applies a new hash once and revokes every session", async () => {
    const { deps, users, sessions, clock } = createTestDependencies();
    const user = seedUser(users, { email: "reset@example.com" });
    await loginUser(
      deps,
      { email: "reset@example.com", password: "correct horse" },
      { deviceInfo: null, ipAddress: null },
    );
    const rawToken = deps.tokens.generateOpaqueToken();
    await users.savePasswordResetIssue(user.id, {
      tokenHash: deps.tokens.hashOpaqueToken(rawToken),
      expiresAt: new Date(clock.now().getTime() + 3_600_000),
    });

    await resetPassword(deps, rawToken, "new correct horse");

    expect(users.resetPasswords.get(user.id)).toBe("hashed:new correct horse");
    expect(sessions.activeCount()).toBe(0);
    await expectAuthError(
      resetPassword(deps, rawToken, "another password"),
      "INVALID_LINK",
    );
  });

  it("rejects an expired reset link", async () => {
    const { deps, users, clock } = createTestDependencies();
    const user = seedUser(users, { email: "expired@example.com" });
    const rawToken = deps.tokens.generateOpaqueToken();
    await users.savePasswordResetIssue(user.id, {
      tokenHash: deps.tokens.hashOpaqueToken(rawToken),
      expiresAt: new Date(clock.now().getTime() - 1),
    });

    await expectAuthError(
      resetPassword(deps, rawToken, "new correct horse"),
      "EXPIRED_TOKEN",
    );
    expect(users.resetPasswords.has(user.id)).toBe(false);
  });
});

describe("signInWithOAuth", () => {
  it("creates a verified account from a new provider profile", async () => {
    const { deps, users, sessions } = createTestDependencies();

    const result = await signInWithOAuth(
      deps,
      {
        provider: "GOOGLE",
        providerId: "google-42",
        email: "New@Example.com",
        name: "New Customer",
        avatarUrl: "https://images.example.com/avatar.png",
      },
      { deviceInfo: "Test Agent", ipAddress: null },
    );

    expect(result.user.email).toBe("new@example.com");
    expect(result.user.emailVerified).toBe(true);
    expect(result.user.avatarUrl).toBe("https://images.example.com/avatar.png");
    expect(users.users.size).toBe(1);
    expect(sessions.activeCount()).toBe(1);
  });

  it("links an unverified local account by clearing its password", async () => {
    const { deps, users } = createTestDependencies();
    const user = seedUser(users, {
      email: "link@example.com",
      emailVerified: false,
    });

    const result = await signInWithOAuth(
      deps,
      {
        provider: "FACEBOOK",
        providerId: "facebook-7",
        email: "link@example.com",
        name: "Linked Customer",
        avatarUrl: null,
      },
      { deviceInfo: null, ipAddress: null },
    );

    expect(result.user.id).toBe(user.id);
    expect(result.user.emailVerified).toBe(true);
    expect(users.oauthLogins.get(user.id)).toMatchObject({
      providerId: "facebook-7",
      emailVerified: true,
      clearPassword: true,
    });
  });
});

describe("logoutSession", () => {
  it("revokes the current session and tolerates an unknown token", async () => {
    const { deps, users, sessions } = createTestDependencies();
    seedUser(users, { email: "signout@example.com" });
    const result = await loginUser(
      deps,
      { email: "signout@example.com", password: "correct horse" },
      { deviceInfo: null, ipAddress: null },
    );

    await logoutSession(deps, result.refreshToken);
    expect(sessions.activeCount()).toBe(0);

    await expect(logoutSession(deps, "unknown-token")).resolves.toBeUndefined();
    await expect(logoutSession(deps, null)).resolves.toBeUndefined();
  });
});
