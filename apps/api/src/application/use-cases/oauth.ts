import type { AuthDependencies, AuthResult } from "../dependencies.js";
import { AuthError, type SessionContext } from "../errors.js";
import { EmailAlreadyExistsError } from "../../domain/errors.js";
import type { OAuthProfile } from "../../domain/types.js";
import { issueSession } from "./issue-session.js";

/**
 * Resolves an account from a provider profile and opens a session.
 *
 * Email is the identity key. A first sign in creates the account with the
 * provider, provider id, and avatar. Google explicitly attests
 * `email_verified: true`, so it can sign in to any existing account sharing the
 * same email (and linking to an existing unverified local account verifies it
 * and clears its stored password). Facebook provides no explicit
 * email-verification claim, so Facebook only creates new Facebook accounts or
 * signs in to existing Facebook accounts, never auto-linking across to `LOCAL`
 * or `GOOGLE` accounts. The account keeps the provider it was created with.
 *
 * When two first sign ins for the same new address race, the loser sees the
 * unique constraint, re-reads the winner, and continues as an existing account
 * instead of failing the callback (subject to the provider link policy).
 *
 * @param deps Injected auth dependencies.
 * @param profile Profile proved by the provider.
 * @param context Device details captured from the request.
 * @returns The public user plus a fresh token pair.
 */
export async function signInWithOAuth(
  deps: AuthDependencies,
  profile: OAuthProfile,
  context: SessionContext,
): Promise<AuthResult> {
  const email = profile.email.trim().toLowerCase();
  const now = deps.clock.now();
  let user = await deps.users.findByEmail(email);

  if (!user) {
    try {
      user = await deps.users.createOAuth({
        name: profile.name,
        email,
        provider: profile.provider,
        providerId: profile.providerId,
        avatarUrl: profile.avatarUrl,
        lastLoginAt: now,
      });

      return await issueSession(deps, user, context);
    } catch (error) {
      if (!(error instanceof EmailAlreadyExistsError)) {
        throw error;
      }

      // A parallel first sign in inserted the address between the read and the
      // create. Continue with the account that won so both callbacks succeed.
      user = await deps.users.findByEmail(email);
      if (!user) {
        throw error;
      }
    }
  }

  if (!user.canLinkOAuthProvider(profile.provider)) {
    throw new AuthError(
      "OAUTH_LINK_DISALLOWED",
      "This provider cannot automatically link to an existing account with this email.",
    );
  }

  // Keep the stored provider pair whenever the signing in provider differs,
  // even when the stored id is null, so the record never mixes one provider's
  // name with another's id. A same provider sign in refreshes the stored id.
  const sameProvider = user.authProvider === profile.provider;
  const keepProvider = !sameProvider;

  await deps.users.saveOAuthLogin(user.id, {
    providerId: keepProvider ? user.providerId : profile.providerId,
    avatarUrl: user.avatarUrl ?? profile.avatarUrl,
    emailVerified: true,
    clearPassword: user.shouldClearPasswordOnLink(),
    lastLoginAt: now,
  });

  user.applyProviderLogin(profile.avatarUrl);

  return issueSession(deps, user, context);
}
