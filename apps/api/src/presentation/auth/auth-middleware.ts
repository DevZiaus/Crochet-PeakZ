import type { RequestHandler } from "express";
import { ACCESS_COOKIE_NAME } from "../../domain/auth-constants.js";
import type { UserRepository } from "../../domain/ports/user-repository.js";
import type { TokenService } from "../../domain/ports/token-service.js";
import { AppError } from "../middleware/errorHandler.js";

/**
 * Reads and verifies the access cookie, attaching the caller identity.
 *
 * The role in the token is only a hint; admin checks read the database again so
 * a revoked role takes effect on the next request.
 *
 * @param tokens Token verifier.
 * @returns Express middleware that fails with 401 when no valid token is sent.
 */
export function createRequireAuth(tokens: TokenService): RequestHandler {
  return (req, _res, next) => {
    const cookie = readCookie(req.headers.cookie, ACCESS_COOKIE_NAME);
    if (!cookie) {
      next(new AppError(401, "Sign in to continue."));
      return;
    }

    void tokens
      .verifyAccessToken(cookie)
      .then((claims) => {
        req.auth = { userId: claims.sub, role: claims.role };
        next();
      })
      .catch(() => {
        next(new AppError(401, "Your session has expired. Sign in again."));
      });
  };
}

/**
 * Requires an ADMIN account, rechecking the role in the database.
 *
 * Anonymous callers get 401. A signed in CUSTOMER, or an admin whose role was
 * removed, gets 403 on the next request even with an unexpired access token.
 *
 * Note: no production route mounts this yet. The admin area is guarded in the
 * web layer (`apps/web`), and this middleware is exercised by tests only, so it
 * is not live protection until a backend admin route attaches it.
 *
 * TODO(admin-api): attach this to the first backend admin route before that
 * route ships. Until then, web route guards are the only enforcement.
 *
 * @param users Account repository.
 * @returns Express middleware.
 */
export function createRequireAdmin(users: UserRepository): RequestHandler {
  return (req, _res, next) => {
    const auth = req.auth;
    if (!auth) {
      next(new AppError(401, "Sign in to continue."));
      return;
    }

    void users
      .findById(auth.userId)
      .then((user) => {
        if (!user) {
          next(new AppError(401, "Your session is no longer valid."));
          return;
        }
        if (user.role !== "ADMIN") {
          next(new AppError(403, "You do not have access to this area."));
          return;
        }
        next();
      })
      .catch(next);
  };
}

/**
 * Reads one cookie value from a raw `Cookie` header.
 *
 * A malformed percent sequence throws, so decode failures are treated as an
 * absent cookie rather than leaking a 500.
 *
 * @param header Raw cookie header.
 * @param name Cookie name.
 * @returns Decoded value, or undefined when absent or malformed.
 */
export function readCookie(
  header: string | undefined,
  name: string,
): string | undefined {
  if (!header) {
    return undefined;
  }

  try {
    for (const part of header.split(";")) {
      const [key, ...rest] = part.trim().split("=");
      if (key === name) {
        return decodeURIComponent(rest.join("="));
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}
