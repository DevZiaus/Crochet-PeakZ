/* eslint-disable @typescript-eslint/require-await -- In-memory fakes implement async ports with synchronous state. */
import { User, type UserSnapshot } from "../domain/entities/user.js";
import { Session, type SessionSnapshot } from "../domain/entities/session.js";
import { EmailAlreadyExistsError } from "../domain/errors.js";
import type { Clock } from "../domain/ports/clock.js";
import type { AuthEmail, EmailSender } from "../domain/ports/email-sender.js";
import type { PasswordHasher } from "../domain/ports/password-hasher.js";
import type {
  CreateSessionInput,
  RotateSessionInput,
  SessionRepository,
} from "../domain/ports/session-repository.js";
import type {
  AccessTokenClaims,
  OAuthStateClaims,
  TokenService,
} from "../domain/ports/token-service.js";
import type {
  CreateLocalUserInput,
  CreateOAuthUserInput,
  PasswordResetIssue,
  UserRepository,
  VerificationIssue,
} from "../domain/ports/user-repository.js";
import type { AuthDependencies } from "../application/dependencies.js";

/** A mutable clock for tests. */
export interface TestClock extends Clock {
  /** Moves the clock forward. */
  advance: (milliseconds: number) => void;
  /** Sets the clock to a new instant. */
  set: (date: Date) => void;
}

/**
 * Creates a clock the test controls.
 *
 * @param start Initial instant.
 * @returns Mutable clock.
 */
export function createTestClock(start: Date): TestClock {
  let current = start;
  return {
    now: () => new Date(current),
    advance: (milliseconds) => {
      current = new Date(current.getTime() + milliseconds);
    },
    set: (date) => {
      current = date;
    },
  };
}

/** Builds a complete user snapshot with sensible defaults. */
export function makeUserSnapshot(
  overrides: Partial<UserSnapshot> = {},
): UserSnapshot {
  return {
    id: "user-1",
    name: "Test Customer",
    email: "customer@example.com",
    passwordHash: "hashed:correct horse",
    role: "CUSTOMER",
    authProvider: "LOCAL",
    providerId: null,
    avatarUrl: null,
    emailVerified: true,
    emailVerificationToken: null,
    emailVerificationExpiresAt: null,
    emailVerificationSentAt: null,
    passwordResetToken: null,
    passwordResetExpiresAt: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    ...overrides,
  };
}

/**
 * Rebuilds a snapshot from an entity so the fake can apply issued link fields.
 *
 * Fields without a public getter are filled with the defaults the repository
 * would have produced for a local account.
 */
function snapshotFrom(user: User): UserSnapshot {
  return makeUserSnapshot({
    id: user.id,
    name: user.name,
    email: user.email,
    passwordHash: user.passwordHash,
    role: user.role,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified,
    emailVerificationExpiresAt: user.emailVerificationExpiresAt,
    emailVerificationSentAt: user.emailVerificationSentAt,
    passwordResetExpiresAt: user.passwordResetExpiresAt,
    failedLoginAttempts: user.failedLoginAttempts,
    lockedUntil: user.lockedUntil,
  });
}

