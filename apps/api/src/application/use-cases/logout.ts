import type { AuthDependencies } from "../dependencies.js";

/**
 * Revokes the session behind a refresh token.
 *
 * Sign out is idempotent: a missing or unknown token is not an error.
 *
 * @param deps Injected auth dependencies.
 * @param rawToken Raw refresh token from the cookie, when present.
 */
export async function logoutSession(
  deps: AuthDependencies,
  rawToken: string | null | undefined,
): Promise<void> {
  if (!rawToken) {
    return;
  }

  const session = await deps.sessions.findByTokenHash(
    deps.tokens.hashOpaqueToken(rawToken),
  );

  if (!session) {
    return;
  }

  await deps.sessions.revoke(session.id, deps.clock.now());
}
