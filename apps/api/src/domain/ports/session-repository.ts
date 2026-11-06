import type { Session } from "../entities/session.js";

/** Fields needed to open a new session row. */
export interface CreateSessionInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  deviceInfo: string | null;
  ipAddress: string | null;
}

/** Fields needed to rotate one session into its successor. */
export interface RotateSessionInput extends CreateSessionInput {
  /** When the predecessor is revoked. */
  revokedAt: Date;
}

/**
 * Persistence port for refresh token rows.
 *
 * Only the HMAC-SHA256 digest of the opaque token is stored, never the raw value.
 */
export interface SessionRepository {
  /** Inserts a session row. */
  create(input: CreateSessionInput): Promise<Session>;
  /** Finds a session by its row id. */
  findById(id: string): Promise<Session | null>;
  /** Finds a session by the hash of the presented raw token. */
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  /**
   * Atomically revokes an active session and creates its successor.
   *
   * Returns null when another request already rotated or revoked the row, so
   * two concurrent refreshes can never open two live token chains.
   */
  rotate(id: string, input: RotateSessionInput): Promise<Session | null>;
  /**
   * Revokes a session and every successor it rotated into (sign out).
   *
   * Signing out with an already rotated token must kill the whole chain, not
   * only the presented row, otherwise the live successor stays usable. The
   * write never rewrites a revoke timestamp that is already set, so it cannot
   * extend a rotation's replay grace window.
   */
  revokeChain(id: string, now: Date): Promise<void>;
  /** Revokes every active session for an account. */
  revokeAllForUser(userId: string, now: Date): Promise<void>;
}
