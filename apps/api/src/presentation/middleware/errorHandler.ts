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
 * Whether an error carries an HTTP status a client should see.
 *
 * The JSON body parser rejects malformed or oversized bodies with an error
 * that has `status`/`statusCode` in the 4xx range, not an `AppError`. Honouring
 * it turns those into 400/413 responses instead of a misleading 500 that also
 * floods the error log.
 *
 * @param err Thrown value.
 * @returns The status when it is a client error, otherwise null.
 */
function clientErrorStatus(err: Error): number | null {
  const candidate: unknown = (err as { status?: unknown }).status;
  const status =
    typeof candidate === "number"
      ? candidate
      : (err as { statusCode?: unknown }).statusCode;

  if (typeof status === "number" && status >= 400 && status <= 499) {
    return status;
  }

  return null;
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
  const clientStatus = err instanceof AppError ? null : clientErrorStatus(err);
  const statusCode =
    err instanceof AppError ? err.statusCode : (clientStatus ?? 500);
  const message =
    err instanceof AppError
      ? err.message
      : clientStatus !== null
        ? "The request could not be read."
        : "Internal server error";

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
