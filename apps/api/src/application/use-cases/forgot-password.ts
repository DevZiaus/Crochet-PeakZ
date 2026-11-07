import { PASSWORD_RESET_TTL_MS } from "../../domain/auth-constants.js";
import type { AuthDependencies } from "../dependencies.js";
import { passwordResetUrl } from "../dependencies.js";

/**
 * Issues a password reset link when the account has a stored password.
 *
 * The response is deliberately identical for unknown accounts and OAuth only
 * accounts; only an account with a password receives mail. The replacement
 * email is sent before the stored hash is overwritten, so a transport failure
 * leaves the previous link valid.
 *
 * @param deps Injected auth dependencies.
 * @param email Normalized email address.
 * @returns Nothing. The controller always answers 202.
 */
export async function forgotPassword(
  deps: AuthDependencies,
  email: string,
): Promise<void> {
  const user = await deps.users.findByEmail(email);

  if (!user || user.passwordHash === null) {
    return;
  }

  const now = deps.clock.now();
  const rawToken = deps.tokens.generateOpaqueToken();

  try {
    await deps.emails.sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      url: passwordResetUrl(deps.webAppUrl, rawToken),
    });
  } catch (error) {
    // The email is sent before the stored hash is replaced, so a delivery
    // failure leaves the customer's previous reset link working. The
    // controller still answers 202 so the endpoint never reveals the failure.
    console.error("[auth] password reset email failed", error);
    return;
  }

  await deps.users.savePasswordResetIssue(user.id, {
    tokenHash: deps.tokens.hashOpaqueToken(rawToken),
    expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS),
  });
}
