import { describe, expect, it } from "vitest";
import { VERIFICATION_TTL_MS } from "../../domain/auth-constants.js";
import { User } from "../../domain/entities/user.js";
import { EmailAlreadyExistsError } from "../../domain/errors.js";
import type { AuthUserDto } from "../../domain/types.js";
import { AuthError } from "../errors.js";
import { forgotPassword } from "./forgot-password.js";
import { loginUser } from "./login.js";
import { logoutSession } from "./logout.js";
import { signInWithOAuth } from "./oauth.js";
import { refreshSession } from "./refresh.js";
import { registerUser } from "./register.js";
import { resendVerification } from "./resend-verification.js";
import { resetPassword } from "./reset-password.js";
import { verifyEmail } from "./verify-email.js";
import {
  createTestDependencies,
  InMemoryUserRepository,
  makeUserSnapshot,
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

/**
 * Repository that refuses the first failed login write, standing in for a
 * parallel attempt that commits its own increment first.
 */
class RacingUserRepository extends InMemoryUserRepository {
  /** When set, the next failed login write is refused. */
  refuseNextWrite = false;

  override async saveFailedLogin(
    userId: string,
    state: { failedLoginAttempts: number; lockedUntil: Date | null },
    expectedFailedLoginAttempts: number,
  ): Promise<boolean> {
    if (this.refuseNextWrite) {
      this.refuseNextWrite = false;
      this.loginStates.set(userId, {
        failedLoginAttempts: expectedFailedLoginAttempts + 1,
        lockedUntil: null,
      });
      return false;
    }
    return super.saveFailedLogin(userId, state, expectedFailedLoginAttempts);
  }
}

/**
 * Repository that commits a parallel failure just before the successful sign
 * in write lands, standing in for two writes racing on the same account.
 */
class RacingSuccessRepository extends InMemoryUserRepository {
  /** When set, a parallel failure commits before the success write. */
  commitParallelFailure = false;

  override async saveSuccessfulLogin(
    userId: string,
    state: {
      failedLoginAttempts: number;
      lockedUntil: Date | null;
      lastLoginAt: Date;
    },
    expectedFailedLoginAttempts: number,
  ): Promise<boolean> {
    if (this.commitParallelFailure) {
      this.commitParallelFailure = false;
      this.loginStates.set(userId, {
        failedLoginAttempts: expectedFailedLoginAttempts + 1,
        lockedUntil: null,
      });
    }
    return super.saveSuccessfulLogin(
      userId,
      state,
      expectedFailedLoginAttempts,
    );
  }
}

/**
 * Repository whose guarded failed login write always loses, so the use case
 * must fall back to the unconditional atomic path.
 */
class AlwaysRacingUserRepository extends InMemoryUserRepository {
  override saveFailedLogin(): Promise<boolean> {
    return Promise.resolve(false);
  }
}

/**
 * Repository that inserts a competing OAuth account just after the use case
 * reads a missing email, reproducing two simultaneous first sign ins.
 */
class RacingOAuthRepository extends InMemoryUserRepository {
  private firstLookup = true;

  override async findByEmail(email: string): Promise<User | null> {
    const found = await super.findByEmail(email);
    if (this.firstLookup && !found) {
      this.firstLookup = false;
      await super.createOAuth({
        name: "Parallel Winner",
        email,
        provider: "GOOGLE",
        providerId: "google-race",
        avatarUrl: null,
        lastLoginAt: new Date("2026-01-01T00:00:00Z"),
      });
      return null;
    }
    return found;
  }
}

/**
 * Repository whose OAuth create fails with an error that is not a duplicate
 * email, standing in for a real database failure.
 */
class FailingOAuthRepository extends InMemoryUserRepository {
  override createOAuth(): Promise<User> {
    return Promise.reject(new Error("database unavailable"));
  }
}

/**
 * Repository that reports a duplicate email on create but then cannot find the
 * winning account, so the use case must keep surfacing the original failure.
 */
class VanishingOAuthRepository extends InMemoryUserRepository {
  override createOAuth(): Promise<User> {
    return Promise.reject(new EmailAlreadyExistsError());
  }

  override findByEmail(): Promise<User | null> {
    return Promise.resolve(null);
  }
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

describe("resendVerification", () => {
  it("keeps the previous link valid when the replacement email fails to send", async () => {
    const { deps, users, emails } = createTestDependencies();
    const user = seedUser(users, {
      email: "customer@example.com",
      emailVerified: false,
    });
    await users.saveVerificationIssue(user.id, {
      tokenHash: "hash:earlier-link",
      expiresAt: new Date("2026-02-01T00:00:00Z"),
      sentAt: new Date("2026-01-01T00:00:00Z"),
    });
    emails.sendVerificationEmail = () =>
      Promise.reject(new Error("transport down"));

    await resendVerification(deps, "customer@example.com");

    // The stored issue is still the one already delivered, so the earlier link
    // keeps working and the resend throttle is not spent.
    expect(users.verificationIssues.get(user.id)?.tokenHash).toBe(
      "hash:earlier-link",
    );
  });

  it("stores the new issue and emails the link on the happy path", async () => {
    const { deps, users, emails } = createTestDependencies();
    const user = seedUser(users, {
      email: "customer@example.com",
      emailVerified: false,
    });

    await resendVerification(deps, "customer@example.com");

    expect(emails.verification).toHaveLength(1);
    expect(emails.verification[0]?.url).toBe(
      "https://shop.example.com/verify-email?token=refresh-1",
    );
    expect(users.verificationIssues.get(user.id)?.tokenHash).toBe(
      "hash:refresh-1",
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

  it("re-reads and counts a failure when a parallel write wins the race", async () => {
    const users = new RacingUserRepository();
    const { deps } = createTestDependencies({ users });
    const user = seedUser(users, { email: "race@example.com" });

    users.refuseNextWrite = true;

    await expectAuthError(
      loginUser(
        deps,
        { email: "race@example.com", password: "wrong" },
        { deviceInfo: null, ipAddress: null },
      ),
      "INVALID_CREDENTIALS",
    );

    // The competing write counted one failure and the retry added this attempt
    // on top, so the counter is two rather than one.
    expect(users.loginStates.get(user.id)?.failedLoginAttempts).toBe(2);
  });

  it("falls back to an atomic write when every guarded attempt loses", async () => {
    const users = new AlwaysRacingUserRepository();
    const { deps } = createTestDependencies({ users });
    const user = seedUser(users, { email: "always-race@example.com" });

    await expectAuthError(
      loginUser(
        deps,
        { email: "always-race@example.com", password: "wrong" },
        { deviceInfo: null, ipAddress: null },
      ),
      "INVALID_CREDENTIALS",
    );

    // Five refused compare and swap writes still leave the failure counted.
    expect(users.loginStates.get(user.id)?.failedLoginAttempts).toBe(1);
  });

  it("keeps a parallel failure count instead of erasing it on success", async () => {
    const users = new RacingSuccessRepository();
    const { deps } = createTestDependencies({ users });
    const user = seedUser(users, { email: "success-race@example.com" });

    users.commitParallelFailure = true;

    const result = await loginUser(
      deps,
      { email: "success-race@example.com", password: "correct horse" },
      { deviceInfo: null, ipAddress: null },
    );

    expect(result.user.id).toBe(user.id);
    // The parallel failure committed first, so its increment survives the
    // successful sign in even though the counter would normally be cleared.
    expect(users.loginStates.get(user.id)?.failedLoginAttempts).toBe(1);
    expect(users.loginStates.get(user.id)?.lastLoginAt).toBeInstanceOf(Date);
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

describe("loginUser timing", () => {
  it("runs the password check even when the account cannot match", async () => {
    let verifies = 0;
    const countingHasher = {
      hash: (): Promise<string> => Promise.resolve("hashed:counting"),
      verify: (): Promise<boolean> => {
        verifies += 1;
        return Promise.resolve(false);
      },
    };
    const { deps, users } = createTestDependencies({
      passwords: countingHasher,
    });

    await expectAuthError(
      loginUser(
        deps,
        { email: "missing@example.com", password: "whatever" },
        { deviceInfo: null, ipAddress: null },
      ),
      "INVALID_CREDENTIALS",
    );
    expect(verifies).toBe(1);

    seedUser(users, {
      email: "oauth-only@example.com",
      passwordHash: null,
      authProvider: "GOOGLE",
      providerId: "google-1",
    });
    await expectAuthError(
      loginUser(
        deps,
        { email: "oauth-only@example.com", password: "whatever" },
        { deviceInfo: null, ipAddress: null },
      ),
      "INVALID_CREDENTIALS",
    );
    expect(verifies).toBe(2);

    seedUser(users, {
      email: "locked@example.com",
      lockedUntil: new Date("2026-01-01T00:10:00Z"),
    });
    await expectAuthError(
      loginUser(
        deps,
        { email: "locked@example.com", password: "whatever" },
        { deviceInfo: null, ipAddress: null },
      ),
      "INVALID_CREDENTIALS",
    );
    expect(verifies).toBe(3);
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

  it("does not revive a chain after a password reset, even inside the grace window", async () => {
    const { deps, users, sessions, clock } = createTestDependencies();
    const user = seedUser(users, { email: "reset-grace@example.com" });
    const first = await loginUser(
      deps,
      { email: "reset-grace@example.com", password: "correct horse" },
      { deviceInfo: null, ipAddress: null },
    );

    clock.advance(1_000);
    await refreshSession(deps, first.refreshToken);

    const rawToken = deps.tokens.generateOpaqueToken();
    await users.savePasswordResetIssue(user.id, {
      tokenHash: deps.tokens.hashOpaqueToken(rawToken),
      expiresAt: new Date(clock.now().getTime() + 3_600_000),
    });
    await resetPassword(deps, rawToken, "new correct horse");

    clock.advance(5_000);
    await expectAuthError(
      refreshSession(deps, first.refreshToken),
      "INVALID_SESSION",
    );
    expect(sessions.activeCount()).toBe(0);
  });

  it("does not revive a chain after sign out, even inside the grace window", async () => {
    const { deps, users, sessions, clock } = createTestDependencies();
    seedUser(users, { email: "logout-grace@example.com" });
    const first = await loginUser(
      deps,
      { email: "logout-grace@example.com", password: "correct horse" },
      { deviceInfo: null, ipAddress: null },
    );

    clock.advance(1_000);
    const rotated = await refreshSession(deps, first.refreshToken);
    await logoutSession(deps, rotated.refreshToken);

    clock.advance(5_000);
    await expectAuthError(
      refreshSession(deps, first.refreshToken),
      "INVALID_SESSION",
    );
    expect(sessions.activeCount()).toBe(0);
  });

  it("does not revoke other sessions when a signed out token is replayed", async () => {
    const { deps, users, sessions, clock } = createTestDependencies();
    seedUser(users, { email: "logout-replay@example.com" });
    const deviceA = await loginUser(
      deps,
      { email: "logout-replay@example.com", password: "correct horse" },
      { deviceInfo: "device-a", ipAddress: null },
    );
    await loginUser(
      deps,
      { email: "logout-replay@example.com", password: "correct horse" },
      { deviceInfo: "device-b", ipAddress: null },
    );
    expect(sessions.activeCount()).toBe(2);

    await logoutSession(deps, deviceA.refreshToken);
    clock.advance(11_000);

    await expectAuthError(
      refreshSession(deps, deviceA.refreshToken),
      "INVALID_SESSION",
    );
    expect(sessions.activeCount()).toBe(1);
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

  it("keeps the previous reset link valid when the replacement email fails to send", async () => {
    const { deps, users, emails } = createTestDependencies();
    const user = seedUser(users, { email: "customer@example.com" });
    await users.savePasswordResetIssue(user.id, {
      tokenHash: "hash:earlier-reset",
      expiresAt: new Date("2026-02-01T00:00:00Z"),
    });
    emails.sendPasswordResetEmail = () =>
      Promise.reject(new Error("transport down"));

    await forgotPassword(deps, "customer@example.com");

    expect(users.resetIssues.get(user.id)?.tokenHash).toBe(
      "hash:earlier-reset",
    );
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

  it("continues as the existing account when a parallel first sign in wins", async () => {
    const users = new RacingOAuthRepository();
    const { deps, sessions } = createTestDependencies({ users });

    const result = await signInWithOAuth(
      deps,
      {
        provider: "GOOGLE",
        providerId: "google-race",
        email: "race-oauth@example.com",
        name: "Racing Customer",
        avatarUrl: null,
      },
      { deviceInfo: null, ipAddress: null },
    );

    expect(result.user.email).toBe("race-oauth@example.com");
    expect(users.users.size).toBe(1);
    expect(sessions.activeCount()).toBe(1);
  });

  it("surfaces a create failure that is not a duplicate email", async () => {
    const users = new FailingOAuthRepository();
    const { deps } = createTestDependencies({ users });

    await expect(
      signInWithOAuth(
        deps,
        {
          provider: "GOOGLE",
          providerId: "google-error",
          email: "error-oauth@example.com",
          name: "Error Customer",
          avatarUrl: null,
        },
        { deviceInfo: null, ipAddress: null },
      ),
    ).rejects.toThrow("database unavailable");
  });

  it("keeps the duplicate error when the winning account cannot be re-read", async () => {
    const users = new VanishingOAuthRepository();
    const { deps } = createTestDependencies({ users });

    await expect(
      signInWithOAuth(
        deps,
        {
          provider: "GOOGLE",
          providerId: "google-vanish",
          email: "vanish-oauth@example.com",
          name: "Vanishing Customer",
          avatarUrl: null,
        },
        { deviceInfo: null, ipAddress: null },
      ),
    ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
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
        provider: "GOOGLE",
        providerId: "google-7",
        email: "link@example.com",
        name: "Linked Customer",
        avatarUrl: null,
      },
      { deviceInfo: null, ipAddress: null },
    );

    expect(result.user.id).toBe(user.id);
    expect(result.user.emailVerified).toBe(true);
    // The account stays LOCAL, so the record keeps no provider id rather than
    // mixing the LOCAL name with a Google id.
    expect(users.oauthLogins.get(user.id)).toMatchObject({
      providerId: null,
      emailVerified: true,
      clearPassword: true,
    });
  });

  it("clears a pending reset link when linking a local account", async () => {
    const { deps, users } = createTestDependencies();
    const user = seedUser(users, {
      email: "link-reset@example.com",
      emailVerified: false,
    });
    await users.savePasswordResetIssue(user.id, {
      tokenHash: "pending-reset-hash",
      expiresAt: new Date("2027-01-01T00:00:00Z"),
    });

    await signInWithOAuth(
      deps,
      {
        provider: "GOOGLE",
        providerId: "google-8",
        email: "link-reset@example.com",
        name: "Linked Customer",
        avatarUrl: null,
      },
      { deviceInfo: null, ipAddress: null },
    );

    expect(users.resetIssues.has(user.id)).toBe(false);
  });

  it("keeps the stored provider pair when another provider signs in", async () => {
    const { deps, users } = createTestDependencies();
    const user = seedUser(users, {
      email: "keep-provider@example.com",
      authProvider: "FACEBOOK",
      providerId: "facebook-42",
    });

    await signInWithOAuth(
      deps,
      {
        provider: "GOOGLE",
        providerId: "google-99",
        email: "keep-provider@example.com",
        name: "Keep Provider",
        avatarUrl: null,
      },
      { deviceInfo: null, ipAddress: null },
    );

    expect(users.oauthLogins.get(user.id)?.providerId).toBe("facebook-42");
  });

  it("leaves the provider id alone when a different provider signs in", async () => {
    const { deps, users } = createTestDependencies();
    const user = seedUser(users, {
      email: "null-provider@example.com",
      authProvider: "FACEBOOK",
      providerId: null,
    });

    await signInWithOAuth(
      deps,
      {
        provider: "GOOGLE",
        providerId: "google-77",
        email: "null-provider@example.com",
        name: "Null Provider",
        avatarUrl: null,
      },
      { deviceInfo: null, ipAddress: null },
    );

    // The account keeps FACEBOOK, so storing a Google id would mismatch.
    expect(users.oauthLogins.get(user.id)?.providerId).toBeNull();
  });

  it("refuses Facebook sign in for an existing verified local account without mutating it", async () => {
    const { deps, users, sessions } = createTestDependencies();
    seedUser(users, {
      email: "verified-local@example.com",
      authProvider: "LOCAL",
      emailVerified: true,
      passwordHash: "hashed:existing secret",
    });

    await expectAuthError(
      signInWithOAuth(
        deps,
        {
          provider: "FACEBOOK",
          providerId: "facebook-10",
          email: "verified-local@example.com",
          name: "Facebook Attacker",
          avatarUrl: null,
        },
        { deviceInfo: null, ipAddress: null },
      ),
      "OAUTH_LINK_DISALLOWED",
    );

    expect(users.oauthLogins.size).toBe(0);
    expect(sessions.activeCount()).toBe(0);
  });

  it("refuses Facebook sign in for an existing unverified local account and keeps its password", async () => {
    const { deps, users, sessions } = createTestDependencies();
    const user = seedUser(users, {
      email: "unverified-local@example.com",
      authProvider: "LOCAL",
      emailVerified: false,
      passwordHash: "hashed:keep me",
    });

    await expectAuthError(
      signInWithOAuth(
        deps,
        {
          provider: "FACEBOOK",
          providerId: "facebook-11",
          email: "unverified-local@example.com",
          name: "Facebook Attacker",
          avatarUrl: null,
        },
        { deviceInfo: null, ipAddress: null },
      ),
      "OAUTH_LINK_DISALLOWED",
    );

    const persisted = await users.findById(user.id);
    expect(persisted?.emailVerified).toBe(false);
    expect(persisted?.passwordHash).toBe("hashed:keep me");
    expect(users.oauthLogins.size).toBe(0);
    expect(sessions.activeCount()).toBe(0);
  });

  it("refuses Facebook sign in for an existing Google account", async () => {
    const { deps, users, sessions } = createTestDependencies();
    seedUser(users, {
      email: "existing-google@example.com",
      authProvider: "GOOGLE",
      providerId: "google-42",
      passwordHash: null,
    });

    await expectAuthError(
      signInWithOAuth(
        deps,
        {
          provider: "FACEBOOK",
          providerId: "facebook-12",
          email: "existing-google@example.com",
          name: "Facebook User",
          avatarUrl: null,
        },
        { deviceInfo: null, ipAddress: null },
      ),
      "OAUTH_LINK_DISALLOWED",
    );

    expect(users.oauthLogins.size).toBe(0);
    expect(sessions.activeCount()).toBe(0);
  });

  it("signs in a returning Facebook account", async () => {
    const { deps, users, sessions } = createTestDependencies();
    const user = seedUser(users, {
      email: "returning-fb@example.com",
      authProvider: "FACEBOOK",
      providerId: "facebook-old",
      passwordHash: null,
      avatarUrl: null,
    });

    const result = await signInWithOAuth(
      deps,
      {
        provider: "FACEBOOK",
        providerId: "facebook-new",
        email: "returning-fb@example.com",
        name: "Returning FB",
        avatarUrl: "https://cdn.example.com/fb.png",
      },
      { deviceInfo: null, ipAddress: null },
    );

    expect(result.user.id).toBe(user.id);
    expect(result.user.avatarUrl).toBe("https://cdn.example.com/fb.png");
    expect(users.oauthLogins.get(user.id)?.providerId).toBe("facebook-new");
    expect(sessions.activeCount()).toBe(1);
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

  it("revokes the successor chain when signing out with a rotated token", async () => {
    const { deps, users, sessions, clock } = createTestDependencies();
    seedUser(users, { email: "chain@example.com" });
    const first = await loginUser(
      deps,
      { email: "chain@example.com", password: "correct horse" },
      { deviceInfo: null, ipAddress: null },
    );

    clock.advance(1_000);
    const second = await refreshSession(deps, first.refreshToken);
    expect(sessions.activeCount()).toBe(1);

    // Sign out with the stale predecessor token; the live successor must die.
    await logoutSession(deps, first.refreshToken);

    expect(sessions.activeCount()).toBe(0);
    await expectAuthError(
      refreshSession(deps, second.refreshToken),
      "INVALID_SESSION",
    );
  });
});
