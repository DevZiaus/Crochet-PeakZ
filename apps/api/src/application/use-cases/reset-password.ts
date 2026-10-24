import type { AuthDependencies } from "../dependencies.js";
import { AuthError } from "../errors.js";

/**
 * Completes a password reset.
 *
 * A token works once and for one hour. The completed reset revokes every
 * session for the account and clears the lock and failure counter.
 *
 * @param deps Injected auth dependencies.
 * @param rawToken Raw token from the reset link.
 * @param password New password, already validated at the boundary.
 */
export async function resetPassword(
  deps: AuthDependencies,
  rawToken: string,
  password: string,
): Promise<void> {
  const user = await deps.users.findByPasswordResetTokenHash(
    deps.tokens.hashOpaqueToken(rawToken),
  );

  if (!user) {
    throw new AuthError(
      "INVALID_LINK",
      "This reset link is invalid or has already been used.",
    );
  }

  const now = deps.clock.now();

  if (user.isPasswordResetExpired(now)) {
    throw new AuthError(
      "EXPIRED_TOKEN",
      "This reset link has expired. Request a new one.",
    );
  }

  const passwordHash = await deps.passwords.hash(password);

  await deps.users.savePasswordReset(user.id, passwordHash);
  await deps.sessions.revokeAllForUser(user.id, now);
}
