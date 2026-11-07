import { DUMMY_PASSWORD_HASH } from "../../domain/auth-constants.js";
import type { AuthDependencies, AuthResult } from "../dependencies.js";
import { AuthError, type SessionContext } from "../errors.js";
import { issueSession } from "./issue-session.js";

/** Sign in input, already validated at the boundary. */
export interface LoginInput {
  email: string;
  password: string;
}

/**
 * How many times a failed sign in write is retried after losing a race.
 *
 * Sign in is throttled at the edge, so a burst has few writers at once. If
 * every round still loses to a parallel attempt, one unconditional atomic
 * write records the failure, so the count can never be dropped.
 */
const FAILED_LOGIN_WRITE_ATTEMPTS = 5;

/**
 * Records a failed sign in without losing an increment to a parallel attempt.
 *
 * Reads the account, applies the domain lock rule, then writes with a compare
 * and swap on the failure counter. When another attempt moved the counter
 * first, the write is refused and the account is re-read, so a burst of
 * attempts still reaches the lock threshold on time. A burst that keeps
 * winning the guard falls back to one atomic write.
 *
 * @param deps Injected auth dependencies.
 * @param userId Account that failed to sign in.
 * @param now Current time.
 */
async function recordFailedLogin(
  deps: AuthDependencies,
  userId: string,
  now: Date,
): Promise<void> {
  for (let attempt = 0; attempt < FAILED_LOGIN_WRITE_ATTEMPTS; attempt += 1) {
    const user = await deps.users.findById(userId);

    // Another attempt may have locked the account while this one ran.
    if (!user || user.isLocked(now)) {
      return;
    }

    const expected = user.failedLoginAttempts;
    user.recordFailedLogin(now);

    const saved = await deps.users.saveFailedLogin(
      userId,
      {
        failedLoginAttempts: user.failedLoginAttempts,
        lockedUntil: user.lockedUntil,
      },
      expected,
    );

    if (saved) {
      return;
    }
  }

  // The guard never landed. Apply the rule again inside one atomic repository
  // write, so a burst of failures cannot silently lose this attempt.
  await deps.users.incrementFailedLogin(userId, now);
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
    // Spend the same bcrypt work as a known account so response time does not
    // reveal whether the address exists.
    await deps.passwords.verify(input.password, DUMMY_PASSWORD_HASH);
    throw new AuthError("INVALID_CREDENTIALS", "Invalid email or password.");
  }

  const now = deps.clock.now();

  // While locked, every attempt gets the same generic failure and the same
  // bcrypt cost. The lock is fixed, so a locked attempt never extends it.
  if (user.isLocked(now)) {
    await deps.passwords.verify(
      input.password,
      user.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    throw new AuthError("INVALID_CREDENTIALS", "Invalid email or password.");
  }

  // Run bcrypt even for an OAuth only account, then refuse it explicitly. The
  // dummy hash makes the work comparable without ever matching a real login.
  const passwordMatches = await deps.passwords.verify(
    input.password,
    user.passwordHash ?? DUMMY_PASSWORD_HASH,
  );

  if (user.passwordHash === null || !passwordMatches) {
    await recordFailedLogin(deps, user.id, now);
    throw new AuthError("INVALID_CREDENTIALS", "Invalid email or password.");
  }

  if (!user.emailVerified) {
    throw new AuthError(
      "EMAIL_UNVERIFIED",
      "Verify your email address before signing in. We can send you a new link.",
      { email: user.email },
    );
  }

  const previousFailedAttempts = user.failedLoginAttempts;
  user.clearFailedLogins();
  await deps.users.saveSuccessfulLogin(
    user.id,
    {
      failedLoginAttempts: user.failedLoginAttempts,
      lockedUntil: user.lockedUntil,
      lastLoginAt: now,
    },
    previousFailedAttempts,
  );

  return issueSession(deps, user, context);
}
