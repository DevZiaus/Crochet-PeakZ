import { describe, expect, it } from "vitest";
import { LOCK_DURATION_MS, MAX_FAILED_LOGINS } from "../auth-constants.js";
import { User } from "./user.js";
import { makeUserSnapshot } from "../../test-support/auth-fakes.js";

const NOW = new Date("2026-01-01T12:00:00Z");

describe("User", () => {
  it("locks the account on the fifth consecutive failure", () => {
    const user = User.reconstitute(makeUserSnapshot());

    for (let attempt = 1; attempt <= MAX_FAILED_LOGINS; attempt += 1) {
      expect(user.isLocked(NOW)).toBe(false);
      user.recordFailedLogin(NOW);
    }

    expect(user.failedLoginAttempts).toBe(MAX_FAILED_LOGINS);
    expect(user.lockedUntil?.getTime()).toBe(NOW.getTime() + LOCK_DURATION_MS);
    expect(user.isLocked(NOW)).toBe(true);
  });

  it("does not extend the lock or the counter while locked", () => {
    const user = User.reconstitute(makeUserSnapshot());
    for (let attempt = 1; attempt <= MAX_FAILED_LOGINS; attempt += 1) {
      user.recordFailedLogin(NOW);
    }
    const lockedUntil = user.lockedUntil;

    user.recordFailedLogin(new Date(NOW.getTime() + 60_000));

    expect(user.failedLoginAttempts).toBe(MAX_FAILED_LOGINS);
    expect(user.lockedUntil).toBe(lockedUntil);
  });

  it("starts a fresh window once an expired lock has passed", () => {
    const lockedUntil = new Date(NOW.getTime() + LOCK_DURATION_MS);
    const user = User.reconstitute(
      makeUserSnapshot({
        failedLoginAttempts: MAX_FAILED_LOGINS,
        lockedUntil,
      }),
    );

    const afterLock = new Date(lockedUntil.getTime() + 1);
    expect(user.isLocked(afterLock)).toBe(false);

    user.recordFailedLogin(afterLock);

    expect(user.failedLoginAttempts).toBe(1);
    expect(user.lockedUntil).toBeNull();
  });

  it("clears the counter and lock after a successful sign in", () => {
    const user = User.reconstitute(
      makeUserSnapshot({
        failedLoginAttempts: 4,
        lockedUntil: new Date(NOW.getTime() + LOCK_DURATION_MS),
      }),
    );

    user.clearFailedLogins();

    expect(user.failedLoginAttempts).toBe(0);
    expect(user.lockedUntil).toBeNull();
  });

  it("throttles verification resends for 60 seconds", () => {
    const user = User.reconstitute(
      makeUserSnapshot({ emailVerificationSentAt: NOW }),
    );

    expect(user.canResendVerification(new Date(NOW.getTime() + 59_000))).toBe(
      false,
    );
    expect(user.canResendVerification(new Date(NOW.getTime() + 60_000))).toBe(
      true,
    );
    expect(
      User.reconstitute(makeUserSnapshot()).canResendVerification(NOW),
    ).toBe(true);
  });

  it("marks the email verified and consumes the verification link", () => {
    const user = User.reconstitute(
      makeUserSnapshot({
        emailVerified: false,
        emailVerificationExpiresAt: new Date(NOW.getTime() + 60_000),
      }),
    );

    user.markEmailVerified();

    expect(user.emailVerified).toBe(true);
    expect(user.emailVerificationExpiresAt).toBeNull();
  });

  it("treats a verification expiry at or before now as expired", () => {
    const user = User.reconstitute(
      makeUserSnapshot({ emailVerificationExpiresAt: NOW }),
    );

    expect(user.isVerificationExpired(NOW)).toBe(true);
    expect(user.isVerificationExpired(new Date(NOW.getTime() - 1))).toBe(false);
    expect(
      User.reconstitute(makeUserSnapshot()).isVerificationExpired(NOW),
    ).toBe(false);
  });

  it("treats a reset expiry at or before now as expired", () => {
    const user = User.reconstitute(
      makeUserSnapshot({ passwordResetExpiresAt: NOW }),
    );

    expect(user.isPasswordResetExpired(NOW)).toBe(true);
    expect(user.isPasswordResetExpired(new Date(NOW.getTime() - 1))).toBe(
      false,
    );
  });

  it("clears the password only when linking an unverified local account", () => {
    const unverifiedLocal = User.reconstitute(
      makeUserSnapshot({ emailVerified: false, passwordHash: "hashed" }),
    );
    const verifiedLocal = User.reconstitute(makeUserSnapshot());
    const oauthOnly = User.reconstitute(
      makeUserSnapshot({ passwordHash: null }),
    );

    expect(unverifiedLocal.shouldClearPasswordOnLink()).toBe(true);
    expect(verifiedLocal.shouldClearPasswordOnLink()).toBe(false);
    expect(oauthOnly.shouldClearPasswordOnLink()).toBe(false);
  });

  it("allows Google to link any account while restricting Facebook to Facebook accounts", () => {
    const localUser = User.reconstitute(
      makeUserSnapshot({ authProvider: "LOCAL" }),
    );
    const googleUser = User.reconstitute(
      makeUserSnapshot({ authProvider: "GOOGLE", providerId: "google-1" }),
    );
    const facebookUser = User.reconstitute(
      makeUserSnapshot({ authProvider: "FACEBOOK", providerId: "facebook-1" }),
    );

    expect(localUser.canLinkOAuthProvider("GOOGLE")).toBe(true);
    expect(googleUser.canLinkOAuthProvider("GOOGLE")).toBe(true);
    expect(facebookUser.canLinkOAuthProvider("GOOGLE")).toBe(true);

    expect(localUser.canLinkOAuthProvider("FACEBOOK")).toBe(false);
    expect(googleUser.canLinkOAuthProvider("FACEBOOK")).toBe(false);
    expect(facebookUser.canLinkOAuthProvider("FACEBOOK")).toBe(true);
  });

  it("keeps an existing avatar on provider sign in", () => {
    const withAvatar = User.reconstitute(
      makeUserSnapshot({
        emailVerified: false,
        avatarUrl: "https://a/one.png",
      }),
    );
    const withoutAvatar = User.reconstitute(
      makeUserSnapshot({ emailVerified: false, avatarUrl: null }),
    );

    withAvatar.applyProviderLogin("https://a/two.png");
    withoutAvatar.applyProviderLogin("https://a/two.png");

    expect(withAvatar.avatarUrl).toBe("https://a/one.png");
    expect(withoutAvatar.avatarUrl).toBe("https://a/two.png");
    expect(withAvatar.emailVerified).toBe(true);
    expect(withoutAvatar.emailVerified).toBe(true);
  });

  it("returns only the public fields in the auth DTO", () => {
    const user = User.reconstitute(
      makeUserSnapshot({
        id: "user-42",
        name: "Ada",
        email: "ada@example.com",
        role: "ADMIN",
        avatarUrl: null,
        emailVerified: true,
      }),
    );

    expect(user.toAuthUser()).toEqual({
      id: "user-42",
      name: "Ada",
      email: "ada@example.com",
      role: "ADMIN",
      avatarUrl: null,
      emailVerified: true,
    });
  });
});
