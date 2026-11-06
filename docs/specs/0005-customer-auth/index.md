# 0005. Customer auth

**Date**: 2026-10-25
**Status**: In Progress

## Summary

Crochet PeakZ gets its own customer accounts: email and password sign up with a verification email, sign in that stays valid across reloads, password reset, and Google and Facebook sign in. Sessions are carried by two HttpOnly cookies (a short lived access token and a rotating refresh token), so browser code never touches a token. The web app talks to the API through its own Next.js route handlers, which relay the cookies and keep one origin from the browser's point of view.

## Requirements

**User stories**:

- As a shopper, I want to create an account and verify my email so that my orders and downloads belong to me.
- As a shopper, I want to sign in with my email and password, or with Google or Facebook, so that I can return without retyping credentials.
- As a shopper, I want to stay signed in across page reloads and browser restarts, so that browsing does not feel like a login wall.
- As a shopper who forgot a password, I want a reset link by email so that I can recover my account myself.
- As an admin, I want admin only pages to reject customers and anonymous visitors so that shop operations stay private.
- As the store owner, I want every auth endpoint throttled and every token revocable so that one leaked credential cannot take over the shop.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):

- **AC-1**: `POST /api/auth/register` with name, email, and a password of 8 to 72 bytes creates a CUSTOMER account, stores the email trimmed and lowercased, stores only a bcrypt hash of the password, returns 201 with the `AuthUser` fields (no token), and sends a verification email containing a link to the web app. A second registration for the same email returns 409, and a password above 72 bytes returns 422.
- **AC-2**: A sign in attempt with correct credentials on an unverified account returns 403 with code `EMAIL_UNVERIFIED` and a message asking the customer to verify, offers a resend, issues no cookies, and does not increment the failure counter.
- **AC-3**: A verification link works once and for 24 hours. Opening it renders a page that verifies only when the customer confirms with an explicit action; no GET consumes the token. Success shows a confirmed page with a sign in link. An expired link shows a readable message, returns the account email so the resend form is prefilled, and offers a resend. Resend always answers 202, is throttled to one request per account per 60 seconds, and issues a new link that invalidates the previous one.
- **AC-4**: A sign in with correct credentials on a verified account sets both cookies and returns the `AuthUser` with the role. A wrong password and an unknown email both return the same 401 message. After 5 consecutive failures the account is locked for 15 minutes and still answers the same 401; attempts while locked do not extend the lock. A successful sign in resets the failure counter.
- **AC-5**: With valid cookies, `GET /api/auth/me` returns id, name, email, role, avatarUrl, and emailVerified, so the session survives a reload. When the access token has expired, the request is retried once through the refresh endpoint and comes back successful without the customer noticing. Each refresh rotates the refresh token and extends its life to 30 days from that moment.
- **AC-6**: Presenting a refresh token that was already rotated revokes every session for that account and returns 401, requiring a fresh sign in on all devices, except within the 10 second window after that rotation, where a concurrent refresh receives a fresh pair from the same chain instead.
- **AC-7**: Sign out revokes the current refresh row, clears both cookies, and leaves the browser signed out; a protected page opened afterwards redirects to sign in.
- **AC-8**: Sign in with Google and with Facebook resolves an account by verified email. On a first sign in it stores the provider name, provider id, and avatar. It always marks the email verified. It redirects to the web OAuth result page with the provider, the revalidated relative `next`, and a success status; the page then moves the customer to `next` or their role default. On failure the same page receives `provider` and one of `access_denied`, `email_missing`, `email_unverified`, `provider_error`, or `link_failed`, and shows a readable message with Try again and Sign in with email. A profile only resolves or links an account when the provider asserts that the email is verified (Google `email_verified`, Facebook `verified`); an unproven email is refused with `email_unverified` and creates or links nothing. Linking to an existing unverified local account verifies that account and clears its stored password.
- **AC-9**: `POST /api/auth/forgot-password` always answers 202, and only an account with a stored password receives an email. A valid reset link works once, for 1 hour, with the same password rule as registration. A completed reset revokes every session for the account.
- **AC-10**: Admin only endpoints return 401 for anonymous callers and 403 for a signed in CUSTOMER. The admin area in the web app sends a CUSTOMER to the storefront. A user whose role was removed in the database loses admin access on the next admin request even while holding an unexpired access token.
- **AC-11**: A signed out visitor opening a protected page is sent to `/login?next=<path>` and returned to that path after a successful sign in. `next` only accepts a same origin relative path; anything else falls back to the role default destination.
- **AC-12**: Every auth endpoint is throttled: sign in 10 requests per 15 minutes per IP, register 5 per hour per IP, forgot password 3 per 15 minutes per IP, refresh 60 per minute per IP, and resend one per account per 60 seconds. Exceeding a limit returns 429 with a `Retry-After` header.
- **AC-13**: The six auth screens (sign in, register, verification result, forgot password, reset password, OAuth result) follow `apps/web/design.md`, use design tokens only, are keyboard usable with visible focus, label every input, and announce errors to assistive technology. Each route segment sets `robots: { index: false }` and the proxy adds an `X-Robots-Tag` header, so none of them appear in search results.
- **AC-14**: The API accepts auth requests only when they carry the proxy shared secret header. A direct call without it gets 401. State changing requests through the proxy are rejected when the `Origin` header does not match the configured web app origin.
- **AC-15**: Environment validation fails at startup when any variable this feature requires is missing or malformed, naming the variable, and the API refuses to start with a default or placeholder secret.

