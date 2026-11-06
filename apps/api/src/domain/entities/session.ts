import { ROTATION_GRACE_MS } from "../auth-constants.js";

/**
 * A plain snapshot of a persisted refresh token row.
 *
 * Only the hash of the opaque token is ever stored.
 */
export interface SessionSnapshot {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  deviceInfo: string | null;
  ipAddress: string | null;
  revokedAt: Date | null;
  replacedByTokenId: string | null;
  createdAt: Date;
}

/**
 * One signed in device session.
 *
 * Owns the single use and rotation grace rules so a refresh cannot be replayed
 * without detection.
 */
export class Session {
  private constructor(private readonly state: SessionSnapshot) {}

  /**
   * Rebuilds a session entity from a repository row.
   *
   * @param snapshot Persisted refresh token fields.
   * @returns A `Session` entity.
   */
  static reconstitute(snapshot: SessionSnapshot): Session {
    return new Session({ ...snapshot });
  }

  /** Session row id. */
  get id(): string {
    return this.state.id;
  }

  /** Owner account id. */
  get userId(): string {
    return this.state.userId;
  }

  /** Stored HMAC-SHA256 digest of the raw token. */
  get tokenHash(): string {
    return this.state.tokenHash;
  }

  /** When the session stops being valid. */
  get expiresAt(): Date {
    return this.state.expiresAt;
  }

  /** When the session row was created. */
  get createdAt(): Date {
    return this.state.createdAt;
  }

  /** Device string captured at sign in. */
  get deviceInfo(): string | null {
    return this.state.deviceInfo;
  }

  /** Client IP captured by the proxy at sign in. */
  get ipAddress(): string | null {
    return this.state.ipAddress;
  }

  /** When the row was revoked, or null. */
  get revokedAt(): Date | null {
    return this.state.revokedAt;
  }

  /** The successor row created by a rotation, or null. */
  get replacedByTokenId(): string | null {
    return this.state.replacedByTokenId;
  }

  /**
   * Whether the session has passed its expiry.
   *
   * @param now Current time.
   * @returns True when expired.
   */
  isExpired(now: Date): boolean {
    return this.state.expiresAt <= now;
  }

  /**
   * Whether the row has been revoked (by sign out, rotation, reset, or reuse).
   *
   * @returns True when revoked.
   */
  isRevoked(): boolean {
    return this.state.revokedAt !== null;
  }

  /**
   * Whether the session can still be used to refresh.
   *
   * @param now Current time.
   * @returns True when the row is neither revoked nor expired.
   */
  isActive(now: Date): boolean {
    return !this.isRevoked() && !this.isExpired(now);
  }

  /**
   * Whether a revoked token is being presented inside the concurrent refresh
   * window, which must not be treated as reuse.
   *
   * The window only applies to a rotation successor, never to a sign out or a
   * password reset.
   *
   * @param now Current time.
   * @returns True inside the 10 second grace window after rotation.
   */
  isWithinRotationGrace(now: Date): boolean {
    // Rotated at `revokedAt`; the grace runs until revokedAt + ROTATION_GRACE_MS.
    return (
      this.state.revokedAt !== null &&
      this.state.replacedByTokenId !== null &&
      now.getTime() - this.state.revokedAt.getTime() <= ROTATION_GRACE_MS
    );
  }

  /**
   * Whether presenting this token again is reuse that must revoke the account's
   * sessions.
   *
   * Reuse means a rotated token (one that has a successor) replayed outside the
   * grace window. A row revoked by sign out or a password reset has no
   * successor, so replaying it is a plain invalid session, never a reason to
   * revoke every other session on the account.
   *
   * @param now Current time.
   * @returns True for a rotated token outside the rotation grace window.
   */
  isReuse(now: Date): boolean {
    return (
      this.isRevoked() &&
      this.state.replacedByTokenId !== null &&
      !this.isWithinRotationGrace(now)
    );
  }
}
