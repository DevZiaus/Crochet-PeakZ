import type { User } from "../../domain/entities/user.js";
import { REFRESH_TOKEN_TTL_MS } from "../../domain/auth-constants.js";
import type { AuthDependencies, AuthResult } from "../dependencies.js";
import type { SessionContext } from "../errors.js";

/**
 * Opens a new session row and signs an access token for the account.
 *
 * The raw refresh token is returned to the caller and only its SHA 256 hash is
 * persisted.
 *
 * @param deps Injected auth dependencies.
 * @param user The account signing in.
 * @param context Device details captured from the request.
 * @returns The public user plus a fresh token pair.
 */
export async function issueSession(
  deps: AuthDependencies,
  user: User,
  context: SessionContext,
): Promise<AuthResult> {
  const now = deps.clock.now();
  const accessToken = await deps.tokens.signAccessToken({
    sub: user.id,
    role: user.role,
  });
  const refreshToken = deps.tokens.generateOpaqueToken();

  await deps.sessions.create({
    userId: user.id,
    tokenHash: deps.tokens.hashOpaqueToken(refreshToken),
    expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
    deviceInfo: context.deviceInfo,
    ipAddress: context.ipAddress,
  });

  return {
    user: user.toAuthUser(),
    accessToken,
    refreshToken,
    refreshTtlMs: REFRESH_TOKEN_TTL_MS,
  };
}
