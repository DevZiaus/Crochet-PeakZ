import { randomBytes } from "node:crypto";
import { Router, type Request, type RequestHandler } from "express";
import {
  forgotPasswordSchema,
  loginSchema,
  normalizeEmail,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  resolvePostSignInPath,
  sanitizeNextPath,
  tokenSchema,
} from "@crochet-peakz/shared";
import {
  ACCESS_COOKIE_NAME,
  OAUTH_STATE_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  RESEND_THROTTLE_MS,
} from "../../domain/auth-constants.js";
import {
  OAUTH_PROVIDERS,
  type OAuthProfile,
  type OAuthProviderName,
} from "../../domain/types.js";
import type { OAuthAuthenticator } from "../../infrastructure/oauth/passport.js";
import type { AuthDependencies } from "../../application/dependencies.js";
import { AuthError, type SessionContext } from "../../application/errors.js";
import { normalizeDeviceInfo } from "../../application/dependencies.js";
import { forgotPassword } from "../../application/use-cases/forgot-password.js";
import { loginUser } from "../../application/use-cases/login.js";
import { logoutSession } from "../../application/use-cases/logout.js";
import { getCurrentUser } from "../../application/use-cases/me.js";
import { signInWithOAuth } from "../../application/use-cases/oauth.js";
import { refreshSession } from "../../application/use-cases/refresh.js";
import { registerUser } from "../../application/use-cases/register.js";
import { resendVerification } from "../../application/use-cases/resend-verification.js";
import { resetPassword } from "../../application/use-cases/reset-password.js";
import { verifyEmail } from "../../application/use-cases/verify-email.js";
import { createRequireAuth, readCookie } from "./auth-middleware.js";
import {
  clearAuthCookies,
  clearOAuthStateCookie,
  setAuthCookies,
  setOAuthStateCookie,
} from "./cookies.js";
import { asyncHandler } from "./http.js";
import { createProxyGuard, getClientIp } from "./proxy-guard.js";
import { createRateLimit } from "./rate-limit.js";
import { timingSafeStringEquals } from "./timing-safe.js";

/** Everything the auth router needs from the composition root. */
export interface AuthRouterDependencies {
  auth: AuthDependencies;
  proxySharedSecret: string;
  webAppUrl: string;
  isProduction: boolean;
  authenticator: OAuthAuthenticator;
}

/** The two OAuth providers, keyed by path segment. */
type OAuthProviderPath = OAuthProviderName;

/**
 * Builds the `/api/auth` router.
 *
 * Every route sits behind the proxy shared secret check. State changing
 * requests additionally require the web origin. Each public route has its own
 * rate limit.
 *
 * @param deps Composition root dependencies.
 * @returns Mounted at `/api/auth`.
 */
