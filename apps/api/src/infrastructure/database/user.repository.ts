import {
  AuthProvider as PrismaAuthProvider,
  UserRole as PrismaUserRole,
  type PrismaClient,
  type User as PrismaUser,
} from "../../generated/prisma/client.js";
import { User } from "../../domain/entities/user.js";
import { EmailAlreadyExistsError } from "../../domain/errors.js";
import type {
  CreateLocalUserInput,
  CreateOAuthUserInput,
  PasswordResetIssue,
  UserRepository,
  VerificationIssue,
} from "../../domain/ports/user-repository.js";

/**
 * Prisma backed account repository.
 *
 * Maps rows into domain entities so the application layer never sees Prisma
 * types.
 */
export class PrismaUserRepository implements UserRepository {
  /**
   * @param prisma Prisma client owned by the composition root.
   */
  constructor(private readonly prisma: PrismaClient) {}

  /** @inheritdoc */
  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { email } });
    return row ? toDomain(row) : null;
  }

  /** @inheritdoc */
  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  /** @inheritdoc */
  async findByVerificationTokenHash(tokenHash: string): Promise<User | null> {
    const row = await this.prisma.user.findFirst({
      where: { emailVerificationToken: tokenHash },
    });
    return row ? toDomain(row) : null;
  }

  /** @inheritdoc */
  async findByPasswordResetTokenHash(tokenHash: string): Promise<User | null> {
    const row = await this.prisma.user.findFirst({
      where: { passwordResetToken: tokenHash },
    });
    return row ? toDomain(row) : null;
  }

  /** @inheritdoc */
  async createLocal(input: CreateLocalUserInput): Promise<User> {
    try {
      const row = await this.prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash: input.passwordHash,
          authProvider: PrismaAuthProvider.LOCAL,
          role: PrismaUserRole.CUSTOMER,
        },
      });
      return toDomain(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new EmailAlreadyExistsError();
      }
      throw error;
    }
  }

  /** @inheritdoc */
  async createOAuth(input: CreateOAuthUserInput): Promise<User> {
    const row = await this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        authProvider: input.provider,
        providerId: input.providerId,
        avatarUrl: input.avatarUrl,
        emailVerified: true,
        role: PrismaUserRole.CUSTOMER,
        lastLoginAt: input.lastLoginAt,
      },
    });
    return toDomain(row);
  }

  /** @inheritdoc */
  async saveVerificationIssue(
    userId: string,
    issue: VerificationIssue,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationToken: issue.tokenHash,
        emailVerificationExpiresAt: issue.expiresAt,
        emailVerificationSentAt: issue.sentAt,
      },
    });
  }

  /** @inheritdoc */
  async saveVerified(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      },
    });
  }

  /** @inheritdoc */
  async savePasswordResetIssue(
    userId: string,
    issue: PasswordResetIssue,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordResetToken: issue.tokenHash,
        passwordResetExpiresAt: issue.expiresAt,
      },
    });
  }

  /** @inheritdoc */
  async savePasswordReset(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  /** @inheritdoc */
  async saveLoginState(
    userId: string,
    state: {
      failedLoginAttempts: number;
      lockedUntil: Date | null;
      lastLoginAt?: Date;
    },
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: state.failedLoginAttempts,
        lockedUntil: state.lockedUntil,
        ...(state.lastLoginAt ? { lastLoginAt: state.lastLoginAt } : {}),
      },
    });
  }

  /** @inheritdoc */
  async saveOAuthLogin(
    userId: string,
    state: {
      providerId: string;
      avatarUrl: string | null;
      emailVerified: true;
      clearPassword: boolean;
      lastLoginAt: Date;
    },
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        providerId: state.providerId,
        avatarUrl: state.avatarUrl,
        emailVerified: state.emailVerified,
        lastLoginAt: state.lastLoginAt,
        ...(state.clearPassword ? { passwordHash: null } : {}),
      },
    });
  }
}

/** Maps a Prisma user row to the domain entity. */
function toDomain(row: PrismaUser): User {
  return User.reconstitute({
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.passwordHash,
    role: row.role,
    authProvider: row.authProvider,
    providerId: row.providerId,
    avatarUrl: row.avatarUrl,
    emailVerified: row.emailVerified,
    emailVerificationToken: row.emailVerificationToken,
    emailVerificationExpiresAt: row.emailVerificationExpiresAt,
    emailVerificationSentAt: row.emailVerificationSentAt,
    passwordResetToken: row.passwordResetToken,
    passwordResetExpiresAt: row.passwordResetExpiresAt,
    failedLoginAttempts: row.failedLoginAttempts,
    lockedUntil: row.lockedUntil,
    lastLoginAt: row.lastLoginAt,
  });
}

/** Detects Prisma's unique constraint error without importing its classes. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
