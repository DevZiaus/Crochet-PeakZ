/**
 * Integration tests for the Prisma refresh token repository.
 *
 * The rotation claim is the one rule that cannot be proved with an in-memory
 * fake: two concurrent refreshes must not open two live token chains. These
 * tests run against a real PostgreSQL database and clean up their own rows.
 */
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { config as loadDotEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, type Database } from "./prisma.js";
import { PrismaSessionRepository } from "./session.repository.js";
import { PrismaUserRepository } from "./user.repository.js";

loadDotEnv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});

const databaseUrl = process.env["DATABASE_URL"];
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase("PrismaSessionRepository", () => {
  let database: Database;
  let sessions: PrismaSessionRepository;
  let users: PrismaUserRepository;
  const createdEmails: string[] = [];

  beforeAll(() => {
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required.");
    }

    database = createDatabase(databaseUrl);
    sessions = new PrismaSessionRepository(database.client);
    users = new PrismaUserRepository(database.client);
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

  it("lets exactly one of two concurrent rotations claim the row", async () => {
    const user = await users.createLocal({
      name: "Rotation Racer",
      email: uniqueEmail("repo-session-race"),
      passwordHash: "hashed:race",
    });
    const now = new Date();
    const predecessor = await sessions.create({
      userId: user.id,
      tokenHash: `hash-${randomUUID()}`,
      expiresAt: new Date(now.getTime() + 60_000),
      deviceInfo: null,
      ipAddress: null,
    });

    const successors = await Promise.all([
      sessions.rotate(predecessor.id, {
        userId: user.id,
        tokenHash: `hash-${randomUUID()}`,
        expiresAt: new Date(now.getTime() + 60_000),
        deviceInfo: null,
        ipAddress: null,
        revokedAt: now,
      }),
      sessions.rotate(predecessor.id, {
        userId: user.id,
        tokenHash: `hash-${randomUUID()}`,
        expiresAt: new Date(now.getTime() + 60_000),
        deviceInfo: null,
        ipAddress: null,
        revokedAt: now,
      }),
    ]);

    expect(successors.filter((successor) => successor !== null)).toHaveLength(
      1,
    );

    const rows = await database.client.refreshToken.findMany({
      where: { userId: user.id },
    });
    expect(rows.filter((row) => row.revokedAt === null)).toHaveLength(1);
  });

  it("returns null when the row is already revoked", async () => {
    const user = await users.createLocal({
      name: "Already Rotated",
      email: uniqueEmail("repo-session-revoked"),
      passwordHash: "hashed:revoked",
    });
    const now = new Date();
    const predecessor = await sessions.create({
      userId: user.id,
      tokenHash: `hash-${randomUUID()}`,
      expiresAt: new Date(now.getTime() + 60_000),
      deviceInfo: null,
      ipAddress: null,
    });

    await sessions.revokeChain(predecessor.id, now);

    await expect(
      sessions.rotate(predecessor.id, {
        userId: user.id,
        tokenHash: `hash-${randomUUID()}`,
        expiresAt: new Date(now.getTime() + 60_000),
        deviceInfo: null,
        ipAddress: null,
        revokedAt: now,
      }),
    ).resolves.toBeNull();
  });

  it("revokes a successor linked while the guarded write was blocked", async () => {
    const user = await users.createLocal({
      name: "Chain Racer",
      email: uniqueEmail("repo-session-chain-race"),
      passwordHash: "hashed:chain",
    });
    const now = new Date();
    const predecessor = await sessions.create({
      userId: user.id,
      tokenHash: `hash-${randomUUID()}`,
      expiresAt: new Date(now.getTime() + 60_000),
      deviceInfo: null,
      ipAddress: null,
    });
    const successor = await sessions.create({
      userId: user.id,
      tokenHash: `hash-${randomUUID()}`,
      expiresAt: new Date(now.getTime() + 60_000),
      deviceInfo: null,
      ipAddress: null,
    });

    // Hold a transaction that claims the predecessor and links the successor
    // but keeps the row locked. The sign out below reads the old link (null)
    // and only learns of the successor when its guarded write is refused.
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let claimed: () => void = () => {};
    const claimDone = new Promise<void>((resolve) => {
      claimed = resolve;
    });

    const rotate = database.client.$transaction(async (transaction) => {
      await transaction.refreshToken.update({
        where: { id: predecessor.id },
        data: { revokedAt: now, replacedByTokenId: successor.id },
      });
      claimed();
      await gate;
    });

    // The transaction now holds the row lock, so the walk reads the stale
    // link and blocks on its guarded write.
    await claimDone;
    const revoke = sessions.revokeChain(predecessor.id, now);
    await new Promise((resolve) => setTimeout(resolve, 50));
    release();
    await Promise.all([rotate, revoke]);

    const rows = await database.client.refreshToken.findMany({
      where: { userId: user.id },
    });
    expect(rows.filter((row) => row.revokedAt === null)).toHaveLength(0);
  });
});
