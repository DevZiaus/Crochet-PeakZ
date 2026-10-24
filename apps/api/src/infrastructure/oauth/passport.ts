import passport from "passport";
import type { RequestHandler } from "express";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";

/** Options the auth routes pass to Passport for each provider round trip. */
export interface OAuthAuthenticateOptions {
  /** Never install a Passport session; the API issues its own cookies. */
  session: false;
  /** Signed state value sent to the provider. */
  state?: string | undefined;
  /** Provider scopes for the entry request. */
  scope?: string[] | undefined;
}

/**
 * The narrow part of Passport the auth routes use.
 *
 * Typing the result as an Express handler keeps Passport's `any` return out of
 * the presentation layer while the constructor stays fully typed below.
 */
export interface OAuthAuthenticator {
  authenticate(
    provider: "google" | "facebook",
    options: OAuthAuthenticateOptions,
    callback?: (error: Error | null | undefined, user: unknown) => void,
  ): RequestHandler;
}

/** Credentials and callback origins for the two OAuth apps. */
export interface OAuthStrategyConfig {
  webAppUrl: string;
  google: { id: string; secret: string };
  facebook: { id: string; secret: string };
}

/**
 * Builds a Passport authenticator with the Google and Facebook strategies.
 *
 * Passport is used only for the provider redirect and profile fetch. Session
 * middleware is never installed; the callback handler issues our own cookies.
 *
 * @param config Provider credentials and the web origin used for callbacks.
 * @returns A configured Passport authenticator.
 */
export function createOAuthAuthenticator(
  config: OAuthStrategyConfig,
): OAuthAuthenticator {
  const authenticator = new passport.Authenticator();

  authenticator.use(
    new GoogleStrategy(
      {
        clientID: config.google.id,
        clientSecret: config.google.secret,
        callbackURL: `${config.webAppUrl}/api/auth/google/callback`,
        scope: ["profile", "email"],
      },
      (_accessToken, _refreshToken, profile, done) => {
        done(null, profile);
      },
    ),
  );

  authenticator.use(
    new FacebookStrategy(
      {
        clientID: config.facebook.id,
        clientSecret: config.facebook.secret,
        callbackURL: `${config.webAppUrl}/api/auth/facebook/callback`,
        profileFields: ["id", "displayName", "emails", "photos"],
      },
      (_accessToken, _refreshToken, profile, done) => {
        done(null, profile);
      },
    ),
  );

  return authenticator;
}
