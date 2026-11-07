import express, { type Router } from "express";
import cors from "cors";
import type { ApiEnv } from "./config/env.js";
import { createHealthRouter } from "./presentation/routes/health.routes.js";
import { errorHandler } from "./presentation/middleware/errorHandler.js";

/**
 * Creates and configures the Express application.
 *
 * Kept separate from `index.ts` so integration tests can build the real app
 * without importing the process entry point, which starts listening.
 *
 * @param env Validated runtime configuration.
 * @param checkDatabase Readiness probe for PostgreSQL.
 * @param authRouter Auth router, wired with its repositories and ports.
 * @returns Configured Express application.
 */
export function createApp(
  env: ApiEnv,
  checkDatabase: () => Promise<boolean>,
  authRouter?: Router,
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

  if (authRouter) {
    app.use("/api/auth", authRouter);
  }

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
