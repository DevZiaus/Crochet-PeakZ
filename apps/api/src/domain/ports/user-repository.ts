import type { User } from "../entities/user.js";
import type { AuthProvider } from "../types.js";

/** Fields needed to create a local (email and password) account. */
export interface CreateLocalUserInput {
  name: string;
  email: string;
  passwordHash: string;
}

/** Fields needed to create an account from a provider profile. */
export interface CreateOAuthUserInput {
  name: string;
  email: string;
  provider: Exclude<AuthProvider, "LOCAL">;
  providerId: string | null;
  avatarUrl: string | null;
  /** Time of the sign in that created the account. */
  lastLoginAt: Date;
}

/** New verification link details stored on the account. */
export interface VerificationIssue {
  tokenHash: string;
  expiresAt: Date;
  sentAt: Date;
}

/** New password reset link details stored on the account. */
export interface PasswordResetIssue {
  tokenHash: string;
  expiresAt: Date;
}

/**
 * Persistence port for accounts.
 *
 * Implemented in the infrastructure layer by Prisma. The domain and
 * application layers depend only on this interface.
 */
export interface UserRepository {
  /** Finds an account by normalized email. */
  findByEmail(email: string): Promise<User | null>;
  /** Finds an account by id. */
  findById(id: string): Promise<User | null>;
  /** Finds an account by the HMAC-SHA256 digest of its verification token. */
  findByVerificationTokenHash(tokenHash: string): Promise<User | null>;
  /** Finds an account by the HMAC-SHA256 digest of its password reset token. */
  findByPasswordResetTokenHash(tokenHash: string): Promise<User | null>;
  /** Creates a local account. Throws `EmailAlreadyExistsError` on a duplicate. */
  createLocal(input: CreateLocalUserInput): Promise<User>;
  /** Creates an account from a verified provider profile. */
  createOAuth(input: CreateOAuthUserInput): Promise<User>;
  /** Stores a new verification link and its send time. */
  saveVerificationIssue(
    userId: string,
    issue: VerificationIssue,
  ): Promise<void>;
  /**
   * Consumes a verification link and marks the account verified.
   *
   * The token columns are cleared only while they still hold `tokenHash`, so
   * two concurrent redemptions of the same link cannot both succeed.
   *
   * @param userId Account id.
   * @param tokenHash HMAC-SHA256 digest of the presented verification token.
   * @returns True when this call consumed the token, false when it was gone.
   */
  saveVerified(userId: string, tokenHash: string): Promise<boolean>;
  /** Stores a new password reset link. */
  savePasswordResetIssue(
    userId: string,
    issue: PasswordResetIssue,
  ): Promise<void>;
  /**
   * Applies a completed password reset in a single transaction.
   *
   * The token is consumed only while it still holds `tokenHash`, the new hash
   * replaces the old one, the reset columns and lock are cleared, and every
   * active session is revoked. Doing all of it atomically means a crash can
   * never leave a reset half applied, and two concurrent redemptions of the
   * same link cannot both succeed.
   *
   * @param input Account id, new password hash, presented token digest, time.
   * @returns True when this call consumed the token, false when it was gone.
   */
  completePasswordReset(input: {
    userId: string;
    passwordHash: string;
    tokenHash: string;
    now: Date;
  }): Promise<boolean>;
  /** Persists the sign in lock state and failure counter. */
  saveLoginState(
    userId: string,
    state: {
      failedLoginAttempts: number;
      lockedUntil: Date | null;
      /** Omit to leave the existing last sign in value untouched. */
      lastLoginAt?: Date;
    },
  ): Promise<void>;
  /**
   * Records a successful sign in.
   *
   * Clears the failure counter and lock only while the stored counter still
   * equals `expectedFailedLoginAttempts`, so a parallel failed attempt that
   * committed first keeps its increment instead of being erased. The sign in
   * time is always recorded, even when the guarded clear is refused.
   *
   * @param userId Account id.
   * @param state Cleared counter and lock plus the sign in time to store.
   * @param expectedFailedLoginAttempts Counter the caller read before deciding.
   * @returns True when the counter was cleared, false when it had moved on.
   */
  saveSuccessfulLogin(
    userId: string,
    state: {
      failedLoginAttempts: number;
      lockedUntil: Date | null;
      lastLoginAt: Date;
    },
    expectedFailedLoginAttempts: number,
  ): Promise<boolean>;
  /**
   * Persists a failed sign in state, but only while the stored failure counter
   * still equals `expectedFailedLoginAttempts`.
   *
   * The guarded write makes the read, decide, write cycle safe when several
   * sign in attempts land at once: a caller that lost the race gets `false` and
   * can re-read instead of overwriting a newer count and dropping an increment.
   *
   * @param userId Account id.
   * @param state New counter and lock to store.
   * @param expectedFailedLoginAttempts Counter the caller read before deciding.
   * @returns True when the state was persisted, false when the counter moved on.
   */
  saveFailedLogin(
    userId: string,
    state: { failedLoginAttempts: number; lockedUntil: Date | null },
    expectedFailedLoginAttempts: number,
  ): Promise<boolean>;
  /**
   * Applies fields learned from a provider on an OAuth sign in.
   *
   * The provider id may be null when an existing account has no provider id
   * yet but the record should not be rewritten with a different provider's id.
   */
  saveOAuthLogin(
    userId: string,
    state: {
      providerId: string | null;
      avatarUrl: string | null;
      emailVerified: true;
      clearPassword: boolean;
      lastLoginAt: Date;
    },
  ): Promise<void>;
}