## Decision

**Chosen option**: Option 1: Self hosted JWT sessions behind a Next.js proxy

Build auth inside this repo with the stack spec 0001 already recorded: an Express auth module in Clean Architecture layers, `jose` for access tokens, opaque rotating refresh tokens hashed in the `RefreshToken` table, Passport.js strategies for Google and Facebook, bcryptjs for passwords, and Resend for the two auth emails. The browser sees only the web origin: Next.js route handlers under `/api/auth` forward to the API with a shared secret header, relay `Set-Cookie`, and refresh and replay once after a 401. Both tokens live in HttpOnly, `SameSite=Lax`, `Secure` in production cookies.

**Implementation skills**: `auth-implementation-patterns` (`wshobson/agents`, `.agents/skills/auth-implementation-patterns/`) · `nextjs-app-router` (`giuseppe-trisciuoglio/developer-kit`, `.agents/skills/nextjs-app-router/`) · `resend` (`resend/resend-skills`, `.agents/skills/resend/`) · `email-best-practices` (`resend/resend-skills`, `.agents/skills/email-best-practices/`)

## Feature design

**Data model sketch**:

Two tables, both already in spec 0002. `User` gains auth columns and `RefreshToken` gains rotation and revocation columns.

`User` (added or changed columns marked **new** / **changed**)

| Field                      | Type                       | Rules                                                        |
| -------------------------- | -------------------------- | ------------------------------------------------------------ |
| id                         | UUID v7                    | PK                                                           |
| name                       | String(255)                | required                                                     |
| email                      | String(255)                | required, unique, stored trimmed and lowercase               |
| passwordHash               | String(255)                | nullable; null for OAuth only accounts, bcrypt cost 12       |
| phone                      | String(50)                 | nullable                                                     |
| role                       | UserRole                   | CUSTOMER by default                                          |
| authProvider               | **AuthProvider enum, new** | LOCAL, GOOGLE, FACEBOOK; default LOCAL                       |
| providerId                 | String(255)                | nullable, the provider's stable user id, indexed, not unique |
| avatarUrl                  | String                     | nullable, filled from the provider on first OAuth sign in    |
| emailVerified              | Boolean                    | default false                                                |
| emailVerificationToken     | String(255)                | nullable, HMAC-SHA256 hash of the link token                 |
| emailVerificationExpiresAt | **DateTime, new**          | nullable, issued at now + 24 hours                           |
| emailVerificationSentAt    | **DateTime, new**          | nullable, set on every issue; the 60 second resend throttle  |
| passwordResetToken         | **String(255), new**       | nullable, HMAC-SHA256 hash                                   |
| passwordResetExpiresAt     | **DateTime, new**          | nullable, now + 1 hour                                       |
| failedLoginAttempts        | **Int, new**               | default 0                                                    |
| lockedUntil                | **DateTime, new**          | nullable, now + 15 minutes after the 5th consecutive failure |
| lastLoginAt                | **DateTime, new**          | nullable                                                     |
| createdAt / updatedAt      | DateTime                   | unchanged                                                    |

