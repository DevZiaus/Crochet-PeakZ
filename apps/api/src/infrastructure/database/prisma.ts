import { PrismaClient } from "@prisma/client";

/**
 * Database handle owned by the composition root.
 *
 * The client is created lazily (after environment variables are loaded)
 * and passed to the presentation layer as a narrow health-check function,
 * keeping Prisma out of routes.
 */
export interface Database {
  /** Prisma client for repositories and use cases. */
  client: PrismaClient;
  /** Returns true when PostgreSQL accepts a trivial query. */
  checkHealth: () => Promise<boolean>;
  /** Closes the connection pool during graceful shutdown. */
  disconnect: () => Promise<void>;
}

/**
 * Creates the Prisma client and its lifecycle helpers.
 *
 * Must be called after `dotenv` has populated `process.env` so Prisma can
 * read `DATABASE_URL`.
 *
 * @returns Database handle with health check and disconnect helpers.
 */
export function createDatabase(): Database {
  const client = new PrismaClient();

  return {
    client,
    async checkHealth(): Promise<boolean> {
      try {
        await client.$queryRaw`SELECT 1`;
        return true;
      } catch {
        return false;
      }
    },
    async disconnect(): Promise<void> {
      await client.$disconnect();
    },
  };
}