export function createAuthRouter(deps: AuthRouterDependencies): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.auth.tokens);
  const isProduction = deps.isProduction;

  router.use(
    createProxyGuard({
      sharedSecret: deps.proxySharedSecret,
      webAppUrl: deps.webAppUrl,
    }),
  );

  const context = (req: Request): SessionContext => ({
    deviceInfo: normalizeDeviceInfo(req.get("user-agent")),
    ipAddress: getClientIp(req),
  });

  // Keys a resend by the address in the body, so an unknown or verified
  // address is throttled exactly like an unverified one.
  const resendAccountLimit = createRateLimit({
    windowMs: RESEND_THROTTLE_MS,
    max: 1,
    key: (req) => {
      const body: unknown = req.body;
      if (typeof body !== "object" || body === null) {
        return null;
      }
      const email = (body as { email?: unknown }).email;
      return typeof email === "string"
        ? `resend:${normalizeEmail(email)}`
        : null;
    },
  });

  router.post(
    "/register",
    createRateLimit({ windowMs: 60 * 60 * 1000, max: 5 }),
    asyncHandler(async (req, res) => {
      const input = registerSchema.parse(req.body);
      const user = await registerUser(deps.auth, input);
      res.status(201).json(user);
    }),
  );

  router.post(
    "/verify-email",
    createRateLimit({ windowMs: 15 * 60 * 1000, max: 10 }),
    asyncHandler(async (req, res) => {
      const { token } = tokenSchema.parse(req.body);
      const user = await verifyEmail(deps.auth, token);
      res.status(200).json(user);
    }),
  );

  router.post(
    "/resend-verification",
    createRateLimit({ windowMs: 15 * 60 * 1000, max: 10 }),
    resendAccountLimit,
    asyncHandler(async (req, res) => {
      const { email } = resendVerificationSchema.parse(req.body);
      try {
        await resendVerification(deps.auth, email);
      } catch (error) {
        if (error instanceof AuthError && error.code === "RESEND_TOO_SOON") {
          const retryAfter = error.details?.["retryAfterSeconds"];
          res.setHeader(
            "Retry-After",
            typeof retryAfter === "number" ? String(retryAfter) : "60",
          );
        }
        throw error;
      }
      res.status(202).json({
        message:
          "If that account needs verification, a new link is on its way.",
      });
    }),
  );

  router.post(
    "/login",
    createRateLimit({ windowMs: 15 * 60 * 1000, max: 10 }),
    asyncHandler(async (req, res) => {
      const input = loginSchema.parse(req.body);
      const result = await loginUser(deps.auth, input, context(req));
      setAuthCookies(res, result, isProduction);
      res.status(200).json(result.user);
    }),
  );

  router.post(
    "/refresh",
    createRateLimit({ windowMs: 60 * 1000, max: 60 }),
    asyncHandler(async (req, res) => {
      const raw = readRefreshCookie(req);
      if (!raw) {
        // Nothing to clear when the caller sent no auth cookies at all. When an
        // access cookie lingers without its refresh partner, clear it so the
        // browser stops sending a token the API will only reject.
        if (readCookie(req.headers.cookie, ACCESS_COOKIE_NAME)) {
          clearAuthCookies(res, isProduction);
        }
        res.status(401).json({
          error: { message: "Your session has expired.", statusCode: 401 },
        });
        return;
      }

      try {
        const result = await refreshSession(deps.auth, raw);
        setAuthCookies(res, result, isProduction);
        res.status(200).json(result.user);
      } catch (error) {
        if (error instanceof AuthError && error.code === "INVALID_SESSION") {
          clearAuthCookies(res, isProduction);
        }
        throw error;
      }
    }),
  );

  router.post(
    "/logout",
    createRateLimit({ windowMs: 60 * 1000, max: 60 }),
    asyncHandler(async (req, res) => {
      await logoutSession(deps.auth, readRefreshCookie(req));
      clearAuthCookies(res, isProduction);
      res.status(204).end();
    }),
  );

  // The address limiter runs before the token check, so a forged or expired
  // cookie still costs a slot. `requireAuth` would otherwise reject first and
  // leave anonymous traffic unthrottled. The account limiter then keeps one
  // signed in customer from spending a shared address's whole budget.
  router.get(
    "/me",
    createRateLimit({ windowMs: 60 * 1000, max: 120 }),
    requireAuth,
    createRateLimit({
      windowMs: 60 * 1000,
      max: 120,
      key: (req) => `user:${req.auth?.userId ?? "unknown"}`,
    }),
    asyncHandler(async (req, res) => {
      const user = await getCurrentUser(deps.auth, req.auth?.userId ?? "");
      res.status(200).json(user);
    }),
  );

  router.post(
    "/forgot-password",
    createRateLimit({ windowMs: 15 * 60 * 1000, max: 3 }),
    asyncHandler(async (req, res) => {
      const { email } = forgotPasswordSchema.parse(req.body);
      await forgotPassword(deps.auth, email);
      res.status(202).json({
        message:
          "If an account with that email has a password, a reset link is on its way.",
      });
    }),
  );

  router.post(
    "/reset-password",
    createRateLimit({ windowMs: 15 * 60 * 1000, max: 10 }),
    asyncHandler(async (req, res) => {
      const { token, password } = resetPasswordSchema.parse(req.body);
      await resetPassword(deps.auth, token, password);
      res.status(200).json({
        message: "Your password has been reset. Sign in with the new password.",
      });
    }),
  );

  for (const provider of OAUTH_PROVIDERS) {
    router.get(
      `/${provider}`,
      createRateLimit({ windowMs: 60 * 1000, max: 60 }),
      startOAuth(deps, provider),
    );
    router.get(
      `/${provider}/callback`,
      createRateLimit({ windowMs: 60 * 1000, max: 60 }),
      handleOAuthCallback(deps, provider),
    );
  }

  return router;
}

