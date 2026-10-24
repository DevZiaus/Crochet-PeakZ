import { REFRESH_TOKEN_TTL_MS } from "../../domain/auth-constants.js";
import type { AuthDependencies, AuthResult } from "../dependencies.js";
import { AuthError } from "../errors.js";

/**
 * Rotates a refresh token and issues a new token pair.
 *
 * A token is single use. Presenting a rotated token again inside the 10 second
 * grace window is treated as a concurrent refresh from a second tab and gets a
 * fresh pair from the same chain. Outside that window it is reuse: every
 * session for the account is revoked and the call fails with 401.
 *
 * @param deps Injected auth dependencies.
 * @param rawToken Raw refresh token from the cookie.
 * @returns The public user plus a rotated token pair.
 */
export async function refreshSession(
  deps: AuthDependencies,
  rawToken: string,
): Promise<AuthResult> {
  const session = await deps.sessions.findByTokenHash(
    deps.tokens.hashOpaqueToken(rawToken),
  );

  if (!session) {
    throw new AuthError(
      "INVALID_SESSION",
      "Your session has expired. Sign in again.",
    );
  }

  const now = deps.clock.now();

  if (session.isExpired(now)) {
    throw new AuthError(
      "INVALID_SESSION",
      "Your session has expired. Sign in again.",
    );
  }

  const user = await deps.users.findById(session.userId);

  if (!user) {
    throw new AuthError(
      "INVALID_SESSION",
      "Your session has expired. Sign in again.",
    );
  }

  if (session.isRevoked()) {
    if (session.isWithinRotationGrace(now)) {
      return issueFromChain(
        deps,
        user.id,
        user.role,
        session.deviceInfo,
        session.ipAddress,
      );
    }

    await deps.sessions.revokeAllForUser(session.userId, now);
    throw new AuthError(
      "INVALID_SESSION",
      "Your session was revoked for security. Sign in again on this device.",
    );
  }

  const refreshToken = deps.tokens.generateOpaqueToken();
  const successor = await deps.sessions.create({
    userId: session.userId,
    tokenHash: deps.tokens.hashOpaqueToken(refreshToken),
    expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
    deviceInfo: session.deviceInfo,
    ipAddress: session.ipAddress,
  });

  await deps.sessions.markRotated(session.id, {
    revokedAt: now,
    replacedByTokenId: successor.id,
  });

  const accessToken = await deps.tokens.signAccessToken({
    sub: user.id,
    role: user.role,
  });

  return {
    user: user.toAuthUser(),
    accessToken,
    refreshToken,
    refreshTtlMs: REFRESH_TOKEN_TTL_MS,
  };
}

/**
 * Issues a fresh pair for a concurrent refresh inside the grace window,
 * copying the device trail from the rotated row.
 */
async function issueFromChain(
  deps: AuthDependencies,
  userId: string,
  role: "CUSTOMER" | "ADMIN",
  deviceInfo: string | null,
  ipAddress: string | null,
): Promise<AuthResult> {
  const now = deps.clock.now();
  const user = await deps.users.findById(userId);

  if (!user) {
    throw new AuthError(
      "INVALID_SESSION",
      "Your session has expired. Sign in again.",
    );
  }

  const accessToken = await deps.tokens.signAccessToken({ sub: userId, role });
  const refreshToken = deps.tokens.generateOpaqueToken();

  await deps.sessions.create({
    userId,
    tokenHash: deps.tokens.hashOpaqueToken(refreshToken),
    expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
    deviceInfo,
    ipAddress,
  });

  return {
    user: user.toAuthUser(),
    accessToken,
    refreshToken,
    refreshTtlMs: REFRESH_TOKEN_TTL_MS,
  };
}
