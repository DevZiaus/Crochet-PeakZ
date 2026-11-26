import type { RequestHandler } from "express";
import { ZodError } from "zod";
import { AuthError } from "../../application/errors.js";
import { AppError } from "../middleware/errorHandler.js";

/**
 * Maps an auth application error onto an HTTP error.
 *
 * @param error Unknown error thrown by a use case.
 * @returns An `AppError` for expected failures, otherwise the original error.
 */
export function toHttpError(error: unknown): unknown {
  if (error instanceof ZodError) {
    return new AppError(422, "Please check the highlighted fields.", {
      code: "VALIDATION_FAILED",
      details: {
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    });
  }

  if (!(error instanceof AuthError)) {
    return error;
  }

  switch (error.code) {
    case "EMAIL_TAKEN":
      return new AppError(409, error.message, { code: "EMAIL_TAKEN" });
    case "INVALID_CREDENTIALS":
      return new AppError(401, error.message, { code: "INVALID_CREDENTIALS" });
    case "EMAIL_UNVERIFIED":
      return new AppError(403, error.message, {
        code: "EMAIL_UNVERIFIED",
        ...(error.details ? { details: error.details } : {}),
      });
    case "INVALID_LINK":
      return new AppError(400, error.message, { code: "INVALID_TOKEN" });
    case "INVALID_SESSION":
      return new AppError(401, error.message, {
        code: "INVALID_SESSION",
        ...(error.details ? { details: error.details } : {}),
      });
    case "EXPIRED_TOKEN":
      return new AppError(410, error.message, {
        code: "TOKEN_EXPIRED",
        ...(error.details ? { details: error.details } : {}),
      });
    case "RESEND_TOO_SOON": {
      const seconds = Number(error.details?.["retryAfterSeconds"] ?? 60);
      const appError = new AppError(429, error.message, {
        code: "RESEND_TOO_SOON",
        details: { retryAfterSeconds: seconds },
      });
      return appError;
    }
    case "OAUTH_LINK_DISALLOWED":
      return new AppError(409, error.message, {
        code: "OAUTH_LINK_DISALLOWED",
      });
  }
}

/**
 * Wraps an async route handler so rejected promises reach the error middleware.
 *
 * @param handler Async handler.
 * @returns An Express handler.
 */
export function asyncHandler(
  handler: (
    req: Parameters<RequestHandler>[0],
    res: Parameters<RequestHandler>[1],
    next: Parameters<RequestHandler>[2],
  ) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch((error: unknown) => {
      next(toHttpError(error));
    });
  };
}
