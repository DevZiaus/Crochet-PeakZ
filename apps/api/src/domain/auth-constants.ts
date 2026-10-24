/**
 * Auth domain constants.
 *
 * Every lifetime the spec fixes lives here so the entities, use cases, and
 * cookie writers read one value.
 */

/** Access token lifetime: 15 minutes. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** Refresh token lifetime: 30 days, moved forward on every rotation. */
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Window after a rotation in which presenting the old refresh token is treated
 * as a concurrent request from a second tab rather than reuse.
 */
export const ROTATION_GRACE_MS = 10 * 1000;

/** Consecutive failures before an account locks. */
export const MAX_FAILED_LOGINS = 5;

/** Lock duration once the fifth consecutive failure lands. */
export const LOCK_DURATION_MS = 15 * 60 * 1000;

/** How long a verification link stays valid. */
export const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

/** How long a password reset link stays valid. */
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

/** Minimum delay between verification email resends for one account. */
export const RESEND_THROTTLE_MS = 60 * 1000;

/** Access token issuer claim. */
export const ACCESS_TOKEN_ISSUER = "crochet-peakz";

/** Access token audience claim. */
export const ACCESS_TOKEN_AUDIENCE = "crochet-peakz-web";

/** Name of the access token cookie. */
export const ACCESS_COOKIE_NAME = "cp_access";

/** Name of the refresh token cookie. */
export const REFRESH_COOKIE_NAME = "cp_refresh";

/** Name of the OAuth state cookie, scoped to `/api/auth`. */
export const OAUTH_STATE_COOKIE_NAME = "cp_oauth_state";

/** Path the OAuth state cookie is scoped to. */
export const OAUTH_STATE_COOKIE_PATH = "/api/auth";

/** OAuth state lifetime: 10 minutes. */
export const OAUTH_STATE_TTL_SECONDS = 10 * 60;
