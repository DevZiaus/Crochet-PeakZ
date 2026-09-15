import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { healthRouter } from "./presentation/routes/health.routes";
import { errorHandler } from "./presentation/middleware/errorHandler";

/**
 * Validates that all required environment variables are present.
 * Fails fast on missing config as per project conventions.
 */
function validateEnv(): void {
  const required = ["DATABASE_URL"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        `Copy .env.example to .env and fill in the values.`,
    );
  }
}

/**
 * Creates and configures the Express application.
 */
function createApp(): express.Application {
  const app = express();

  // Middleware
  app.use(
    cors({
      origin: process.env["CORS_ORIGIN"] ?? "http://localhost:3000",
      credentials: true,
    }),
  );
  app.use(express.json());

  // Routes
  app.use("/api", healthRouter);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}

/**
 * Starts the server: validates env, connects to the database, and listens.
 */
async function main(): Promise<void> {
  validateEnv();

  const prisma = new PrismaClient();

  try {
    // Verify database connection
    await prisma.$connect();
    console.log("[DB] Connected to PostgreSQL");
  } catch (error) {
    console.warn(
      "[DB] Could not connect to PostgreSQL. The server will start, " +
        "but database features will not work until the connection is available.",
    );
    console.warn("[DB]", error instanceof Error ? error.message : error);
  }

  const app = createApp();
  const port = parseInt(process.env["PORT"] ?? "4000", 10);

  app.listen(port, () => {
    console.log(`[API] Crochet PeakZ API running on http://localhost:${port}`);
    console.log(`[API] Health check: http://localhost:${port}/api/health`);
  });
}

main().catch((error: unknown) => {
  console.error("[FATAL] Failed to start server:", error);
  process.exit(1);
});
