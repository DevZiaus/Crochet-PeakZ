import type { UserRole } from "../types.js";

/** Claims carried by a signed access token. */
export interface AccessTokenClaims {
  /** Account id. */
  sub: string;
  /** Role at signing time. Admin endpoints recheck the database. */
  role: UserRole;
}

/** State carried by a signed OAuth state value. */
export interface OAuthStateClaims {
  /** Random nonce mirrored in the state cookie. */
  nonce: string;
  /** Relative post sign in path. */
  next: string;
}

/**
 * Token creation and verification port.
 *
 * Implemented with `jose` for access tokens and OAuth state, and Node's
 * `crypto` for opaque refresh tokens.
 */
export interface TokenService {
  /** Signs a 15 minute access token. */
  signAccessToken(claims: AccessTokenClaims): Promise<string>;
  /** Verifies an access token, throwing when invalid or expired. */
  verifyAccessToken(token: string): Promise<AccessTokenClaims>;
  /** Generates a fresh opaque token (base64url, 32 random bytes). */
  generateOpaqueToken(): string;
  /** Returns the SHA 256 hex hash of an opaque token. */
  hashOpaqueToken(token: string): string;
  /** Signs a 10 minute OAuth state value. */
  signOAuthState(claims: OAuthStateClaims): Promise<string>;
  /** Verifies an OAuth state value, throwing when invalid or expired. */
  verifyOAuthState(token: string): Promise<OAuthStateClaims>;
}
