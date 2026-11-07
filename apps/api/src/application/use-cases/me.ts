import type { AuthUserDto } from "../../domain/types.js";
import type { AuthDependencies } from "../dependencies.js";
import { AuthError } from "../errors.js";

/**
 * Reads the signed in account fresh from the database.
 *
 * Everything the browser knows about the session comes from here, never from a
 * decoded token. Admin endpoints call the repository again so a role removed in
 * the database takes effect on the next request.
 *
 * @param deps Injected auth dependencies.
 * @param userId Account id from the verified access token.
 * @returns The current public user.
 */
export async function getCurrentUser(
  deps: AuthDependencies,
  userId: string,
): Promise<AuthUserDto> {
  const user = await deps.users.findById(userId);

  if (!user) {
    throw new AuthError("INVALID_SESSION", "Your session is no longer valid.");
  }

  return user.toAuthUser();
}
