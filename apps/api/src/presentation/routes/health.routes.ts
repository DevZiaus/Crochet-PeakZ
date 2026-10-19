import { Router, type Request, type Response } from "express";

/** Dependencies required by the health routes. */
export interface HealthRouterDependencies {
  /** Returns true when the database is reachable. */
  checkDatabase: () => Promise<boolean>;
}

/**
 * Creates the health routes.
 *
 * `/api/health` is a liveness probe: it only proves the process is running.
 * `/api/health/ready` is a readiness probe: it also checks PostgreSQL, so
 * orchestrators can hold traffic until the database is available.
 *
 * @param dependencies Health check implementations.
 * @returns Router mounted under `/api`.
 */
export function createHealthRouter({
  checkDatabase,
}: HealthRouterDependencies): Router {
  const router = Router();

  router.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  router.get("/health/ready", async (_req: Request, res: Response) => {
    const databaseReady = await checkDatabase();

    res.status(databaseReady ? 200 : 503).json({
      status: databaseReady ? "ready" : "not_ready",
      database: databaseReady ? "up" : "down",
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