`RefreshToken` (session rows, one per signed in device)

| Field             | Type                | Rules                                                          |
| ----------------- | ------------------- | -------------------------------------------------------------- |
| id                | UUID v7             | PK                                                             |
| userId            | UUID                | FK to User, cascade delete, indexed                            |
| tokenHash         | String(255)         | unique, HMAC-SHA256 of the opaque refresh token                |
| expiresAt         | DateTime            | now + 30 days, moved forward on every rotation                 |
| deviceInfo        | String(255)         | nullable, from the User Agent header, copied on rotation       |
| ipAddress         | **String(45), new** | nullable, client IP forwarded by the proxy, copied on rotation |
| revokedAt         | **DateTime, new**   | nullable, set on sign out, rotation, reuse, or reset           |
| replacedByTokenId | **UUID, new**       | nullable, self FK, SET NULL on delete                          |
| createdAt         | DateTime            | unchanged                                                      |

**State transitions**:

- Email verification: `unverified` → `verified` (link click, or a provider proves the inbox). Clearing a password on link also moves `unverified` → `verified`.
- Session: `active` → `rotated` (a refresh succeeds; the old row gets `revokedAt` and `replacedByTokenId`), `active` → `revoked` (sign out, password reset, or reuse detection). Presenting a rotated row again counts as reuse after the 10 second window and revokes every active row for that user; inside the window it issues a fresh pair from the same chain instead.
- Account lock: `unlocked` → `locked` at the 5th consecutive failure, `locked` → `unlocked` when `lockedUntil` passes or a sign in succeeds.

**API surface** (all under `/api/auth`, called through the web proxy):

| Endpoint               | Method | Key inputs                            | Key outputs                                                    | Auth                 | Key errors                                              |
| ---------------------- | ------ | ------------------------------------- | -------------------------------------------------------------- | -------------------- | ------------------------------------------------------- |
| `/register`            | POST   | name, email, password (8 to 72 bytes) | 201 `AuthUser`                                                 | public, proxy secret | 409 email taken, 422 invalid, 429 throttled             |
| `/verify-email`        | POST   | token                                 | 200 `AuthUser`                                                 | public, valid token  | 400 invalid or used, 410 expired plus the account email |
| `/resend-verification` | POST   | email                                 | 202 generic message, no email for unknown or verified accounts | public, throttled    | 429 throttled                                           |
| `/login`               | POST   | email, password                       | 200 `AuthUser`, both cookies                                   | public, throttled    | 401 generic, 403 with code `EMAIL_UNVERIFIED`, 429      |
| `/refresh`             | POST   | refresh cookie                        | 200, rotated cookies                                           | refresh cookie       | 401 missing, expired, revoked, or reused                |
| `/logout`              | POST   | refresh cookie                        | 204, cookies cleared                                           | any                  | 204 even with no session                                |
| `/me`                  | GET    | nothing                               | 200 `AuthUser`                                                 | valid access token   | 401                                                     |
| `/forgot-password`     | POST   | email                                 | 202 generic message, no email for OAuth only accounts          | public, throttled    | 429 throttled                                           |
| `/reset-password`      | POST   | token, password (8 to 72 bytes)       | 200 message                                                    | public, valid token  | 400 invalid or used, 410 expired, 422 invalid           |
| `/google`              | GET    | nothing (optional `next`)             | 302 to Google, signed state cookie                             | public               | 302 to the result page with an error code               |
| `/google/callback`     | GET    | provider code and state               | 302 to the result page, cookies                                | public, valid state  | 302 to the result page with an error code               |
| `/facebook`            | GET    | nothing (optional `next`)             | 302 to Facebook, signed state cookie                           | public               | 302 to the result page with an error code               |
| `/facebook/callback`   | GET    | provider code and state               | 302 to the result page, cookies                                | public, valid state  | 302 to the result page with an error code               |

Every successful user bearing response returns the same `AuthUser` DTO: id, name, email, role, avatarUrl, emailVerified. Nulls are `null`, never omitted, so the web type never drifts. A 403 on sign in carries the code `EMAIL_UNVERIFIED` and the email just tried, and does not increment the failure counter. Password input is rejected above 72 bytes because bcryptjs silently truncates there.

