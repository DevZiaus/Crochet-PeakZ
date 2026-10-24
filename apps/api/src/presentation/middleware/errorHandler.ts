import type { Request, Response, NextFunction } from "express";

/**
 * Custom application error with an HTTP status code.
 */
export class AppError extends Error {
  /**
   * @param statusCode HTTP status to return.
   * @param message Human readable message safe for the client.
   * @param options Optional machine readable code and extra response fields.
   */
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly options?: {
      code?: string;
      details?: Record<string, unknown>;
    },
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Centralized error handler middleware.
 * Catches all errors, logs them, and returns a consistent JSON response.
 * Must be registered after all routes.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message =
    err instanceof AppError ? err.message : "Internal server error";

  if (statusCode === 500) {
    console.error("[ERROR]", err);
  }

  res.status(statusCode).json({
    error: {
      message,
      statusCode,
      ...(err instanceof AppError && err.options?.code
        ? { code: err.options.code }
        : {}),
      ...(err instanceof AppError && err.options?.details
        ? { details: err.options.details }
        : {}),
    },
  });
}
