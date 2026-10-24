import type { AuthDependencies, AuthResult } from "../dependencies.js";
import { AuthError, type SessionContext } from "../errors.js";
import { issueSession } from "./issue-session.js";

/** Sign in input, already validated at the boundary. */
export interface LoginInput {
  email: string;
  password: string;
}

/**
 * Signs in with email and password.
 *
 * A wrong password and an unknown email return the same 401 message. Five
 * consecutive failures lock the account for 15 minutes. A correct password on
 * an unverified account returns 403 `EMAIL_UNVERIFIED`, issues no cookie, and
 * does not touch the failure counter.
 *
 * @param deps Injected auth dependencies.
 * @param input Validated credentials.
 * @param context Device details captured from the request.
 * @returns The public user plus a fresh token pair.
 */
export async function loginUser(
  deps: AuthDependencies,
  input: LoginInput,
  context: SessionContext,
): Promise<AuthResult> {
  const user = await deps.users.findByEmail(input.email);

  if (!user) {
    throw new AuthError("INVALID_CREDENTIALS", "Invalid email or password.");
  }

  const now = deps.clock.now();

  // While locked, every attempt gets the same generic failure. The lock is
  // fixed, so a locked attempt never extends it.
  if (user.isLocked(now)) {
    throw new AuthError("INVALID_CREDENTIALS", "Invalid email or password.");
  }

  const passwordMatches =
    user.passwordHash !== null &&
    (await deps.passwords.verify(input.password, user.passwordHash));

  if (!passwordMatches) {
    user.recordFailedLogin(now);
    await deps.users.saveLoginState(user.id, {
      failedLoginAttempts: user.failedLoginAttempts,
      lockedUntil: user.lockedUntil,
    });
    throw new AuthError("INVALID_CREDENTIALS", "Invalid email or password.");
  }

  if (!user.emailVerified) {
    throw new AuthError(
      "EMAIL_UNVERIFIED",
      "Verify your email address before signing in. We can send you a new link.",
      { email: user.email },
    );
  }

  user.clearFailedLogins();
  await deps.users.saveLoginState(user.id, {
    failedLoginAttempts: user.failedLoginAttempts,
    lockedUntil: user.lockedUntil,
    lastLoginAt: now,
  });

  return issueSession(deps, user, context);
}
