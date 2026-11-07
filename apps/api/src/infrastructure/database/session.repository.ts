import type {
  PrismaClient,
  RefreshToken,
} from "../../generated/prisma/client.js";
import { Session } from "../../domain/entities/session.js";
import type {
  CreateSessionInput,
  RotateSessionInput,
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
  async findById(id: string): Promise<Session | null> {
    const row = await this.prisma.refreshToken.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  /** @inheritdoc */
  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    return row ? toDomain(row) : null;
  }

  /** @inheritdoc */
  async rotate(id: string, input: RotateSessionInput): Promise<Session | null> {
    return this.prisma.$transaction(async (transaction) => {
      const successor = await transaction.refreshToken.create({
        data: {
          userId: input.userId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
          deviceInfo: input.deviceInfo,
          ipAddress: input.ipAddress,
        },
      });

      const claimed = await transaction.refreshToken.updateMany({
        where: { id, revokedAt: null },
        data: {
          revokedAt: input.revokedAt,
          replacedByTokenId: successor.id,
        },
      });

      if (claimed.count !== 1) {
        // Another request won the rotation. Drop this transaction's successor
        // so the account keeps exactly one live chain.
        await transaction.refreshToken.delete({ where: { id: successor.id } });
        return null;
      }

      return toDomain(successor);
    });
  }

  /** @inheritdoc */
  async revokeChain(id: string, now: Date): Promise<void> {
    let currentId: string | null = id;
    const visited = new Set<string>();

    while (currentId !== null && !visited.has(currentId)) {
      visited.add(currentId);

      const row: { replacedByTokenId: string | null } | null =
        await this.prisma.refreshToken.findUnique({
          where: { id: currentId },
          select: { replacedByTokenId: true },
        });

      if (row === null) {
        return;
      }

      // Only set the timestamp once; a revoked row keeps its original time so
      // sign out cannot extend the rotation grace window.
      const revoked = await this.prisma.refreshToken.updateMany({
        where: { id: currentId, revokedAt: null },
        data: { revokedAt: now },
      });

      if (revoked.count === 1) {
        currentId = row.replacedByTokenId;
        continue;
      }

      // The row was claimed between the read above and the guarded write:
      // either a parallel sign out already revoked it, or a rotate committed
      // and set a successor the read could not see yet. Re-read the link so a
      // rotation that landed in that window is not left live behind the sign
      // out.
      const latest: { replacedByTokenId: string | null } | null =
        await this.prisma.refreshToken.findUnique({
          where: { id: currentId },
          select: { replacedByTokenId: true },
        });

      currentId = latest?.replacedByTokenId ?? null;
    }
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