Proxy contract (web origin, `apps/web/src/app/api/auth/[...path]/route.ts`): forwards method, body, cookie header, and `x-proxy-secret`; overwrites `x-forwarded-for` with the socket peer address; synthesizes `Origin: WEB_APP_URL` when it makes a write on its own behalf from the server; fetches with `redirect: "manual"` and `cache: "no-store"`; relays `Location` and every `Set-Cookie` from `headers.getSetCookie()`; rejects a state changing request whose `Origin` does not equal `WEB_APP_URL`; on a 401 from a request that carried an access cookie, calls the API refresh endpoint once and replays the original request once. Clearing a cookie uses the identical `Path` and no `Domain`, or the browser keeps it. The API rejects any non GET or HEAD request whose Origin is missing or mismatched, even after the shared secret check.

The OAuth start and callback URLs point at the web origin, so the provider round trip returns through the proxy and the cookies are set on the web host.

OAuth state: the API issues a signed, 10 minute `state` value that carries a nonce, the provider, and the relative `next`, stores it in an HttpOnly cookie scoped to `/api/auth`, and verifies both on callback (a state minted for one provider is rejected by the other). This gives CSRF protection for the redirect without adding session middleware. The result URL carries `provider`, the relative `next`, and on failure one of `access_denied`, `email_missing`, `email_unverified`, `provider_error`, or `link_failed`; on success the page uses `next` to replace its route.

**Value sourcing**:

| Action                  | Value produced / displayed                  | Source                                                                                                                                 |
| ----------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| register                | normalized email                            | `trim()` then `toLowerCase()` in the input schema, stored in `User.email`                                                              |
| register, resend        | verification link URL                       | `WEB_APP_URL` + `/verify-email?token=` + raw token                                                                                     |
| register, resend, reset | raw token                                   | `crypto.randomBytes(32)` base64url, generated per issue                                                                                |
| register, resend, reset | stored token value                          | HMAC-SHA256 of the raw token, in the matching User column                                                                              |
| register, resend        | link lifetime                               | `User.emailVerificationExpiresAt`, 24 hours from issue                                                                                 |
| register, resend        | 60 second throttle                          | `User.emailVerificationSentAt` compared to now                                                                                         |
| forgot password, reset  | reset link lifetime                         | `User.passwordResetExpiresAt`, 1 hour from issue                                                                                       |
| expired verify link     | account email for the resend form           | `User.email` resolved by the stored token hash                                                                                         |
| login                   | locked or not                               | `User.lockedUntil` compared to now; 15 minutes after the 5th failure                                                                   |
| login                   | device string                               | `User-Agent` request header, truncated to 255                                                                                          |
| login, refresh          | client IP                                   | proxy overwrites `x-forwarded-for` with the socket peer; the API takes the first value only after the secret matches                   |
| login                   | session lifetime                            | now + 30 days, written to `RefreshToken.expiresAt`                                                                                     |
| login, OAuth success    | last sign in                                | `User.lastLoginAt`, set to now                                                                                                         |
| login, refresh, /me     | role, name, email, avatarUrl, emailVerified | `User` columns read at request time                                                                                                    |
| login, refresh, /me     | access token claims                         | `sub` = User.id, `role` = User.role, plus `iss`, `aud`, `iat`, `exp`                                                                   |
| refresh                 | successor device trail                      | `deviceInfo` and `ipAddress` copied from the rotated row                                                                               |
| reset                   | cleared account state                       | `failedLoginAttempts` = 0, `lockedUntil` = null, both reset columns null                                                               |
| OAuth callback          | name, avatar, provider id                   | provider profile fields on first sign in                                                                                               |
| OAuth callback          | email verified                              | only when the provider asserts it (Google `email_verified`, Facebook `verified`); an unproven email is refused with `email_unverified` |
| OAuth callback          | redirect destination                        | signed `state` value, which carries the relative `next` from the entry request                                                         |
| OAuth redirect target   | result page URL                             | `WEB_APP_URL` + `/auth/callback` with `status` or `error`, `provider`, and `next`                                                      |
| OAuth strategy          | `state` value                               | nonce plus relative `next` and provider, HMAC signed with `JWT_SECRET`, 10 minute life                                                 |
| sign in redirect        | destination after sign in                   | `next` query param (relative only), else `/admin` for ADMIN and `/` for CUSTOMER                                                       |
| every user response     | `AuthUser` fields                           | `id`, `name`, `email`, `role`, `avatarUrl`, `emailVerified` from `User`                                                                |
| auth screens            | noindex                                     | `robots: { index: false }` in each of the six route segments plus an `X-Robots-Tag` response header                                    |
| auth emails             | sender address                              | `EMAIL_FROM`                                                                                                                           |
| proxy                   | shared secret value                         | `PROXY_SHARED_SECRET`, compared with a timing safe check                                                                               |
| API OAuth strategies    | callback URLs                               | `WEB_APP_URL` + `/api/auth/<provider>/callback`                                                                                        |

