import type { AuthUserDto } from "../../domain/types.js";
import type { AuthDependencies } from "../dependencies.js";
import { AuthError } from "../errors.js";

/**
 * Consumes a verification link token and marks the account verified.
 *
 * A token works once: the stored hash is cleared on success, so a second
 * attempt gets 400. An expired link returns the account email so the web form
 * can prefill the resend field.
 *
 * @param deps Injected auth dependencies.
 * @param rawToken Raw token from the verification link.
 * @returns The verified account.
 */
export async function verifyEmail(
  deps: AuthDependencies,
  rawToken: string,
): Promise<AuthUserDto> {
  const user = await deps.users.findByVerificationTokenHash(
    deps.tokens.hashOpaqueToken(rawToken),
  );

  if (!user) {
    throw new AuthError(
      "INVALID_LINK",
      "This verification link is invalid or has already been used.",
    );
  }

  const now = deps.clock.now();
  if (user.isVerificationExpired(now)) {
    throw new AuthError(
      "EXPIRED_TOKEN",
      "This verification link has expired. Request a new one below.",
      { email: user.email },
    );
  }

  await deps.users.saveVerified(user.id);

  return { ...user.toAuthUser(), emailVerified: true };
}
