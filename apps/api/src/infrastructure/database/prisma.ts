import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";

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
 * Creates the Prisma client, its driver adapter, and lifecycle helpers.
 *
 * Prisma 7 requires a driver adapter. `pg` pool defaults differ from the
 * Prisma 6 query engine, so the timeouts are tuned to match the previous
 * behaviour: 5s to acquire a connection and 300s before idle connections
 * are released.
 *
 * @param databaseUrl Validated PostgreSQL connection string.
 * @returns Database handle with health check and disconnect helpers.
 */
export function createDatabase(databaseUrl: string): Database {
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 300_000,
  });
  const client = new PrismaClient({ adapter });

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
