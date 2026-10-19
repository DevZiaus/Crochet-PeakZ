import dotenv from "dotenv";
import type { Server } from "node:http";
import express from "express";
import cors from "cors";
import { loadEnv, type ApiEnv } from "./config/env.js";
import {
  createDatabase,
  type Database,
} from "./infrastructure/database/prisma.js";
import { createHealthRouter } from "./presentation/routes/health.routes.js";
import { errorHandler } from "./presentation/middleware/errorHandler.js";

dotenv.config({ quiet: true });

/**
 * Creates and configures the Express application.
 *
 * @param env Validated runtime configuration.
 * @param checkDatabase Readiness probe for PostgreSQL.
 * @returns Configured Express application.
 */
export function createApp(
  env: ApiEnv,
  checkDatabase: () => Promise<boolean>,
): express.Application {
  const app = express();

  app.disable("x-powered-by");

  if (env.trustProxy !== false) {
    app.set("trust proxy", env.trustProxy);
  }

  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.use("/api", createHealthRouter({ checkDatabase }));

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}

/**
 * Registers SIGTERM/SIGINT handlers so containers and process managers can
 * stop the API without dropping in-flight requests or leaking DB connections.
 *
 * @param server HTTP server returned by `app.listen`.
 * @param database Database handle to close.
 */
function installShutdownHandlers(server: Server, database: Database): void {
  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    console.log(`[API] ${signal} received, shutting down gracefully`);

    const forceExit = setTimeout(() => {
      console.error("[API] Graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    server.close(() => {
      void database.disconnect().finally(() => {
        clearTimeout(forceExit);
        process.exit(0);
      });
    });
  };

  process.once("SIGTERM", () => {
    shutdown("SIGTERM");
  });
  process.once("SIGINT", () => {
    shutdown("SIGINT");
  });
}

/**
 * Starts the server: validates env, connects to the database, and listens.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const database = createDatabase();

  try {
    // Verify database connection, but keep serving liveness checks if the
    // database is temporarily unavailable.
    await database.client.$connect();
    console.log("[DB] Connected to PostgreSQL");
  } catch (error) {
    console.warn(
      "[DB] Could not connect to PostgreSQL. The server will start, " +
        "but database features will not work until the connection is available.",
    );
    console.warn("[DB]", error instanceof Error ? error.message : error);
  }

  const app = createApp(env, database.checkHealth);
  const server = app.listen(env.port, env.host, () => {
    console.log(
      `[API] Crochet PeakZ API running on http://${env.host}:${env.port}`,
    );
    console.log(
      `[API] Health check: http://${env.host}:${env.port}/api/health`,
    );
  });

  server.on("error", (error) => {
    console.error("[FATAL] HTTP server error:", error);
    process.exit(1);
  });

  installShutdownHandlers(server, database);
}

main().catch((error: unknown) => {
  console.error("[FATAL] Failed to start server:", error);
  process.exit(1);
});