**Key invariants**:

- No raw token is ever stored. Cookies carry raw values; the database holds HMAC-SHA256 hashes only. The full verification or reset link (which contains a raw token) is logged only outside production, as a local fallback, and never in production.
- No admin endpoint exists that grants ADMIN. Only the seed creates the first admin.
- One account per email, compared in lowercase. Email is the identity key across local and OAuth sign in.
- `authProvider` records how the account was first created and is never rewritten on link. The password reset rule keys on `passwordHash` being present, never on `authProvider`.
- A refresh token is single use. Every successful refresh marks the old row revoked and links the new one, copying `deviceInfo` and `ipAddress` forward.
- Reuse means presenting a token whose row is revoked and has a successor, more than 10 seconds after that rotation. Inside the 10 second window the API issues a fresh pair from the same chain instead, so two tabs cannot sign the customer out everywhere. Outside it, every session for the account is revoked.
- `lastLoginAt` moves only on a successful sign in or OAuth callback, never on a refresh.
- A password is between 8 and 72 bytes. Above 72 bytes the input is rejected instead of silently truncated by bcryptjs.
- No GET request consumes a verification or reset token. The email link renders a page, and consumption is an explicit POST from that page.
- `JWT_SECRET` and `JWT_REFRESH_SECRET` are required, distinct, and at least 32 characters. Startup fails otherwise.
- Password comparison uses bcrypt's constant time compare; the proxy secret comparison is timing safe.
- The API never sets a `Domain` attribute on a cookie, so the browser binds it to the web origin.
- Access token life is 15 minutes. Refresh life is 30 days and slides on each use.
- A verification or reset token is cleared on use, so a second attempt is rejected.
- While an account is locked, further failures do not extend the lock, so the lock is a fixed 15 minutes rather than a lever an attacker can hold forever. A successful password reset clears the lock.
- Everything the browser reads about the session comes from `/me`, never from a decoded token.
- Cookies are named `cp_access` and `cp_refresh`, both HttpOnly, `SameSite=Lax`, `Path=/`, and `Secure` in production. The OAuth state cookie is HttpOnly and scoped to `/api/auth`.
- Access tokens carry `iss` = `crochet-peakz` and `aud` = `crochet-peakz-web`, and a token with any other value is rejected.
- A password reset email is only sent to an account that has a stored password. An OAuth only account still gets the generic 202 and signs in with its provider.
- A failed verification email send does not roll back the account. The error is logged and the customer can resend.
- OAuth accounts are resolved by verified email, which is the identity key. `providerId` is stored for support and debugging and is never the lookup key. The provider must assert the email is verified before the API resolves or links an account: Google sends `email_verified`, Facebook sends `verified`, and an unproven email is refused rather than trusted.

**Security model**:

- Public: register, verify, resend, login, forgot, reset, the two OAuth entry points and callbacks, and refresh (guarded by the refresh cookie itself).
- Authenticated: `/me`, sign out (a session, when present).
- Admin: no auth endpoint is admin only in this slice. The guard helper built here (`requireAuth`, `requireAdmin`) is what later admin endpoints use; `requireAdmin` rechecks the role in the database on every call.
- Sensitive data: email, name, avatar, password hash, session rows. Passwords are bcrypt hashed with cost 12; tokens are hashed with HMAC-SHA256; the shared secret is held only in environment variables.
- No card data is handled here, so PCI DSS scope is unchanged. Auth cookies are strictly necessary and do not wait for the cookie consent feature.
- Compliance scope: household names and email addresses (personal data). No new consent flow; account deletion and export belong to the customer dashboard feature.

