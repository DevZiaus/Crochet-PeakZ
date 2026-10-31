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
  providerId: string;
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
  /** Finds an account by the SHA 256 hash of its verification token. */
  findByVerificationTokenHash(tokenHash: string): Promise<User | null>;
  /** Finds an account by the SHA 256 hash of its password reset token. */
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
  /** Marks the account verified and clears the verification columns. */
  saveVerified(userId: string): Promise<void>;
  /** Stores a new password reset link. */
  savePasswordResetIssue(
    userId: string,
    issue: PasswordResetIssue,
  ): Promise<void>;
  /**
   * Applies a completed password reset: new hash, cleared reset columns,
   * cleared failures and lock.
   */
  savePasswordReset(userId: string, passwordHash: string): Promise<void>;
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
  /** Applies fields learned from a provider on an OAuth sign in. */
  saveOAuthLogin(
    userId: string,
    state: {
      providerId: string;
      avatarUrl: string | null;
      emailVerified: true;
      clearPassword: boolean;
      lastLoginAt: Date;
    },
  ): Promise<void>;
}