/** Builds a complete session snapshot with sensible defaults. */
export function makeSessionSnapshot(
  overrides: Partial<SessionSnapshot> = {},
): SessionSnapshot {
  return {
    id: "session-1",
    userId: "user-1",
    tokenHash: "hash:refresh-1",
    expiresAt: new Date("2026-02-01T00:00:00Z"),
    deviceInfo: "test-agent",
    ipAddress: "203.0.113.10",
    revokedAt: null,
    replacedByTokenId: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

/** In-memory account repository used by application tests. */
export class InMemoryUserRepository implements UserRepository {
  /** Accounts by id. */
  readonly users = new Map<string, User>();
  /** Number of verification emails issued, keyed by user id. */
  readonly verificationIssues = new Map<string, VerificationIssue>();
  /** Number of reset emails issued, keyed by user id. */
  readonly resetIssues = new Map<string, PasswordResetIssue>();
  /** Last persisted login state, keyed by user id. */
  readonly loginStates = new Map<
    string,
    {
      failedLoginAttempts: number;
      lockedUntil: Date | null;
      lastLoginAt?: Date;
    }
  >();
  /** Last OAuth login state, keyed by user id. */
  readonly oauthLogins = new Map<
    string,
    {
      providerId: string | null;
      avatarUrl: string | null;
      emailVerified: true;
      clearPassword: boolean;
      lastLoginAt: Date;
    }
  >();
  /** Accounts that were marked verified. */
  readonly verified = new Set<string>();
  /** New password hashes applied by a completed reset, keyed by user id. */
  readonly resetPasswords = new Map<string, string>();
  /**
   * Session repository to revoke through when a reset completes, so the fake
   * mirrors the single transaction the Prisma repository performs.
   */
  private sessions?: SessionRepository;

  /** Seeds an account. */
  seed(user: User): void {
    this.users.set(user.id, user);
  }

  /** Wires the session repository a completed reset revokes through. */
  attachSessions(sessions: SessionRepository): void {
    this.sessions = sessions;
  }

  /**
   * Builds the entity a read should see.
   *
   * The fake keeps one stored entity per account, but use cases must never
   * mutate it by reference. A read reconstitutes a fresh entity and overlays
   * the fields the repository persists in separate maps, so callers can hold
   * different snapshots of the same account and a read always reflects the
   * last committed state.
   */
  private view(user: User): User {
    const login = this.loginStates.get(user.id);
    const oauth = this.oauthLogins.get(user.id);
    return User.reconstitute(
      makeUserSnapshot({
        id: user.id,
        name: user.name,
        email: user.email,
        passwordHash: user.passwordHash,
        role: user.role,
        authProvider: user.authProvider,
        providerId: oauth?.providerId ?? user.providerId,
        avatarUrl: oauth?.avatarUrl ?? user.avatarUrl,
        emailVerified: this.verified.has(user.id) ? true : user.emailVerified,
        emailVerificationExpiresAt: user.emailVerificationExpiresAt,
        emailVerificationSentAt: user.emailVerificationSentAt,
        passwordResetExpiresAt: user.passwordResetExpiresAt,
        failedLoginAttempts:
          login?.failedLoginAttempts ?? user.failedLoginAttempts,
        lockedUntil: login?.lockedUntil ?? user.lockedUntil,
        lastLoginAt: login?.lastLoginAt ?? null,
      }),
    );
  }

  /** @inheritdoc */
  async findByEmail(email: string): Promise<User | null> {
    const found = [...this.users.values()].find((user) => user.email === email);
    return found ? this.view(found) : null;
  }

  /** @inheritdoc */
  async findById(id: string): Promise<User | null> {
    const found = this.users.get(id);
    return found ? this.view(found) : null;
  }

  /** @inheritdoc */
  async findByVerificationTokenHash(tokenHash: string): Promise<User | null> {
    for (const [userId, issue] of this.verificationIssues) {
      if (issue.tokenHash === tokenHash) {
        const user = this.users.get(userId);
        if (!user) {
          return null;
        }
        return User.reconstitute({
          ...snapshotFrom(this.view(user)),
          emailVerificationExpiresAt: issue.expiresAt,
          emailVerificationSentAt: issue.sentAt,
        });
      }
    }
    return null;
  }

  /** @inheritdoc */
  async findByPasswordResetTokenHash(tokenHash: string): Promise<User | null> {
    for (const [userId, issue] of this.resetIssues) {
      if (issue.tokenHash === tokenHash) {
        const user = this.users.get(userId);
        if (!user) {
          return null;
        }
        return User.reconstitute({
          ...snapshotFrom(this.view(user)),
          passwordResetExpiresAt: issue.expiresAt,
        });
      }
    }
    return null;
  }

  /** @inheritdoc */
  async createLocal(input: CreateLocalUserInput): Promise<User> {
    if (await this.findByEmail(input.email)) {
      throw new EmailAlreadyExistsError();
    }
    const user = User.reconstitute(
      makeUserSnapshot({
        id: `user-${this.users.size + 1}`,
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        emailVerified: false,
      }),
    );
    this.users.set(user.id, user);
    return user;
  }

  /** @inheritdoc */
  async createOAuth(input: CreateOAuthUserInput): Promise<User> {
    const user = User.reconstitute(
      makeUserSnapshot({
        id: `user-${this.users.size + 1}`,
        name: input.name,
        email: input.email,
        passwordHash: null,
        authProvider: input.provider,
        providerId: input.providerId,
        avatarUrl: input.avatarUrl,
        emailVerified: true,
        lastLoginAt: input.lastLoginAt,
      }),
    );
    this.users.set(user.id, user);
    return user;
  }

  /** @inheritdoc */
  async saveVerificationIssue(
    userId: string,
    issue: VerificationIssue,
  ): Promise<void> {
    this.verificationIssues.set(userId, issue);
  }

  /** @inheritdoc */
  async saveVerified(userId: string, tokenHash: string): Promise<boolean> {
    const issue = this.verificationIssues.get(userId);
    if (!issue || issue.tokenHash !== tokenHash) {
      return false;
    }
    this.verified.add(userId);
    this.verificationIssues.delete(userId);
    return true;
  }

  /** @inheritdoc */
  async savePasswordResetIssue(
    userId: string,
    issue: PasswordResetIssue,
  ): Promise<void> {
    this.resetIssues.set(userId, issue);
  }

  /** @inheritdoc */
  async completePasswordReset(input: {
    userId: string;
    passwordHash: string;
    tokenHash: string;
    now: Date;
  }): Promise<boolean> {
    const issue = this.resetIssues.get(input.userId);
    if (!issue || issue.tokenHash !== input.tokenHash) {
      return false;
    }
    this.resetPasswords.set(input.userId, input.passwordHash);
    this.verified.add(input.userId);
    this.resetIssues.delete(input.userId);
    await this.sessions?.revokeAllForUser(input.userId, input.now);
    return true;
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
    this.loginStates.set(userId, state);
  }

  /** @inheritdoc */
  async saveSuccessfulLogin(
    userId: string,
    state: {
      failedLoginAttempts: number;
      lockedUntil: Date | null;
      lastLoginAt: Date;
    },
    expectedFailedLoginAttempts: number,
  ): Promise<boolean> {
    const current =
      this.loginStates.get(userId)?.failedLoginAttempts ??
      this.users.get(userId)?.failedLoginAttempts ??
      0;

    if (current !== expectedFailedLoginAttempts) {
      // A parallel failure committed first. Keep its count and lock, and only
      // stamp the sign in time.
      this.loginStates.set(userId, {
        failedLoginAttempts: current,
        lockedUntil: this.loginStates.get(userId)?.lockedUntil ?? null,
        lastLoginAt: state.lastLoginAt,
      });
      return false;
    }

    this.loginStates.set(userId, state);
    return true;
  }

  /** @inheritdoc */
  async saveFailedLogin(
    userId: string,
    state: { failedLoginAttempts: number; lockedUntil: Date | null },
    expectedFailedLoginAttempts: number,
  ): Promise<boolean> {
    const current =
      this.loginStates.get(userId)?.failedLoginAttempts ??
      this.users.get(userId)?.failedLoginAttempts ??
      0;

    if (current !== expectedFailedLoginAttempts) {
      return false;
    }

    this.loginStates.set(userId, state);
    return true;
  }

  /** @inheritdoc */
  async saveOAuthLogin(
    userId: string,
    state: {
      providerId: string | null;
      avatarUrl: string | null;
      emailVerified: true;
      clearPassword: boolean;
      lastLoginAt: Date;
    },
  ): Promise<void> {
    this.oauthLogins.set(userId, state);
    this.verificationIssues.delete(userId);
    this.resetIssues.delete(userId);
    this.verified.add(userId);
  }
}

/** In-memory refresh token repository used by application tests. */
export class InMemorySessionRepository implements SessionRepository {
  /** Stored session rows by id. */
  readonly sessions = new Map<string, SessionSnapshot>();

  /** Seeds a session. */
  seed(session: Session): void {
    this.sessions.set(session.id, {
      id: session.id,
      userId: session.userId,
      tokenHash: session.tokenHash,
      expiresAt: session.expiresAt,
      deviceInfo: session.deviceInfo,
      ipAddress: session.ipAddress,
      revokedAt: session.revokedAt,
      replacedByTokenId: session.replacedByTokenId,
      createdAt: session.createdAt,
    });
  }

  /** Counts sessions that are still active. */
  activeCount(): number {
    return [...this.sessions.values()].filter((row) => row.revokedAt === null)
      .length;
  }

  /** @inheritdoc */
  async create(input: CreateSessionInput): Promise<Session> {
    const id = `session-${this.sessions.size + 1}`;
    const row: SessionSnapshot = {
      id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      deviceInfo: input.deviceInfo,
      ipAddress: input.ipAddress,
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: new Date(),
    };
    this.sessions.set(id, row);
    return Session.reconstitute(row);
  }

  /** @inheritdoc */
  async findById(id: string): Promise<Session | null> {
    const row = this.sessions.get(id);
    return row ? Session.reconstitute(row) : null;
  }

  /** @inheritdoc */
  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const row = [...this.sessions.values()].find(
      (session) => session.tokenHash === tokenHash,
    );
    return row ? Session.reconstitute(row) : null;
  }

  /** @inheritdoc */
  async rotate(id: string, input: RotateSessionInput): Promise<Session | null> {
    const row = this.sessions.get(id);
    if (!row || row.revokedAt !== null) {
      return null;
    }

    // Claim the predecessor before yielding so two callers cannot both win.
    row.revokedAt = input.revokedAt;
    const successor = await this.create(input);
    row.replacedByTokenId = successor.id;
    return successor;
  }

  /** @inheritdoc */
  async revokeChain(id: string, now: Date): Promise<void> {
    let currentId: string | null = id;
    const visited = new Set<string>();

    while (currentId !== null && !visited.has(currentId)) {
      visited.add(currentId);

      const row = this.sessions.get(currentId);
      if (!row) {
        return;
      }

      // Keep an existing revoke time so sign out never extends the grace window.
      if (row.revokedAt === null) {
        row.revokedAt = now;
      }

      currentId = row.replacedByTokenId;
    }
  }

  /** @inheritdoc */
  async revokeAllForUser(userId: string, now: Date): Promise<void> {
    for (const row of this.sessions.values()) {
      if (row.userId === userId && row.revokedAt === null) {
        row.revokedAt = now;
      }
    }
  }
}

/** Password hasher with a predictable format, no bcrypt cost in unit tests. */
export const fakePasswordHasher: PasswordHasher = {
  hash: async (password) => `hashed:${password}`,
  verify: async (password, hash) => hash === `hashed:${password}`,
};

/** Token service with predictable values and no cryptography. */
export class FakeTokenService implements TokenService {
  private counter = 0;

  /** @inheritdoc */
  async signAccessToken(claims: AccessTokenClaims): Promise<string> {
    return `access:${claims.sub}:${claims.role}`;
  }

  /** @inheritdoc */
  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    const [, sub = "", role = "CUSTOMER"] = token.split(":");
    return { sub, role: role as AccessTokenClaims["role"] };
  }

  /** @inheritdoc */
  generateOpaqueToken(): string {
    this.counter += 1;
    return `refresh-${this.counter}`;
  }

  /** @inheritdoc */
  hashOpaqueToken(token: string): string {
    return `hash:${token}`;
  }

  /** @inheritdoc */
  async signOAuthState(claims: OAuthStateClaims): Promise<string> {
    return `state:${claims.provider}:${claims.nonce}:${claims.next}`;
  }

  /** @inheritdoc */
  async verifyOAuthState(token: string): Promise<OAuthStateClaims> {
    const [, provider = "google", nonce = "", next = "/"] = token.split(":");
    return {
      nonce,
      next,
      provider: provider === "facebook" ? "facebook" : "google",
    };
  }
}

