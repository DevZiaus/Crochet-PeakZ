import type { UserRole } from "../../domain/types.js";

/** Identity attached to a request after the access token is verified. */
export interface AuthContext {
  /** Account id from the token subject. */
  userId: string;
  /** Role carried by the token (admin checks recheck the database). */
  role: UserRole;
}

declare module "express-serve-static-core" {
  interface Request {
    /** Verified caller identity, set by `requireAuth`. */
    auth?: AuthContext;
  }
}
