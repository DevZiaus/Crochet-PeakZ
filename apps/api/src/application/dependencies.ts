import type { Clock } from "../domain/ports/clock.js";
import type { EmailSender } from "../domain/ports/email-sender.js";
import type { PasswordHasher } from "../domain/ports/password-hasher.js";
import type { SessionRepository } from "../domain/ports/session-repository.js";
import type { TokenService } from "../domain/ports/token-service.js";
import type { UserRepository } from "../domain/ports/user-repository.js";
import type { AuthUserDto } from "../domain/types.js";

/**
 * Everything the auth use cases need, injected by the composition root.
 *
 * Tests replace each port with a fake; production wires Prisma, bcrypt, jose,
 * and Resend.
 */
export interface AuthDependencies {
  users: UserRepository;
  sessions: SessionRepository;
  passwords: PasswordHasher;
  tokens: TokenService;
  emails: EmailSender;
  clock: Clock;
  /** Public web origin used in links and redirects, without a trailing slash. */
  webAppUrl: string;
  /** Whether cookies should carry the Secure attribute. */
  isProduction: boolean;
}

/** The result of a successful sign in or refresh. */
export interface AuthResult {
  user: AuthUserDto;
  accessToken: string;
  refreshToken: string;
  refreshTtlMs: number;
}

/**
 * Truncates a user agent string to the session column width.
 *
 * @param userAgent Raw `User-Agent` header.
 * @returns A 255 character or shorter string, or null.
 */
export function normalizeDeviceInfo(
  userAgent: string | null | undefined,
): string | null {
  const value = userAgent?.trim();
  if (!value) {
    return null;
  }
  return value.slice(0, 255);
}

/**
 * Builds an absolute verification link on the web origin.
 *
 * @param webAppUrl Public web origin.
 * @param rawToken Raw (unhashed) link token.
 * @returns Absolute URL.
 */
export function verificationUrl(webAppUrl: string, rawToken: string): string {
  return `${webAppUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;
}

/**
 * Builds an absolute password reset link on the web origin.
 *
 * @param webAppUrl Public web origin.
 * @param rawToken Raw (unhashed) link token.
 * @returns Absolute URL.
 */
export function passwordResetUrl(webAppUrl: string, rawToken: string): string {
  return `${webAppUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
}