**Configuration required**:

- `WEB_APP_URL`: web origin used inside verification and reset links, OAuth start and callback URLs, OAuth result redirects, and the proxy Origin check.
- `PROXY_SHARED_SECRET`: shared secret the web proxy sends and the API requires on auth requests.
- `JWT_SECRET`, `JWT_REFRESH_SECRET`: access and refresh signing secrets, at least 32 characters, distinct. `JWT_SECRET` also signs the OAuth `state` value.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`: OAuth client credentials.
- `RESEND_API_KEY`, `EMAIL_FROM`: auth email delivery and sender.
- Web: `API_INTERNAL_URL` (server only, where the proxy forwards) and `PROXY_SHARED_SECRET` (same value as the API).

**Critical test scenarios** (each maps to an acceptance criterion in ## Requirements):

- Happy path: register, follow the verification link, sign in, reload, and get the same user from `/me`, verifies **AC-1**, **AC-3**, **AC-5**.
- Happy path: sign in with Google for a new email creates one account, marks it verified, and lands on the result page, verifies **AC-8**.
- Failure case: an expired access token followed by a refresh rotates the row and still serves the original request, verifies **AC-5**.
- Failure case: presenting a rotated refresh token revokes every session for that account, verifies **AC-6**.
- Failure case: five wrong passwords lock the account for 15 minutes with the same generic message, verifies **AC-4**.
- Failure case: a used or expired verification link returns a readable error and a working resend, verifies **AC-3**.
- Failure case: sign in with a correct password on an unverified account returns 403 and sets no cookie, verifies **AC-2**.
- Auth/permission: a CUSTOMER calling an admin endpoint gets 403, an anonymous caller gets 401, and a demoted admin loses access on the next call, verifies **AC-10**.
- Auth/permission: a request straight to the API without the proxy secret gets 401, and a proxy write with a foreign Origin is rejected, verifies **AC-14**.
- Auth/permission: `/login?next=https://evil.example` sends the customer to their role default instead, verifies **AC-11**.
- Throttling: the 11th sign in attempt within 15 minutes returns 429 with `Retry-After`, verifies **AC-12**.
- Reset: a completed password reset revokes open sessions and the old password stops working, verifies **AC-9**.

## Build plan

Tracer Bullet: the first milestone is a thin but real thread from a sign in form in the browser, through the proxy and the API, to a cookie and back from `/me`. Every later milestone thickens that same thread with verification, reset, OAuth, and guards. The data model is one migration in the first milestone; every later milestone adds behaviour, not schema. Tasks are ordered so each milestone leaves a working app.

