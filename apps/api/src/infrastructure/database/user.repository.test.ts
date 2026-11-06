/**
 * Integration tests for the Prisma account repository.
 *
 * The repository is the only place that knows both Prisma and the domain. These
 * tests run against a real PostgreSQL database and prove the mapping in both
 * directions: a row becomes an entity that enforces its own rules, and every
 * write lands on the columns the spec names. The unique email violation is the
 * one error path that cannot be checked through the use cases alone, because
 * the application depends on the repository translating it.
 *
 * The database is shared, so every address is randomized and every row created
 * here is deleted afterwards.
 */
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { config as loadDotEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { User } from "../../domain/entities/user.js";
import { EmailAlreadyExistsError } from "../../domain/errors.js";
import { createDatabase, type Database } from "./prisma.js";
import { PrismaUserRepository } from "./user.repository.js";

loadDotEnv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});

const databaseUrl = process.env["DATABASE_URL"];
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase("PrismaUserRepository", () => {
  let database: Database;
  let repository: PrismaUserRepository;
  const createdEmails: string[] = [];

  beforeAll(() => {
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required.");
    }

    database = createDatabase(databaseUrl);
    repository = new PrismaUserRepository(database.client);
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      await database.client.user.deleteMany({
        where: { email: { in: createdEmails } },
      });
    }
    await database.disconnect();
  });

  /** Creates a unique address and schedules it for cleanup. */
  function uniqueEmail(prefix: string): string {
    const email = `${prefix}-${randomUUID()}@example.com`;
    createdEmails.push(email);
    return email;
  }

  describe("createLocal", () => {
    it("stores the account as an unverified CUSTOMER and returns the entity", async () => {
      const email = uniqueEmail("repo-local");

      const user = await repository.createLocal({
        name: "Repo Customer",
        email,
        passwordHash: "hashed:correct horse",
      });

      expect(user).toBeInstanceOf(User);
      expect(user.emailVerified).toBe(false);
      expect(user.role).toBe("CUSTOMER");
      expect(user.passwordHash).toBe("hashed:correct horse");

      const row = await database.client.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(row.email).toBe(email);
      expect(row.authProvider).toBe("LOCAL");
      expect(row.role).toBe("CUSTOMER");
      expect(row.emailVerified).toBe(false);
    });

    it("translates a duplicate email into EmailAlreadyExistsError", async () => {
      const email = uniqueEmail("repo-duplicate");
      await repository.createLocal({
        name: "First",
        email,
        passwordHash: "hashed:one",
      });

      await expect(
        repository.createLocal({
          name: "Second",
          email,
          passwordHash: "hashed:two",
        }),
      ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
    });

    it("keeps the failure counter and the lock unset for a new account", async () => {
      const email = uniqueEmail("repo-fresh");

      const user = await repository.createLocal({
        name: "Fresh",
        email,
        passwordHash: "hashed:x",
      });

      expect(user.failedLoginAttempts).toBe(0);
      expect(user.lockedUntil).toBeNull();
    });
  });

  describe("createOAuth", () => {
    it("stores the provider, id, avatar, and the sign in time", async () => {
      const email = uniqueEmail("repo-oauth");
      const signedInAt = new Date("2026-02-03T04:05:06.000Z");

      const user = await repository.createOAuth({
        name: "OAuth Customer",
        email,
        provider: "GOOGLE",
        providerId: "google-sub-9",
        avatarUrl: "https://cdn.example.com/avatar.png",
        lastLoginAt: signedInAt,
      });

      const row = await database.client.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(row.authProvider).toBe("GOOGLE");
      expect(row.providerId).toBe("google-sub-9");
      expect(row.avatarUrl).toBe("https://cdn.example.com/avatar.png");
      expect(row.emailVerified).toBe(true);
      expect(row.passwordHash).toBeNull();
      expect(row.lastLoginAt?.toISOString()).toBe(signedInAt.toISOString());
    });
  });

  describe("lookups", () => {
    it("finds an account by email and by id", async () => {
      const email = uniqueEmail("repo-find");
      const created = await repository.createLocal({
        name: "Find Me",
        email,
        passwordHash: "hashed:x",
      });

      const byEmail = await repository.findByEmail(email);
      const byId = await repository.findById(created.id);

      expect(byEmail?.id).toBe(created.id);
      expect(byId?.email).toBe(email);
    });

    it("returns null for an unknown email and an unknown id", async () => {
      expect(await repository.findByEmail("absent@example.com")).toBeNull();
      expect(
        await repository.findById("00000000-0000-0000-0000-000000000000"),
      ).toBeNull();
    });
  });

  describe("verification link", () => {
    it("finds an account by its stored token hash", async () => {
      const email = uniqueEmail("repo-verify");
      const user = await repository.createLocal({
        name: "Verify Me",
        email,
        passwordHash: "hashed:x",
      });
      const expiresAt = new Date("2026-03-01T00:00:00.000Z");
      const sentAt = new Date("2026-02-28T00:00:00.000Z");

      await repository.saveVerificationIssue(user.id, {
        tokenHash: "hash:verification-token",
        expiresAt,
        sentAt,
      });

      const found = await repository.findByVerificationTokenHash(
        "hash:verification-token",
      );

      expect(found?.id).toBe(user.id);
      expect(found?.emailVerificationExpiresAt?.toISOString()).toBe(
        expiresAt.toISOString(),
      );
      expect(found?.emailVerificationSentAt?.toISOString()).toBe(
        sentAt.toISOString(),
      );
    });

    it("clears the stored link once the account is verified", async () => {
      const email = uniqueEmail("repo-verified");
      const user = await repository.createLocal({
        name: "Verified",
        email,
        passwordHash: "hashed:x",
      });
      await repository.saveVerificationIssue(user.id, {
        tokenHash: "hash:to-clear",
        expiresAt: new Date("2026-03-01T00:00:00.000Z"),
        sentAt: new Date(),
      });

      const consumed = await repository.saveVerified(user.id, "hash:to-clear");

      expect(consumed).toBe(true);

      const row = await database.client.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(row.emailVerified).toBe(true);
      expect(row.emailVerificationToken).toBeNull();
      expect(row.emailVerificationExpiresAt).toBeNull();
      expect(
        await repository.findByVerificationTokenHash("hash:to-clear"),
      ).toBeNull();
      // The second redemption of the same link finds no matching digest.
      expect(await repository.saveVerified(user.id, "hash:to-clear")).toBe(
        false,
      );
    });
  });

  describe("password reset", () => {
    it("finds an account by its reset token hash", async () => {
      const email = uniqueEmail("repo-reset");
      const user = await repository.createLocal({
        name: "Reset Me",
        email,
        passwordHash: "hashed:x",
      });
      const expiresAt = new Date("2026-03-01T00:00:00.000Z");

      await repository.savePasswordResetIssue(user.id, {
        tokenHash: "hash:reset-token",
        expiresAt,
      });

      const found =
        await repository.findByPasswordResetTokenHash("hash:reset-token");

      expect(found?.id).toBe(user.id);
      expect(found?.passwordResetExpiresAt?.toISOString()).toBe(
        expiresAt.toISOString(),
      );
    });

    it("stores the new hash and clears the link, the lock, and the count", async () => {
      const email = uniqueEmail("repo-reset-apply");
      const user = await repository.createLocal({
        name: "Apply Reset",
        email,
        passwordHash: "hashed:old",
      });
      await repository.savePasswordResetIssue(user.id, {
        tokenHash: "hash:apply",
        expiresAt: new Date("2026-03-01T00:00:00.000Z"),
      });
      await repository.saveLoginState(user.id, {
        failedLoginAttempts: 4,
        lockedUntil: new Date("2026-04-01T00:00:00.000Z"),
      });

      const consumed = await repository.completePasswordReset({
        userId: user.id,
        passwordHash: "hashed:new",
        tokenHash: "hash:apply",
        now: new Date("2026-03-02T00:00:00.000Z"),
      });

      expect(consumed).toBe(true);

      const row = await database.client.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(row.passwordHash).toBe("hashed:new");
      expect(row.passwordResetToken).toBeNull();
      expect(row.passwordResetExpiresAt).toBeNull();
      expect(row.failedLoginAttempts).toBe(0);
      expect(row.lockedUntil).toBeNull();
      // Replaying the spent link changes nothing and reports the miss.
      expect(
        await repository.completePasswordReset({
          userId: user.id,
          passwordHash: "hashed:again",
          tokenHash: "hash:apply",
          now: new Date("2026-03-02T00:00:00.000Z"),
        }),
      ).toBe(false);
      const unchanged = await database.client.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(unchanged.passwordHash).toBe("hashed:new");
    });
  });

  describe("saveLoginState", () => {
    it("stores the failure count and the lock", async () => {
      const email = uniqueEmail("repo-lock");
      const user = await repository.createLocal({
        name: "Locked",
        email,
        passwordHash: "hashed:x",
      });
      const lockedUntil = new Date("2026-05-01T10:00:00.000Z");

      await repository.saveLoginState(user.id, {
        failedLoginAttempts: 5,
        lockedUntil,
      });

      const row = await database.client.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(row.failedLoginAttempts).toBe(5);
      expect(row.lockedUntil?.toISOString()).toBe(lockedUntil.toISOString());
    });

    it("leaves lastLoginAt untouched when the state omits it", async () => {
      const email = uniqueEmail("repo-keep-login-time");
      const user = await repository.createLocal({
        name: "Keep Time",
        email,
        passwordHash: "hashed:x",
      });

      await repository.saveLoginState(user.id, {
        failedLoginAttempts: 1,
        lockedUntil: null,
      });

      const row = await database.client.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(row.lastLoginAt).toBeNull();
    });

    it("records the sign in time and clears the lock on success", async () => {
      const email = uniqueEmail("repo-set-login-time");
      const user = await repository.createLocal({
        name: "Set Time",
        email,
        passwordHash: "hashed:x",
      });
      const lastLoginAt = new Date("2026-06-01T12:00:00.000Z");

      await repository.saveLoginState(user.id, {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt,
      });

      const row = await database.client.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(row.lastLoginAt?.toISOString()).toBe(lastLoginAt.toISOString());
      expect(row.failedLoginAttempts).toBe(0);
      expect(row.lockedUntil).toBeNull();
    });
  });

  describe("saveSuccessfulLogin", () => {
    it("clears the counter and lock when the count still matches", async () => {
      const email = uniqueEmail("repo-success-match");
      const user = await repository.createLocal({
        name: "Success Match",
        email,
        passwordHash: "hashed:x",
      });
      await repository.saveLoginState(user.id, {
        failedLoginAttempts: 3,
        lockedUntil: null,
      });
      const lastLoginAt = new Date("2026-08-01T12:00:00.000Z");

      await expect(
        repository.saveSuccessfulLogin(
          user.id,
          { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt },
          3,
        ),
      ).resolves.toBe(true);

      const row = await database.client.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(row.failedLoginAttempts).toBe(0);
      expect(row.lockedUntil).toBeNull();
      expect(row.lastLoginAt?.toISOString()).toBe(lastLoginAt.toISOString());
    });

    it("keeps a newer failure count and still records the sign in time", async () => {
      const email = uniqueEmail("repo-success-stale");
      const user = await repository.createLocal({
        name: "Success Stale",
        email,
        passwordHash: "hashed:x",
      });
      await repository.saveLoginState(user.id, {
        failedLoginAttempts: 4,
        lockedUntil: null,
      });
      const lastLoginAt = new Date("2026-08-02T12:00:00.000Z");

      await expect(
        repository.saveSuccessfulLogin(
          user.id,
          { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt },
          3,
        ),
      ).resolves.toBe(false);

      const row = await database.client.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      // The stale success write must not erase the parallel failure.
      expect(row.failedLoginAttempts).toBe(4);
      expect(row.lastLoginAt?.toISOString()).toBe(lastLoginAt.toISOString());
    });
  });

  describe("saveFailedLogin", () => {
    it("persists the increment when the counter still matches", async () => {
      const email = uniqueEmail("repo-failed-match");
      const user = await repository.createLocal({
        name: "Failed Match",
        email,
        passwordHash: "hashed:x",
      });

      await expect(
        repository.saveFailedLogin(
          user.id,
          { failedLoginAttempts: 1, lockedUntil: null },
          0,
        ),
      ).resolves.toBe(true);

      const row = await database.client.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(row.failedLoginAttempts).toBe(1);
    });

    it("refuses the write when the stored counter has moved on", async () => {
      const email = uniqueEmail("repo-failed-stale");
      const user = await repository.createLocal({
        name: "Failed Stale",
        email,
        passwordHash: "hashed:x",
      });
      await repository.saveLoginState(user.id, {
        failedLoginAttempts: 1,
        lockedUntil: null,
      });

      await expect(
        repository.saveFailedLogin(
          user.id,
          { failedLoginAttempts: 1, lockedUntil: null },
          0,
        ),
      ).resolves.toBe(false);

      const row = await database.client.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      // The stale write must not overwrite the newer count.
      expect(row.failedLoginAttempts).toBe(1);
    });

    it("lets exactly one of two parallel writes win", async () => {
      const email = uniqueEmail("repo-failed-race");
      const user = await repository.createLocal({
        name: "Failed Race",
        email,
        passwordHash: "hashed:x",
      });

      const results = await Promise.all([
        repository.saveFailedLogin(
          user.id,
          { failedLoginAttempts: 1, lockedUntil: null },
          0,
        ),
        repository.saveFailedLogin(
          user.id,
          { failedLoginAttempts: 1, lockedUntil: null },
          0,
        ),
      ]);

      expect(results.filter(Boolean)).toHaveLength(1);
    });
  });

  describe("saveOAuthLogin", () => {
    it("keeps the existing password when the link does not clear it", async () => {
      const email = uniqueEmail("repo-oauth-keep");
      const user = await repository.createLocal({
        name: "Keep Password",
        email,
        passwordHash: "hashed:kept",
      });
      const lastLoginAt = new Date("2026-07-01T00:00:00.000Z");

      await repository.saveOAuthLogin(user.id, {
        providerId: "facebook-1",
        avatarUrl: "https://cdn.example.com/f.png",
        emailVerified: true,
        clearPassword: false,
        lastLoginAt,
      });

      const row = await database.client.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(row.passwordHash).toBe("hashed:kept");
      expect(row.providerId).toBe("facebook-1");
      expect(row.avatarUrl).toBe("https://cdn.example.com/f.png");
      expect(row.emailVerified).toBe(true);
      expect(row.lastLoginAt?.toISOString()).toBe(lastLoginAt.toISOString());
    });

    it("clears pending verification and reset links", async () => {
      const email = uniqueEmail("repo-oauth-clear-links");
      const user = await repository.createLocal({
        name: "Clear Links",
        email,
        passwordHash: "hashed:kept",
      });
      await database.client.user.update({
        where: { id: user.id },
        data: {
          emailVerificationToken: "verify-hash",
          emailVerificationExpiresAt: new Date("2027-01-01T00:00:00.000Z"),
          emailVerificationSentAt: new Date("2026-12-01T00:00:00.000Z"),
          passwordResetToken: "reset-hash",
          passwordResetExpiresAt: new Date("2027-01-02T00:00:00.000Z"),
        },
      });

      await repository.saveOAuthLogin(user.id, {
        providerId: "google-3",
        avatarUrl: null,
        emailVerified: true,
        clearPassword: false,
        lastLoginAt: new Date("2026-12-03T00:00:00.000Z"),
      });

      const row = await database.client.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(row.emailVerificationToken).toBeNull();
      expect(row.emailVerificationExpiresAt).toBeNull();
      expect(row.emailVerificationSentAt).toBeNull();
      expect(row.passwordResetToken).toBeNull();
      expect(row.passwordResetExpiresAt).toBeNull();
    });

    it("clears the password when the link says to", async () => {
      const email = uniqueEmail("repo-oauth-clear");
      const user = await repository.createLocal({
        name: "Clear Password",
        email,
        passwordHash: "hashed:cleared",
      });

      await repository.saveOAuthLogin(user.id, {
        providerId: "google-2",
        avatarUrl: null,
        emailVerified: true,
        clearPassword: true,
        lastLoginAt: new Date("2026-07-02T00:00:00.000Z"),
      });

      const row = await database.client.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(row.passwordHash).toBeNull();
      expect(row.emailVerified).toBe(true);
    });

    it("stores a null provider id when the link has none", async () => {
      const email = uniqueEmail("repo-oauth-null");
      const user = await repository.createLocal({
        name: "Null Provider",
        email,
        passwordHash: "hashed:kept",
      });

      await repository.saveOAuthLogin(user.id, {
        providerId: null,
        avatarUrl: null,
        emailVerified: true,
        clearPassword: false,
        lastLoginAt: new Date("2026-07-03T00:00:00.000Z"),
      });

      const row = await database.client.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(row.providerId).toBeNull();
    });
  });
});