/** Email sender that records messages instead of sending them. */
export class RecordingEmailSender implements EmailSender {
  /** Verification emails sent. */
  readonly verification: AuthEmail[] = [];
  /** Password reset emails sent. */
  readonly reset: AuthEmail[] = [];

  /** @inheritdoc */
  async sendVerificationEmail(email: AuthEmail): Promise<void> {
    this.verification.push(email);
  }

  /** @inheritdoc */
  async sendPasswordResetEmail(email: AuthEmail): Promise<void> {
    this.reset.push(email);
  }
}

/** Builds injectable auth dependencies with in-memory fakes. */
export function createTestDependencies(
  overrides: Partial<AuthDependencies> = {},
): {
  deps: AuthDependencies;
  users: InMemoryUserRepository;
  sessions: InMemorySessionRepository;
  tokens: FakeTokenService;
  emails: RecordingEmailSender;
  clock: TestClock;
} {
  const users = new InMemoryUserRepository();
  const sessions = new InMemorySessionRepository();
  const tokens = new FakeTokenService();
  const emails = new RecordingEmailSender();
  const clock = createTestClock(new Date("2026-01-01T00:00:00Z"));

  // A completed password reset revokes sessions inside one transaction in
  // production; the fake needs the same link so its behaviour matches.
  users.attachSessions(sessions);

  return {
    users,
    sessions,
    tokens,
    emails,
    clock,
    deps: {
      users,
      sessions,
      passwords: fakePasswordHasher,
      tokens,
      emails,
      clock,
      webAppUrl: "https://shop.example.com",
      isProduction: false,
      ...overrides,
    },
  };
}
