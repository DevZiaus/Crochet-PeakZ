import {
  LOCK_DURATION_MS,
  MAX_FAILED_LOGINS,
  RESEND_THROTTLE_MS,
} from "../auth-constants.js";
import type { AuthProvider, AuthUserDto, UserRole } from "../types.js";

/**
 * A plain snapshot of the persisted user fields the auth domain understands.
 *
 * The infrastructure repository maps a Prisma row into this shape so the
 * entity never imports the ORM.
 */
export interface UserSnapshot {
  id: string;
  name: string;
  email: string;
  passwordHash: string | null;
  role: UserRole;
  authProvider: AuthProvider;
  providerId: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  emailVerificationToken: string | null;
  emailVerificationExpiresAt: Date | null;
  emailVerificationSentAt: Date | null;
  passwordResetToken: string | null;
  passwordResetExpiresAt: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
}

/**
 * A store account.
 *
 * Owns the sign in lock, email verification, and password reset invariants.
 * It is a plain object with no ORM decorators or framework imports.
 */
export class User {
  private constructor(private readonly state: UserSnapshot) {}

  /**
   * Rebuilds an entity from a repository snapshot.
   *
   * @param snapshot Persisted user fields.
   * @returns A `User` entity.
   */
  static reconstitute(snapshot: UserSnapshot): User {
    return new User({ ...snapshot });
  }

  /** Account id. */
  get id(): string {
    return this.state.id;
  }

  /** Display name. */
  get name(): string {
    return this.state.name;
  }

  /** Normalized email address. */
  get email(): string {
    return this.state.email;
  }

  /** Stored password hash, or null for an OAuth only account. */
  get passwordHash(): string | null {
    return this.state.passwordHash;
  }

  /** Account role. */
  get role(): UserRole {
    return this.state.role;
  }

  /** Provider the account was created with. */
  get authProvider(): AuthProvider {
    return this.state.authProvider;
  }

  /** Provider's stable user id, or null for a local account. */
  get providerId(): string | null {
    return this.state.providerId;
  }

  /** Whether the email address is verified. */
  get emailVerified(): boolean {
    return this.state.emailVerified;
  }

  /** Avatar URL, or null. */
  get avatarUrl(): string | null {
    return this.state.avatarUrl;
  }

  /** Consecutive failed sign in count. */
  get failedLoginAttempts(): number {
    return this.state.failedLoginAttempts;
  }

  /** When the current lock ends, or null. */
  get lockedUntil(): Date | null {
    return this.state.lockedUntil;
  }

  /** When a verification email was last sent, or null. */
  get emailVerificationSentAt(): Date | null {
    return this.state.emailVerificationSentAt;
  }

  /** When the current verification link expires, or null. */
  get emailVerificationExpiresAt(): Date | null {
    return this.state.emailVerificationExpiresAt;
  }

  /** When the current reset link expires, or null. */
  get passwordResetExpiresAt(): Date | null {
    return this.state.passwordResetExpiresAt;
  }

  /**
   * Whether the account is locked at the given moment.
   *
   * @param now Current time.
   * @returns True while `lockedUntil` is in the future.
   */
  isLocked(now: Date): boolean {
    return this.state.lockedUntil !== null && this.state.lockedUntil > now;
  }

  /**
   * Whether a verification email may be sent again for this account.
   *
   * @param now Current time.
   * @returns True when no send has happened in the last 60 seconds.
   */
  canResendVerification(now: Date): boolean {
    if (!this.state.emailVerificationSentAt) {
      return true;
    }
    return (
      now.getTime() - this.state.emailVerificationSentAt.getTime() >=
      RESEND_THROTTLE_MS
    );
  }

  /**
   * Records a failed password attempt and applies the lock rule.
   *
   * While the account is already locked the count does not move, so an
   * attacker cannot extend the lock forever. When a previous lock has expired,
   * the window starts fresh, so mistyping once after waiting out the lock does
   * not immediately re-lock the account.
   *
   * @param now Current time.
   */
  recordFailedLogin(now: Date): void {
    if (this.isLocked(now)) {
      return;
    }

    if (this.state.lockedUntil !== null) {
      this.state.failedLoginAttempts = 0;
      this.state.lockedUntil = null;
    }

    this.state.failedLoginAttempts += 1;

    if (this.state.failedLoginAttempts >= MAX_FAILED_LOGINS) {
      this.state.lockedUntil = new Date(now.getTime() + LOCK_DURATION_MS);
    }
  }

  /**
   * Clears the failure counter and the lock after a successful sign in.
   */
  clearFailedLogins(): void {
    this.state.failedLoginAttempts = 0;
    this.state.lockedUntil = null;
  }

  /**
   * Marks the email address verified and consumes the verification token.
   */
  markEmailVerified(): void {
    this.state.emailVerified = true;
    this.state.emailVerificationToken = null;
    this.state.emailVerificationExpiresAt = null;
  }

  /**
   * Whether the verification link has passed its 24 hour life.
   *
   * @param now Current time.
   * @returns True when an expiry exists and has passed.
   */
  isVerificationExpired(now: Date): boolean {
    return (
      this.state.emailVerificationExpiresAt !== null &&
      this.state.emailVerificationExpiresAt <= now
    );
  }

  /**
   * Whether the reset link has passed its 1 hour life.
   *
   * @param now Current time.
   * @returns True when an expiry exists and has passed.
   */
  isPasswordResetExpired(now: Date): boolean {
    return (
      this.state.passwordResetExpiresAt !== null &&
      this.state.passwordResetExpiresAt <= now
    );
  }

  /**
   * Applies the verified facts a provider proved on sign in.
   *
   * The email is always verified. An avatar is filled only when the account has
   * none, so an OAuth sign in never overwrites a chosen avatar.
   *
   * @param avatarUrl Avatar supplied by the provider.
   */
  applyProviderLogin(avatarUrl: string | null): void {
    this.state.emailVerified = true;
    if (!this.state.avatarUrl) {
      this.state.avatarUrl = avatarUrl;
    }
  }

  /**
   * Whether the account is a local account that has not verified its email,
   * which is the only case an OAuth sign in may link and clear the password.
   *
   * @returns True when the password should be cleared on link.
   */
  shouldClearPasswordOnLink(): boolean {
    return !this.state.emailVerified && this.state.passwordHash !== null;
  }

  /**
   * Whether an OAuth sign in from `provider` may resolve to this account.
   *
   * Google explicitly attests `email_verified: true`, so it may sign in to
   * or link any existing account sharing the same email. Facebook's Graph
   * API exposes no explicit email-verification claim, so Facebook may only
   * sign in to accounts originally created with Facebook and never
   * auto-links to existing local or Google accounts.
   *
   * @param provider OAuth provider attempting sign in.
   * @returns True when `provider` is permitted to sign in to this account.
   */
  canLinkOAuthProvider(provider: Exclude<AuthProvider, "LOCAL">): boolean {
    if (provider === "FACEBOOK") {
      return this.state.authProvider === "FACEBOOK";
    }
    return true;
  }

  /**
   * Returns the public DTO every user bearing response uses.
   *
   * @returns Fields safe to send to the browser.
   */
  toAuthUser(): AuthUserDto {
    return {
      id: this.state.id,
      name: this.state.name,
      email: this.state.email,
      role: this.state.role,
      avatarUrl: this.state.avatarUrl,
      emailVerified: this.state.emailVerified,
    };
  }
}
