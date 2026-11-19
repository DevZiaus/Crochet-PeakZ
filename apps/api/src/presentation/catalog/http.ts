import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "../middleware/errorHandler.js";
import { CatalogError } from "../../application/catalog/errors.js";

/**
 * Maps catalog errors to HTTP errors.
 *
 * @param error Thrown value.
 * @returns An error the centralized handler understands.
 */
export function toHttpError(error: unknown): unknown {
  if (error instanceof CatalogError) {
    return new AppError(404, error.message, { code: error.code });
  }
  return error;
}

/**
 * Wraps an async catalog handler so rejected promises reach the error
 * middleware.
 *
 * @param handler Async handler.
 * @returns An Express handler.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch((error: unknown) => {
      next(toHttpError(error));
    });
  };
}
