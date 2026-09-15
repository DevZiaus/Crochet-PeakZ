import { Router, type Request, type Response } from "express";

/**
 * Health check routes.
 * Provides a simple endpoint to verify the API server is running.
 */
export const healthRouter = Router();

healthRouter.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});
