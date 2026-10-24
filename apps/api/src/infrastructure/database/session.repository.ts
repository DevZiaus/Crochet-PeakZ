import type {
  PrismaClient,
  RefreshToken,
} from "../../generated/prisma/client.js";
import { Session } from "../../domain/entities/session.js";
import type {
  CreateSessionInput,
  SessionRepository,
} from "../../domain/ports/session-repository.js";

/**
 * Prisma backed refresh token repository.
 *
 * Only hashes are stored; the raw token never reaches this layer.
 */
export class PrismaSessionRepository implements SessionRepository {
  /**
   * @param prisma Prisma client owned by the composition root.
   */
  constructor(private readonly prisma: PrismaClient) {}

  /** @inheritdoc */
  async create(input: CreateSessionInput): Promise<Session> {
    const row = await this.prisma.refreshToken.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        deviceInfo: input.deviceInfo,
        ipAddress: input.ipAddress,
      },
    });
    return toDomain(row);
  }

  /** @inheritdoc */
  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    return row ? toDomain(row) : null;
  }

  /** @inheritdoc */
  async markRotated(
    id: string,
    state: { revokedAt: Date; replacedByTokenId: string },
  ): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: {
        revokedAt: state.revokedAt,
        replacedByTokenId: state.replacedByTokenId,
      },
    });
  }

  /** @inheritdoc */
  async revoke(id: string, now: Date): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: now },
    });
  }

  /** @inheritdoc */
  async revokeAllForUser(userId: string, now: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
  }
}

/** Maps a Prisma refresh token row to the domain entity. */
function toDomain(row: RefreshToken): Session {
  return Session.reconstitute({
    id: row.id,
    userId: row.userId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    deviceInfo: row.deviceInfo,
    ipAddress: row.ipAddress,
    revokedAt: row.revokedAt,
    replacedByTokenId: row.replacedByTokenId,
    createdAt: row.createdAt,
  });
}
