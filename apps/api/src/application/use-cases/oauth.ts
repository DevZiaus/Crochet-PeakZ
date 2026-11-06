import type { AuthDependencies, AuthResult } from "../dependencies.js";
import type { SessionContext } from "../errors.js";
import type { OAuthProfile } from "../../domain/types.js";
import { issueSession } from "./issue-session.js";

/**
 * Resolves an account from a provider profile and opens a session.
 *
 * Email is the identity key. A first sign in creates the account with the
 * provider, provider id, and avatar. An existing verified account is simply
 * signed in. Linking to an existing unverified local account verifies it and
 * clears its stored password. The account keeps the provider it was created
 * with.
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
  const existing = await deps.users.findByEmail(email);

  if (!existing) {
    const user = await deps.users.createOAuth({
      name: profile.name,
      email,
      provider: profile.provider,
      providerId: profile.providerId,
      avatarUrl: profile.avatarUrl,
      lastLoginAt: now,
    });

    return issueSession(deps, user, context);
  }

  // Keep the stored provider pair whenever the signing in provider differs,
  // even when the stored id is null, so the record never mixes one provider's
  // name with another's id. A same provider sign in refreshes the stored id.
  const sameProvider = existing.authProvider === profile.provider;
  const keepProvider = !sameProvider;

  await deps.users.saveOAuthLogin(existing.id, {
    providerId: keepProvider ? existing.providerId : profile.providerId,
    avatarUrl: existing.avatarUrl ?? profile.avatarUrl,
    emailVerified: true,
    clearPassword: existing.shouldClearPasswordOnLink(),
    lastLoginAt: now,
  });

  existing.applyProviderLogin(profile.avatarUrl);

  return issueSession(deps, existing, context);
}
