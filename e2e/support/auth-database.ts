/**
 * Database fixtures for the browser auth tests.
 *
 * Verification and reset links are only useful while the raw token exists in
 * the email. The API stores an HMAC of that token, never the raw value, so a
 * browser test cannot recover a token from the database. This helper writes a
 * known token hash for a test account instead, which lets the suite drive the
 * real link, screen, proxy, and API without depending on a mailbox.
 *
 * Accounts created here are deleted when the test finishes.
 */
import path from "node:path";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { config } from "dotenv";
import { Client, type QueryResultRow } from "pg";

config({ path: path.resolve(process.cwd(), "apps/api/.env"), quiet: true });

const DEFAULT_PASSWORD = "correct horse battery";
const DEFAULT_NAME = "E2E Customer";
const VERIFICATION_LIFETIME_MS = 24 * 60 * 60 * 1000;
const RESET_LIFETIME_MS = 60 * 60 * 1000;
const RESEND_AGE_MS = 2 * 60 * 1000;

/** A role accepted by the users table. */
export type TestUserRole = "CUSTOMER" | "ADMIN";

/** A test account and the password it was created with. */
export interface TestUser {
  id: string;
  email: string;
  password: string;
}

/** Options for a new test account. */
export interface CreateUserOptions {
  email?: string;
  password?: string;
  role?: TestUserRole;
  verified?: boolean;
}

/** Options for a verification token. */
export interface VerificationTokenOptions {
  expiresAt?: Date;
  sentAt?: Date;
}

/** Options for a reset token. */
export interface ResetTokenOptions {
  expiresAt?: Date;
}

/** The fields the tests read back from a user row. */
interface UserRow extends QueryResultRow {
  emailVerified: boolean;
  emailVerificationToken: string | null;
  failedLoginAttempts: number;
  role: string;
  passwordHash: string | null;
}

/** Reads a required environment value, failing with a useful message. */
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is required for the browser tests. Start from apps/api/.env.`,
    );
  }
  return value;
}

/**
 * Creates a random opaque token in the format the API issues.
 *
 * @returns A URL safe token for a verification or reset link.
 */
export function createOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Hashes a token the same way the API does before storing it. */
function hashOpaqueToken(token: string): string {
  return createHmac("sha256", requiredEnv("JWT_REFRESH_SECRET"))
    .update(token)
    .digest("hex");
}

/**
 * Formats an instant as the UTC wall time Prisma stores in a timestamp column.
 *
 * PostgreSQL stores `timestamp(3)` without a zone. A Date handed straight to
 * `pg` is written in the server's local zone, while Prisma reads the same
 * column as UTC, which moves the value by the local offset. Writing the UTC
 * text keeps the fixture and the API on the same clock.
 */
function utcTimestamp(value: Date): string {
  return value.toISOString().slice(0, 23).replace("T", " ");
}

/** Owns one database connection and the accounts a test created. */
export class AuthDatabase {
  private readonly createdUserIds: string[] = [];

  private constructor(private readonly client: Client) {}

  /**
   * Opens a connection using the API database URL.
   *
   * @returns A fixture ready for a test.
   */
  static async open(): Promise<AuthDatabase> {
    const client = new Client({
      connectionString: requiredEnv("DATABASE_URL"),
    });
    await client.connect();
    return new AuthDatabase(client);
  }

  /**
   * Creates a verified or unverified local account.
   *
   * @param options Values to override for the account.
   * @returns The account, including the password for signing in.
   */
  async createUser(options: CreateUserOptions = {}): Promise<TestUser> {
    const id = randomUUID();
    const email =
      options.email ??
      `e2e-${String(Date.now())}-${randomUUID().slice(0, 8)}@example.com`;
    const password = options.password ?? DEFAULT_PASSWORD;
    const role = options.role ?? "CUSTOMER";
    const verified = options.verified ?? true;
    const passwordHash = await hash(password, 10);
    const now = utcTimestamp(new Date());

    await this.client.query(
      `INSERT INTO users
        (id, name, email, password_hash, role, email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
      [id, DEFAULT_NAME, email, passwordHash, role, verified, now],
    );
    this.createdUserIds.push(id);

    return { id, email, password };
  }

  /**
   * Attaches a known verification token to an account.
   *
   * @param userId Account that owns the token.
   * @param token Raw token to place in the test link.
   * @param options Expiry and last sent time.
   */
  async issueEmailVerification(
    userId: string,
    token: string,
    options: VerificationTokenOptions = {},
  ): Promise<void> {
    const expiresAt =
      options.expiresAt ?? new Date(Date.now() + VERIFICATION_LIFETIME_MS);
    const sentAt = options.sentAt ?? new Date(Date.now() - RESEND_AGE_MS);
    const now = utcTimestamp(new Date());

    await this.client.query(
      `UPDATE users
       SET email_verification_token = $2,
           email_verification_expires_at = $3,
           email_verification_sent_at = $4,
           updated_at = $5
       WHERE id = $1`,
      [
        userId,
        hashOpaqueToken(token),
        utcTimestamp(expiresAt),
        utcTimestamp(sentAt),
        now,
      ],
    );
  }

  /**
   * Attaches a known password reset token to an account.
   *
   * @param userId Account that owns the token.
   * @param token Raw token to place in the test link.
   * @param options Expiry time.
   */
  async issuePasswordReset(
    userId: string,
    token: string,
    options: ResetTokenOptions = {},
  ): Promise<void> {
    const expiresAt =
      options.expiresAt ?? new Date(Date.now() + RESET_LIFETIME_MS);
    const now = utcTimestamp(new Date());

    await this.client.query(
      `UPDATE users
       SET password_reset_token = $2,
           password_reset_expires_at = $3,
           updated_at = $4
       WHERE id = $1`,
      [userId, hashOpaqueToken(token), utcTimestamp(expiresAt), now],
    );
  }

  /**
   * Reads the account state a test wants to assert.
   *
   * @param userId Account to read.
   * @returns The stored authentication fields.
   */
  async getUser(userId: string): Promise<UserRow> {
    const result = await this.client.query<UserRow>(
      `SELECT email_verified AS "emailVerified",
              email_verification_token AS "emailVerificationToken",
              failed_login_attempts AS "failedLoginAttempts",
              role::text AS role,
              password_hash AS "passwordHash"
       FROM users
       WHERE id = $1`,
      [userId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error("The test account disappeared from the database.");
    }
    return row;
  }

  /**
   * Changes a role while a session is open.
   *
   * @param userId Account to change.
   * @param role New role.
   */
  async setRole(userId: string, role: TestUserRole): Promise<void> {
    await this.client.query(
      `UPDATE users SET role = $2, updated_at = $3 WHERE id = $1`,
      [userId, role, utcTimestamp(new Date())],
    );
  }

  /** Deletes every account this fixture created and closes the connection. */
  async close(): Promise<void> {
    if (this.createdUserIds.length > 0) {
      await this.client.query(
        `DELETE FROM refresh_tokens WHERE user_id = ANY($1::text[])`,
        [this.createdUserIds],
      );
      await this.client.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [
        this.createdUserIds,
      ]);
    }
    await this.client.end();
  }
}
