import {
  RESEND_THROTTLE_MS,
  VERIFICATION_TTL_MS,
} from "../../domain/auth-constants.js";
import type { AuthDependencies } from "../dependencies.js";
import { verificationUrl } from "../dependencies.js";
import { AuthError } from "../errors.js";

/**
 * Issues a new verification link for an unverified account.
 *
 * Unknown and already verified addresses are treated the same, so the endpoint
 * never reveals whether an account exists. The previous link is invalidated by
 * overwriting the stored hash.
 *
 * @param deps Injected auth dependencies.
 * @param email Normalized email address.
 * @returns Nothing. The controller always answers 202.
 */
export async function resendVerification(
  deps: AuthDependencies,
  email: string,
): Promise<void> {
  const user = await deps.users.findByEmail(email);

  if (!user || user.emailVerified) {
    return;
  }

  const now = deps.clock.now();
  if (!user.canResendVerification(now)) {
    const elapsed =
      now.getTime() - (user.emailVerificationSentAt?.getTime() ?? 0);
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((RESEND_THROTTLE_MS - elapsed) / 1000),
    );
    throw new AuthError(
      "RESEND_TOO_SOON",
      "Please wait a minute before requesting another verification email.",
      { retryAfterSeconds },
    );
  }

  const rawToken = deps.tokens.generateOpaqueToken();

  await deps.users.saveVerificationIssue(user.id, {
    tokenHash: deps.tokens.hashOpaqueToken(rawToken),
    expiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS),
    sentAt: now,
  });

  try {
    await deps.emails.sendVerificationEmail({
      to: user.email,
      name: user.name,
      url: verificationUrl(deps.webAppUrl, rawToken),
    });
  } catch (error) {
    console.error("[auth] verification email failed", error);
  }
}
