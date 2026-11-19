/** Catalog errors that map to HTTP responses in the presentation layer. */
export type CatalogErrorCode = "PRODUCT_NOT_FOUND" | "CATEGORY_NOT_FOUND";

/**
 * An expected catalog failure.
 *
 * The presentation layer maps the code to an HTTP status and response code.
 */
export class CatalogError extends Error {
  /**
   * @param code Stable error code.
   * @param message Customer safe message.
   */
  constructor(
    public readonly code: CatalogErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CatalogError";
  }
}
