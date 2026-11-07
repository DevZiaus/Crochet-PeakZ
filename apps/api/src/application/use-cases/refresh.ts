import { REFRESH_TOKEN_TTL_MS } from "../../domain/auth-constants.js";
import type { Session } from "../../domain/entities/session.js";
import type { AuthDependencies, AuthResult } from "../dependencies.js";
import { AuthError } from "../errors.js";

/**
 * Rotates a refresh token and issues a new token pair.
 *
 * A token is single use. Presenting a rotated token again inside the 10 second
 * grace window is treated as a concurrent refresh from a second tab and gets a
 * fresh pair from the same chain, but only while its successor is still active.
 * Once sign out or a password reset revokes the chain, the grace window cannot
 * bring it back. A rotated token replayed outside that window is reuse: every
 * session for the account is revoked and the call fails with 401. A revoked
 * token with no successor (a signed out or reset row) is a plain invalid session
 * and never revokes the account's other sessions.
 *
 * @param deps Injected auth dependencies.
 * @param rawToken Raw refresh token from the cookie.
 * @returns The public user plus a rotated token pair.
 */
export async function refreshSession(
  deps: AuthDependencies,
  rawToken: string,
): Promise<AuthResult> {
  const tokenHash = deps.tokens.hashOpaqueToken(rawToken);
  const session = await deps.sessions.findByTokenHash(tokenHash);

  if (!session) {
    throw invalidSession();
  }

  const now = deps.clock.now();

  if (session.isExpired(now)) {
    throw invalidSession();
  }

  const user = await deps.users.findById(session.userId);

  if (!user) {
    throw invalidSession();
  }

  if (session.isRevoked()) {
    const fromGrace = await issueFromGrace(deps, session, now);
    if (fromGrace) {
      return fromGrace;
    }

    if (session.isReuse(now)) {
      await deps.sessions.revokeAllForUser(session.userId, now);
      throw reuseDetected();
    }

    throw invalidSession();
  }

  const refreshToken = deps.tokens.generateOpaqueToken();
  const successor = await deps.sessions.rotate(session.id, {
    userId: session.userId,
    tokenHash: deps.tokens.hashOpaqueToken(refreshToken),
    expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
    deviceInfo: session.deviceInfo,
    ipAddress: session.ipAddress,
    revokedAt: now,
  });

  if (!successor) {
    // A concurrent request rotated the row first. The re-read decides whether
    // this is still the grace window with a live successor, or reuse.
    const current = await deps.sessions.findByTokenHash(tokenHash);

    if (current) {
      const fromGrace = await issueFromGrace(deps, current, now);
      if (fromGrace) {
        return fromGrace;
      }

      if (current.isReuse(now)) {
        await deps.sessions.revokeAllForUser(current.userId, now);
        throw reuseDetected();
      }
    }

    throw invalidSession();
  }

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
 * Issues a fresh pair for a concurrent refresh inside the grace window, but
 * only while the successor created by the rotation is still active.
 *
 * A sign out or password reset revokes every row in the chain, so replaying a
 * predecessor inside the window cannot mint a session after either event.
 *
 * @param deps Injected auth dependencies.
 * @param session The revoked predecessor row.
 * @param now Current time.
 * @returns A fresh pair, or null when the grace window no longer applies.
 */
async function issueFromGrace(
  deps: AuthDependencies,
  session: Session,
  now: Date,
): Promise<AuthResult | null> {
  if (
    !session.isRevoked() ||
    session.isReuse(now) ||
    session.replacedByTokenId === null
  ) {
    return null;
  }

  const successor = await deps.sessions.findById(session.replacedByTokenId);

  if (!successor?.isActive(now)) {
    return null;
  }

  return issueFromChain(
    deps,
    session.userId,
    session.deviceInfo,
    session.ipAddress,
  );
}

/**
 * Issues a fresh pair for a concurrent refresh inside the grace window,
 * copying the device trail from the rotated row.
 *
 * The new row is a second live successor of the rotation. Signing out from the
 * predecessor only follows `replacedByTokenId`, so it cannot reach this branch.
 * That is an accepted tradeoff documented on `SessionRepository.revokeChain`.
 * A password reset or reuse detection still revokes every session for the
 * account, and signing out with this row's own token revokes it.
 */
async function issueFromChain(
  deps: AuthDependencies,
  userId: string,
  deviceInfo: string | null,
  ipAddress: string | null,
): Promise<AuthResult> {
  const now = deps.clock.now();
  const user = await deps.users.findById(userId);

  if (!user) {
    throw invalidSession();
  }

  const accessToken = await deps.tokens.signAccessToken({
    sub: userId,
    role: user.role,
  });
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

/** The generic 401 for an unknown, expired, or missing session. */
function invalidSession(): AuthError {
  return new AuthError(
    "INVALID_SESSION",
    "Your session has expired. Sign in again.",
  );
}

/** The 401 for a token that was replayed outside the rotation grace. */
function reuseDetected(): AuthError {
  return new AuthError(
    "INVALID_SESSION",
    "Your session was revoked for security. Sign in again on this device.",
  );
}