/** Reads the refresh cookie from the request. */
function readRefreshCookie(req: Request): string | undefined {
  return readCookie(req.headers.cookie, REFRESH_COOKIE_NAME);
}

/**
 * Starts the provider round trip.
 *
 * A signed 10 minute state value carrying the provider, a nonce, and the
 * relative `next` is stored in an HttpOnly cookie scoped to `/api/auth` and
 * sent to the provider.
 */
function startOAuth(
  deps: AuthRouterDependencies,
  provider: OAuthProviderPath,
): RequestHandler {
  return asyncHandler(async (req, res) => {
    const rawNext =
      typeof req.query["next"] === "string" ? req.query["next"] : null;
    const next = sanitizeNextPath(rawNext, "/");
    const nonce = randomBytes(16).toString("base64url");
    const state = await deps.auth.tokens.signOAuthState({
      nonce,
      next,
      provider,
    });

    setOAuthStateCookie(res, state, deps.isProduction);

    const middleware = deps.authenticator.authenticate(provider, {
      session: false,
      state,
      scope: provider === "google" ? ["profile", "email"] : undefined,
    });
    middleware(req, res, () => {
      res.status(502).json({
        error: {
          message: "Could not start provider sign in.",
          statusCode: 502,
        },
      });
    });
  });
}

/**
 * Handles the provider callback.
 *
 * Verifies the signed state against its cookie, exchanges the code through
 * Passport, resolves the account by verified email, sets the auth cookies, and
 * redirects to the web result page with `provider`, `next`, and a status.
 */
function handleOAuthCallback(
  deps: AuthRouterDependencies,
  provider: OAuthProviderPath,
): RequestHandler {
  return asyncHandler(async (req, res, next) => {
    const queryError = req.query["error"];
    const state =
      typeof req.query["state"] === "string" ? req.query["state"] : "";
    const cookieState = readCookie(req.headers.cookie, OAUTH_STATE_COOKIE_NAME);

    if (queryError === "access_denied") {
      clearOAuthStateCookie(res, deps.isProduction);
      res.redirect(
        302,
        resultUrl(deps.webAppUrl, provider, "/", "access_denied"),
      );
      return;
    }

    if (!state || !cookieState || !timingSafeStringEquals(state, cookieState)) {
      clearOAuthStateCookie(res, deps.isProduction);
      res.redirect(
        302,
        resultUrl(deps.webAppUrl, provider, "/", "provider_error"),
      );
      return;
    }

    let nextPath = "/";
    try {
      const claims = await deps.auth.tokens.verifyOAuthState(state);
      // A valid state minted for the other provider must not satisfy this
      // callback, so the signed provider claim has to match the route.
      if (claims.provider !== provider) {
        throw new Error("OAuth state provider mismatch.");
      }
      nextPath = sanitizeNextPath(claims.next, "/");
    } catch {
      clearOAuthStateCookie(res, deps.isProduction);
      res.redirect(
        302,
        resultUrl(deps.webAppUrl, provider, "/", "provider_error"),
      );
      return;
    }

    clearOAuthStateCookie(res, deps.isProduction);

    const middleware = deps.authenticator.authenticate(
      provider,
      { session: false },
      (error: Error | null | undefined, user: unknown) => {
        if (error || !user) {
          console.error(
            `[auth] ${provider} OAuth callback failed:`,
            error?.message ?? "no profile returned",
          );
          res.redirect(
            302,
            resultUrl(deps.webAppUrl, provider, nextPath, "provider_error"),
          );
          return;
        }

        const outcome = toOAuthProfile(provider, user);
        if ("error" in outcome) {
          res.redirect(
            302,
            resultUrl(deps.webAppUrl, provider, nextPath, outcome.error),
          );
          return;
        }

        signInWithOAuth(deps.auth, outcome.profile, {
          deviceInfo: normalizeDeviceInfo(req.get("user-agent")),
          ipAddress: getClientIp(req),
        })
          .then((result) => {
            setAuthCookies(res, result, deps.isProduction);
            const destination = resolvePostSignInPath(
              nextPath,
              result.user.role,
            );
            res.redirect(
              302,
              resultUrl(deps.webAppUrl, provider, destination, null),
            );
          })
          .catch((linkError: unknown) => {
            console.error("[auth] OAuth account link failed", linkError);
            res.redirect(
              302,
              resultUrl(deps.webAppUrl, provider, nextPath, "link_failed"),
            );
          });
      },
    );

    middleware(req, res, next);
  });
}

