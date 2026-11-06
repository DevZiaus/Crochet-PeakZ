/**
 * Domain level auth types.
 *
 * These mirror the persisted values without importing Prisma or the web
 * frameworks, so the domain layer keeps zero external dependencies.
 */

/** Account roles. Mirrors the Prisma `UserRole` enum. */
export const USER_ROLES = ["CUSTOMER", "ADMIN"] as const;

/** Account role union. */
export type UserRole = (typeof USER_ROLES)[number];

/** How an account was first created. Mirrors the Prisma `AuthProvider` enum. */
export const AUTH_PROVIDERS = ["LOCAL", "GOOGLE", "FACEBOOK"] as const;

/** Account creation method union. */
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

/** The two supported OAuth providers, keyed by path segment. */
export const OAUTH_PROVIDERS = ["google", "facebook"] as const;

/** OAuth provider name union. */
export type OAuthProviderName = (typeof OAUTH_PROVIDERS)[number];

/** The OAuth identity returned by a provider after a successful callback. */
export interface OAuthProfile {
  /** Provider that proved the identity. */
  provider: Exclude<AuthProvider, "LOCAL">;
  /** Provider's stable user id, or null when the provider sends none. */
  providerId: string | null;
  /** Verified email address. */
  email: string;
  /** Display name, or the email local part when the provider sends none. */
  name: string;
  /** Avatar URL when the provider sends one. */
  avatarUrl: string | null;
}

/** The public user shape every user bearing auth response returns. */
export interface AuthUserDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
  emailVerified: boolean;
}

/** A signed pair of tokens handed to the presentation layer. */
export interface IssuedTokens {
  /** Short lived signed access token. */
  accessToken: string;
  /** Raw opaque refresh token (only its hash is stored). */
  refreshToken: string;
  /** Raw refresh token lifetime in milliseconds. */
  refreshTtlMs: number;
}
