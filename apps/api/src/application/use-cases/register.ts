import { VERIFICATION_TTL_MS } from "../../domain/auth-constants.js";
import { EmailAlreadyExistsError } from "../../domain/errors.js";
import type { AuthUserDto } from "../../domain/types.js";
import type { AuthDependencies } from "../dependencies.js";
import { verificationUrl } from "../dependencies.js";
import { AuthError } from "../errors.js";

/** Registration input, already validated at the boundary. */
export interface RegisterUserInput {
  name: string;
  email: string;
  password: string;
}

/**
 * Creates a CUSTOMER account and sends the verification email.
 *
 * The account is created before the email is sent, so a delivery failure does
 * not roll the account back. The customer can resend from the sign in screen.
 *
 * @param deps Injected auth dependencies.
 * @param input Validated name, email, and password.
 * @returns The public user, without tokens.
 */
export async function registerUser(
  deps: AuthDependencies,
  input: RegisterUserInput,
): Promise<AuthUserDto> {
  const passwordHash = await deps.passwords.hash(input.password);

  let user;
  try {
    user = await deps.users.createLocal({
      name: input.name,
      email: input.email,
      passwordHash,
    });
  } catch (error) {
    if (error instanceof EmailAlreadyExistsError) {
      throw new AuthError(
        "EMAIL_TAKEN",
        "An account with this email already exists.",
      );
    }
    throw error;
  }

  const now = deps.clock.now();
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

  return user.toAuthUser();
}