/**
 * Builds the web result URL.
 *
 * @param webAppUrl Public web origin.
 * @param provider Provider path segment.
 * @param next Relative destination.
 * @param errorCode Failure code, or null for success.
 */
function resultUrl(
  webAppUrl: string,
  provider: OAuthProviderPath,
  next: string,
  errorCode:
    | "access_denied"
    | "email_missing"
    | "email_unverified"
    | "provider_error"
    | "link_failed"
    | null,
): string {
  const params = new URLSearchParams();
  params.set("provider", provider);
  params.set("next", next);
  if (errorCode) {
    params.set("error", errorCode);
  } else {
    params.set("status", "success");
  }
  return `${webAppUrl}/auth/callback?${params.toString()}`;
}

/** Minimal shape of the profile Passport hands back. */
interface PassportProfileLike {
  id?: string;
  displayName?: string;
  emails?: { value: string }[];
  photos?: { value: string }[];
  /**
   * Provider payload. Google sends `email_verified`; Facebook deprecated its
   * `verified` field and omits `email` unless the user has a confirmed primary
   * email. This is a provider wire key, not our own type.
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  _json?: { email_verified?: boolean };
}

/** The identity read from a provider profile, or why it was refused. */
type OAuthProfileOutcome =
  { profile: OAuthProfile } | { error: "email_missing" | "email_unverified" };

/**
 * Extracts a proven identity from a Passport profile.
 *
 * Email is the identity key. Google proves ownership only when `_json` carries
 * `email_verified: true`; Facebook's Graph API deprecated `verified` and only
 * exposes a user's confirmed primary address in `email`, so any non-empty
 * Facebook email is accepted while missing emails are refused.
 */
function toOAuthProfile(
  provider: OAuthProviderPath,
  raw: unknown,
): OAuthProfileOutcome {
  const profile = raw as PassportProfileLike;
  const email = profile.emails?.[0]?.value.trim().toLowerCase();

  if (!email) {
    return { error: "email_missing" };
  }

  if (provider === "google" && profile._json?.email_verified !== true) {
    return { error: "email_unverified" };
  }

  const name = profile.displayName?.trim() || email.split("@")[0] || email;

  return {
    profile: {
      provider: provider === "google" ? "GOOGLE" : "FACEBOOK",
      providerId: profile.id ?? null,
      email,
      name,
      avatarUrl: profile.photos?.[0]?.value ?? null,
    },
  };
}