1. Add the one migration for the confirmed model: `AuthProvider` enum, the new `User` columns (including `emailVerificationSentAt`), and the new `RefreshToken` columns, plus the `providerId` index, satisfies **AC-1**, **AC-5**, **AC-6**.
2. Add the shared Zod schemas and the single `AuthUser` DTO in `packages/shared` (register, login, reset, token, password bytes bound, and public user), re-exported from the barrel, satisfies **AC-1**, **AC-4**, **AC-9**.
3. Add the env variables to `apps/api/src/config/env.ts` with fail fast checks, including the 32 character secret rule and a distinct secret rule, satisfies **AC-15**.
4. Build the domain layer: `User` and `Session` entities with the verification, lock, and rotation invariants, plus `PasswordHasher` and `TokenService` interfaces with no framework imports, satisfies **AC-1**, **AC-4**, **AC-6**.
5. Build the application use cases: register, verify email, resend, login, refresh, logout, me, forgot, reset, satisfies **AC-1** through **AC-7**, **AC-9**.
6. Build the infrastructure adapters: Prisma user and session repositories, bcrypt hasher, `jose` access token signer, HMAC-SHA256 token hasher, Resend email sender with a console fallback in development, satisfies **AC-1**, **AC-5**.
7. Build the presentation layer: auth controller, router, `requireAuth` and `requireAdmin` middleware, cookie writer, proxy secret and trusted client IP middleware, and per route throttling, satisfies **AC-4**, **AC-7**, **AC-10**, **AC-12**, **AC-14**.
8. Build the web proxy route handler and the server side session helper, including the Origin check, the forwarded client IP, manual redirects, `Set-Cookie` relay and clearing, and the one time refresh and replay, satisfies **AC-5**, **AC-14**.
9. Build the sign in and register screens, the header avatar menu with sign out, and the protected layout guard with `next` handling, satisfies **AC-4**, **AC-7**, **AC-11**, **AC-13**.
10. Build verification: emails, the verify result screen with resend, and the unverified sign in message, satisfies **AC-2**, **AC-3**, **AC-13**.
11. Build password reset: the request screen, the reset screen, the email, and session revocation, satisfies **AC-9**, **AC-13**.
12. Add Google and Facebook strategies with the signed state cookie, the OAuth entry and callback routes on the web origin, then the OAuth result screen that reads provider, status, error, and next, satisfies **AC-8**, **AC-13**.
13. Finish the admin guard in the web app, then run the accessibility pass over all six screens and add noindex at both the route and proxy level, satisfies **AC-10**, **AC-13**.
14. Wire the existing scripts: typecheck, lint, and tests for the domain and application layers, plus an integration test against a real database for the session, rotation, grace window, and lock rules, satisfies **AC-1** through **AC-12**.

## Consequences

**Positive**:

- One account model covers password and both OAuth providers, and the email is the identity key, so no duplicate customers.
- Tokens never reach JavaScript, and a stolen refresh token is detected and neutralised on reuse.
- The proxy keeps the browser on one origin, so cookies work the same in development, Docker, and managed hosts.
- The auth module sits behind interfaces, so a hosted provider can replace the internals later without touching the presentation layer.

**Negative / tradeoffs**:

- Every auth call takes an extra hop through Next.js, and the proxy is now part of the security surface.
- In memory throttling resets on deploy and is per instance; a horizontally scaled API needs a shared limiter later.
- OAuth sign in depends on the provider apps being configured and published, which is outside this repo.
- Two signing secrets plus a proxy secret must be kept in sync between the two workspaces, a classic source of local setup pain.
- A hard 15 minute access token means a revoked role still has the token, but admin endpoints recheck the database, so the window only affects non admin reads.
- Account lockout can be triggered against a known email by an attacker. The lock is fixed at 15 minutes, is never extended while locked, and clears on a password reset, but a determined attacker can still cost a customer 15 minute windows.
- The 10 second concurrent refresh window slightly widens the gap between a stolen token and its detection, as the price of not signing customers out for opening a second tab.
- Passwords are capped at 72 bytes because of bcrypt, which rules out very long passphrase style passwords.

**Neutral**:

- The `authProvider` column changes type from String to an enum, which is a data migration over seeded rows.
- Two email templates now exist, and the transactional email feature will replace their internals later.
- Later slices should reuse the proxy route pattern rather than adding a second way to reach the API.

## Follow-up

- [x] Document the new environment variables and the OAuth callback URLs in `docs/deployment.md` and both `.env.example` files (2026-10-27).
- [ ] Facebook requires the app to be live and, for email access, app review with a privacy policy URL. Google needs a published consent screen. This is an outside prerequisite before OAuth works for real customers.
- [ ] Account suspension, admin promotion, and account deletion are deferred; they belong to admin user management and the customer dashboard.
- [ ] Multi factor authentication is not in this slice. Note it before handling high value admin actions.
- [ ] Reuse the proxy handler and session helper for later authenticated slices instead of calling the API directly from the browser.
- [x] Recorded the installed skills (`auth-implementation-patterns`, `resend`, `email-best-practices`) in the root `AGENTS.md` `## Agent skills` section, `nextjs-app-router` in `apps/web/AGENTS.md`, and the Resend MCP server in the root `MCP servers` line (2026-10-25). The server is configured in `opencode.json` and awaits an OAuth sign in through `/mcps`.
- [ ] Consider an auth area `AGENTS.md` (for example `apps/api/src/domain/AGENTS.md`) once auth conventions settle.
- [ ] The transactional email feature (27) should own real templates and a verified sending domain.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
