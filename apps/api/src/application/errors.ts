/**
 * Application errors for the auth feature.
 *
 * The presentation layer maps each code to an HTTP status. Keeping HTTP out of
 * this layer preserves the Clean Architecture dependency rule.
 */

/** Stable codes the auth controller understands. */
export type AuthErrorCode =
  | "EMAIL_TAKEN"
  | "INVALID_CREDENTIALS"
  | "EMAIL_UNVERIFIED"
  | "INVALID_LINK"
  | "INVALID_SESSION"
  | "EXPIRED_TOKEN"
  | "RESEND_TOO_SOON";

/** An expected auth failure. */
export class AuthError extends Error {
  /**
   * @param code Stable machine readable code.
   * @param message Human readable message safe to return.
   * @param details Extra response fields, such as the account email.
   */
  constructor(
    readonly code: AuthErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/** Device details captured at sign in and copied forward on rotation. */
export interface SessionContext {
  /** User agent string, truncated to 255 characters. */
  deviceInfo: string | null;
  /** Client IP forwarded by the web proxy. */
  ipAddress: string | null;
}
