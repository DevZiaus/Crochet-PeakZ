import type { Session } from "../entities/session.js";

/** Fields needed to open a new session row. */
export interface CreateSessionInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  deviceInfo: string | null;
  ipAddress: string | null;
}

/**
 * Persistence port for refresh token rows.
 *
 * Only the SHA 256 hash of the opaque token is stored, never the raw value.
 */
export interface SessionRepository {
  /** Inserts a session row. */
  create(input: CreateSessionInput): Promise<Session>;
  /** Finds a session by the hash of the presented raw token. */
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  /** Marks a rotated token revoked and links its successor. */
  markRotated(
    id: string,
    state: { revokedAt: Date; replacedByTokenId: string },
  ): Promise<void>;
  /** Revokes one session (sign out). */
  revoke(id: string, now: Date): Promise<void>;
  /** Revokes every active session for an account. */
  revokeAllForUser(userId: string, now: Date): Promise<void>;
}
