import type { CookieOptions, Response } from "express";
import {
  ACCESS_COOKIE_NAME,
  ACCESS_TOKEN_TTL_SECONDS,
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_STATE_COOKIE_PATH,
  OAUTH_STATE_TTL_SECONDS,
  REFRESH_COOKIE_NAME,
} from "../../domain/auth-constants.js";

/**
 * Builds the shared cookie options.
 *
 * Both auth cookies are HttpOnly, `SameSite=Lax`, `Path=/`, and `Secure` in
 * production. No `Domain` is ever set, so the browser binds them to the web
 * origin. Clearing reuses the identical attributes.
 */
function baseOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
  };
}

/**
 * Writes both auth cookies onto the response.
 *
 * @param res Express response.
 * @param tokens Raw token values.
 * @param isProduction Whether to add the Secure attribute.
 */
export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string; refreshTtlMs: number },
  isProduction: boolean,
): void {
  res.cookie(ACCESS_COOKIE_NAME, tokens.accessToken, {
    ...baseOptions(isProduction),
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
    ...baseOptions(isProduction),
    maxAge: tokens.refreshTtlMs,
  });
}

/**
 * Clears both auth cookies.
 *
 * @param res Express response.
 * @param isProduction Whether to add the Secure attribute.
 */
export function clearAuthCookies(res: Response, isProduction: boolean): void {
  res.clearCookie(ACCESS_COOKIE_NAME, baseOptions(isProduction));
  res.clearCookie(REFRESH_COOKIE_NAME, baseOptions(isProduction));
}

/**
 * Stores the signed OAuth state value in its short lived cookie.
 *
 * @param res Express response.
 * @param state Signed state value.
 * @param isProduction Whether to add the Secure attribute.
 */
export function setOAuthStateCookie(
  res: Response,
  state: string,
  isProduction: boolean,
): void {
  res.cookie(OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: OAUTH_STATE_COOKIE_PATH,
    maxAge: OAUTH_STATE_TTL_SECONDS * 1000,
  });
}

/**
 * Clears the OAuth state cookie.
 *
 * @param res Express response.
 * @param isProduction Whether to add the Secure attribute.
 */
export function clearOAuthStateCookie(
  res: Response,
  isProduction: boolean,
): void {
  res.clearCookie(OAUTH_STATE_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: OAUTH_STATE_COOKIE_PATH,
  });
}
