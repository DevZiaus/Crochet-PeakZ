import { Router } from "express";
import { catalogListQuerySchema } from "@crochet-peakz/shared";
import type { CatalogListQuery } from "@crochet-peakz/shared";
import type { CatalogDependencies } from "../../application/catalog/dependencies.js";
import { getCategory } from "../../application/catalog/get-category.js";
import { getProduct } from "../../application/catalog/get-product.js";
import { listCategories } from "../../application/catalog/list-categories.js";
import { listProducts } from "../../application/catalog/list-products.js";
import { AppError } from "../middleware/errorHandler.js";
import { asyncHandler } from "./http.js";

/**
 * Creates the public catalog router.
 *
 * All routes are public GET routes mounted under `/api`. No session, proxy
 * secret, or admin role is required.
 *
 * @param dependencies Catalog dependencies.
 * @returns Configured Express router.
 */
export function createCatalogRouter(dependencies: CatalogDependencies): Router {
  const router = Router();

  router.get(
    "/products",
    asyncHandler(async (request, response) => {
      const query = parseListQuery(request.query);
      const result = await listProducts(dependencies, query);
      response.json(result);
    }),
  );

  router.get(
    "/products/:slug",
    asyncHandler(async (request, response) => {
      const slug =
        typeof request.params.slug === "string" ? request.params.slug : "";
      const result = await getProduct(dependencies, slug);
      response.json(result);
    }),
  );

  router.get(
    "/categories",
    asyncHandler(async (_request, response) => {
      const result = await listCategories(dependencies);
      response.json(result);
    }),
  );

  router.get(
    "/categories/:slug",
    asyncHandler(async (request, response) => {
      const slug =
        typeof request.params.slug === "string" ? request.params.slug : "";
      const result = await getCategory(dependencies, slug);
      response.json(result);
    }),
  );

  return router;
}

/**
 * Validates a raw Express query object.
 *
 * @param rawQuery Raw query object.
 * @returns The validated catalog query.
 * @throws {AppError} 400 `INVALID_QUERY` with an issues detail array.
 */
function parseListQuery(rawQuery: unknown): CatalogListQuery {
  const result = catalogListQuerySchema.safeParse(rawQuery);
  if (!result.success) {
    throw new AppError(400, "Invalid catalog query.", {
      code: "INVALID_QUERY",
      details: {
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    });
  }
  return result.data;
}
