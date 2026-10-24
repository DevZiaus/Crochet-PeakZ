import { createHash, createHmac, randomBytes } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import {
  ACCESS_TOKEN_AUDIENCE,
  ACCESS_TOKEN_ISSUER,
  ACCESS_TOKEN_TTL_SECONDS,
  OAUTH_STATE_TTL_SECONDS,
} from "../../domain/auth-constants.js";
import type {
  AccessTokenClaims,
  OAuthStateClaims,
  TokenService,
} from "../../domain/ports/token-service.js";
import { USER_ROLES, type UserRole } from "../../domain/types.js";

/**
 * jose backed token service.
 *
 * Access tokens and OAuth state values are HS256 JSON Web Tokens. Refresh,
 * verification, and reset tokens are opaque random values whose stored digest
 * is an HMAC-SHA256 keyed with `JWT_REFRESH_SECRET`, so a leaked database alone
 * cannot be brute forced against a token.
 */
export class JwtTokenService implements TokenService {
  private readonly jwtSecret: Uint8Array;
  private readonly refreshSecret: string;

  /**
   * @param secrets Signing secret for access tokens and the refresh hash key.
   */
  constructor(secrets: { jwtSecret: string; refreshSecret: string }) {
    this.jwtSecret = new TextEncoder().encode(secrets.jwtSecret);
    this.refreshSecret = secrets.refreshSecret;
  }

  /** @inheritdoc */
  async signAccessToken(claims: AccessTokenClaims): Promise<string> {
    return new SignJWT({ role: claims.role })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(claims.sub)
      .setIssuer(ACCESS_TOKEN_ISSUER)
      .setAudience(ACCESS_TOKEN_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(this.jwtSecret);
  }

  /** @inheritdoc */
  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    const { payload } = await jwtVerify(token, this.jwtSecret, {
      issuer: ACCESS_TOKEN_ISSUER,
      audience: ACCESS_TOKEN_AUDIENCE,
    });

    const sub = payload["sub"];
    const role = payload["role"];

    if (typeof sub !== "string" || !USER_ROLES.includes(role as UserRole)) {
      throw new Error("Access token is missing required claims.");
    }

    return { sub, role: role as UserRole };
  }

  /** @inheritdoc */
  generateOpaqueToken(): string {
    return randomBytes(32).toString("base64url");
  }

  /** @inheritdoc */
  hashOpaqueToken(token: string): string {
    return createHmac("sha256", this.refreshSecret).update(token).digest("hex");
  }

  /** @inheritdoc */
  async signOAuthState(claims: OAuthStateClaims): Promise<string> {
    return new SignJWT({ nonce: claims.nonce, next: claims.next })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${OAUTH_STATE_TTL_SECONDS}s`)
      .sign(this.jwtSecret);
  }

  /** @inheritdoc */
  async verifyOAuthState(token: string): Promise<OAuthStateClaims> {
    const { payload } = await jwtVerify(token, this.jwtSecret);
    const nonce = payload["nonce"];
    const next = payload["next"];

    if (typeof nonce !== "string" || typeof next !== "string") {
      throw new Error("OAuth state is missing required claims.");
    }

    return { nonce, next };
  }
}

/**
 * Returns the plain SHA 256 hex digest of a value.
 *
 * Exposed for repository level tooling and tests; auth tokens use the keyed
 * digest above.
 *
 * @param value Input string.
 * @returns Lowercase hex digest.
 */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
