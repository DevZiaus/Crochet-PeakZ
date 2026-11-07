/**
 * Domain errors raised by entities and repositories.
 *
 * They carry a machine readable code and no HTTP concept, so the presentation
 * layer decides the status code.
 */

/** A unique email constraint was violated. */
export class EmailAlreadyExistsError extends Error {
  /** Stable error code. */
  readonly code = "EMAIL_TAKEN" as const;

  constructor() {
    super("An account with this email already exists.");
    this.name = "EmailAlreadyExistsError";
  }
}
