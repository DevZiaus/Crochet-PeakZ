import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { config as loadDotEnv } from "dotenv";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  LOCK_DURATION_MS,
  REFRESH_TOKEN_TTL_MS,
} from "../../domain/auth-constants.js";
import type { AuthDependencies } from "../../application/dependencies.js";
import { loginUser } from "../../application/use-cases/login.js";
import { refreshSession } from "../../application/use-cases/refresh.js";
import { verifyEmail } from "../../application/use-cases/verify-email.js";
import { BcryptPasswordHasher } from "../../infrastructure/auth/bcrypt-password-hasher.js";
import { JwtTokenService } from "../../infrastructure/auth/jwt-token-service.js";
import { PrismaSessionRepository } from "../../infrastructure/database/session.repository.js";
import { PrismaUserRepository } from "../../infrastructure/database/user.repository.js";
import {
  createDatabase,
  type Database,
} from "../../infrastructure/database/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { createRequireAdmin, createRequireAuth } from "./auth-middleware.js";
import {
  createTestClock,
  RecordingEmailSender,
  type TestClock,
} from "../../test-support/auth-fakes.js";

loadDotEnv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});

const databaseUrl = process.env["DATABASE_URL"];
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase("auth against PostgreSQL", () => {
  let database: Database;
  let deps: AuthDependencies;
  let clock: TestClock;
  let userRepository: PrismaUserRepository;
  let userId = "";
  const email = `integration-${randomUUID()}@example.com`;

  beforeAll(() => {
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required.");
    }

    database = createDatabase(databaseUrl);
    userRepository = new PrismaUserRepository(database.client);
    const tokens = new JwtTokenService({
      jwtSecret: "integration-access-secret-0123456789abcdef",
      refreshSecret: "integration-refresh-secret-0123456789abcdef",
    });
    clock = createTestClock(new Date("2026-01-01T00:00:00Z"));

    deps = {
      users: userRepository,
      sessions: new PrismaSessionRepository(database.client),
      passwords: new BcryptPasswordHasher(),
      tokens,
      emails: new RecordingEmailSender(),
      clock,
      webAppUrl: "https://shop.example.com",
    };
  });

  afterAll(async () => {
    if (userId) {
      await database.client.user.delete({ where: { id: userId } }).catch(() => {
        /* The test may have failed before the account was created. */
      });
    }
    await database.disconnect();
  });

  it("persists a verified account and locks it after five failures", async () => {
    const passwordHash = await deps.passwords.hash("correct horse battery");
    const user = await deps.users.createLocal({
      name: "Integration Customer",
      email,
      passwordHash,
    });
    userId = user.id;

    const rawVerification = deps.tokens.generateOpaqueToken();
    await deps.users.saveVerificationIssue(user.id, {
      tokenHash: deps.tokens.hashOpaqueToken(rawVerification),
      expiresAt: new Date(clock.now().getTime() + 24 * 60 * 60 * 1000),
      sentAt: clock.now(),
    });
    const verified = await verifyEmail(deps, rawVerification);
    expect(verified.emailVerified).toBe(true);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        loginUser(
          deps,
          { email, password: "wrong password" },
          { deviceInfo: null, ipAddress: null },
        ),
      ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    }

    const locked = await database.client.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(locked.failedLoginAttempts).toBe(5);
    expect(locked.lockedUntil?.getTime()).toBe(
      clock.now().getTime() + LOCK_DURATION_MS,
    );

    clock.advance(60_000);
    await expect(
      loginUser(
        deps,
        { email, password: "correct horse battery" },
        { deviceInfo: null, ipAddress: null },
      ),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });

    const stillLocked = await database.client.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stillLocked.failedLoginAttempts).toBe(5);
    expect(stillLocked.lockedUntil?.getTime()).toBe(
      locked.lockedUntil?.getTime(),
    );

    clock.advance(LOCK_DURATION_MS);
    const session = await loginUser(
      deps,
      { email, password: "correct horse battery" },
      { deviceInfo: "Integration Agent", ipAddress: "203.0.113.20" },
    );
    expect(session.user.emailVerified).toBe(true);

    const unlocked = await database.client.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(unlocked.failedLoginAttempts).toBe(0);
    expect(unlocked.lockedUntil).toBeNull();
    expect(unlocked.lastLoginAt).not.toBeNull();
  });

  it("rotates a refresh token, serves a grace replay, then revokes on reuse", async () => {
    const first = await loginUser(
      deps,
      { email, password: "correct horse battery" },
      { deviceInfo: "Integration Agent", ipAddress: "203.0.113.20" },
    );

    clock.advance(1_000);
    const rotated = await refreshSession(deps, first.refreshToken);

    const oldRow = await database.client.refreshToken.findUniqueOrThrow({
      where: { tokenHash: deps.tokens.hashOpaqueToken(first.refreshToken) },
    });
    const successor = await database.client.refreshToken.findUniqueOrThrow({
      where: { tokenHash: deps.tokens.hashOpaqueToken(rotated.refreshToken) },
    });

    expect(oldRow.revokedAt).not.toBeNull();
    expect(oldRow.replacedByTokenId).toBe(successor.id);
    expect(successor.deviceInfo).toBe("Integration Agent");
    expect(successor.expiresAt.getTime()).toBe(
      clock.now().getTime() + REFRESH_TOKEN_TTL_MS,
    );

    clock.advance(5_000);
    const concurrent = await refreshSession(deps, first.refreshToken);
    expect(concurrent.refreshToken).not.toBe(rotated.refreshToken);

    clock.advance(6_000);
    await expect(
      refreshSession(deps, first.refreshToken),
    ).rejects.toMatchObject({ code: "INVALID_SESSION" });

    const active = await database.client.refreshToken.count({
      where: { userId, revokedAt: null },
    });
    expect(active).toBe(0);
  });

  it("rechecks the admin role in the database on every request", async () => {
    const tokens = deps.tokens;
    const accessToken = await tokens.signAccessToken({
      sub: userId,
      role: "ADMIN",
    });

    const anonymous = createRequireAuth(tokens);
    const anonymousError = await invoke(anonymous, {
      headers: {},
    });
    expect(anonymousError).toBeInstanceOf(AppError);
    expect((anonymousError as AppError).statusCode).toBe(401);

    const authenticated = {
      headers: { cookie: `cp_access=${accessToken}` },
    } as unknown as Request;
    expect(await invoke(createRequireAuth(tokens), authenticated)).toBeNull();
    expect(authenticated.auth).toEqual({ userId, role: "ADMIN" });

    const adminOnly = createRequireAdmin(userRepository);
    const customerError = await invoke(adminOnly, authenticated);
    expect(customerError).toBeInstanceOf(AppError);
    expect((customerError as AppError).statusCode).toBe(403);

    await database.client.user.update({
      where: { id: userId },
      data: { role: "ADMIN" },
    });
    expect(await invoke(adminOnly, authenticated)).toBeNull();

    await database.client.user.update({
      where: { id: userId },
      data: { role: "CUSTOMER" },
    });
    const demotedError = await invoke(adminOnly, authenticated);
    expect(demotedError).toBeInstanceOf(AppError);
    expect((demotedError as AppError).statusCode).toBe(403);
  });
});

/**
 * Runs an Express middleware once and resolves with the error passed to `next`.
 *
 * @param handler Middleware under test.
 * @param request Minimal request stub.
 * @returns The error, or null when the middleware called `next()` cleanly.
 */
async function invoke(
  handler: RequestHandler,
  request: Partial<Request>,
): Promise<unknown> {
  try {
    await new Promise<void>((resolve, reject) => {
      const next = ((error?: unknown) => {
        if (error instanceof Error) {
          reject(error);
          return;
        }
        if (error) {
          reject(
            new Error(
              typeof error === "string"
                ? error
                : "Middleware failed with a non-Error value.",
            ),
          );
          return;
        }
        resolve();
      }) as NextFunction;

      handler(request as Request, {} as Response, next);
    });
    return null;
  } catch (error) {
    return error;
  }
}
