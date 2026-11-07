# Review, feat/customer-auth, 2026-11-05

**Reviewed by**: GLM-5.3-Flash Free (fresh-eyes reviewer for `/check review` r11; author on deepseek-v4.1-flash:free, a different model family; several earlier review rounds already applied)
**Scope**: ~230 files, branch vs base (merge base `fe553df`, plus uncommitted tracked changes and untracked files: the `20261105120000_user_token_indexes` migration and five new test files)
**Verdict**: Changes requested

## Summary

This branch implements spec 0005 end to end: email/password registration with verification, rotating JWT/opaque refresh sessions, Google/Facebook OAuth with signed state, password reset with session revocation, per endpoint rate limiting, a Next.js auth proxy and admin guard, and the six auth screens. The architecture is clean (domain entities own the lock/rotation/grace invariants, use cases are thin, presentation maps `AuthError` codes to HTTP), the concurrency handling on refresh rotation and the login-failure counter is unusually careful, and the test coverage (unit, real PostgreSQL integration, mock OAuth round trips, Playwright E2E) is thorough. I found no blocker. The one Major is the identity-trust gap on Facebook (no email-verification signal is checked), which is cheap to close; the rest are Minors around race-safety of the single-use token writes and two smaller hardening gaps.

## Major

### 🟠 Facebook sign in never verifies the email it links on — `apps/api/src/presentation/auth/auth.routes.ts:439` (`toOAuthProfile`) and `apps/api/src/infrastructure/oauth/passport.ts:92` (`profileFields`)

**Problem**: Google's path rejects a profile whose `_json.email_verified` is false, but the Facebook strategy requests only `["id", "displayName", "emails", "photos"]` and `toOAuthProfile` accepts `emails[0]` with no verification signal whatsoever. `signInWithOAuth` then (a) links to an existing **unverified local account** for that email, clears its password, marks it verified, and issues a session, or (b) creates a new verified account — both on the strength of an email the code cannot prove the customer controls.

**Why it matters**: The whole OAuth model rests on the spec invariant "OAuth accounts are resolved by verified email, which is the identity key." The Google branch honours it; the Facebook branch reduces it to "the provider sent an email address." If Facebook ever returns an unconfirmed address (behaviour is version- and app-review dependent, so this is a stated risk rather than a proven defect — flagging it because the stakes are account takeover), anyone who can set a victim's address as their Facebook primary email can take over that customer's unverified local account. severity confidence: high that the check is missing, moderate that the provider actually returns unverified emails.

**Suggested fix**: Request `verified` in `profileFields` and reject an unverified profile for linking exactly like the Google `email_verified === false` case; if the field is no longer dependable in the current Graph API, treat a Facebook-sourced email as unproven unless the address matches an already-verified account (sign in but do not clear the local password on link), and record the residual tradeoff in the spec's Security model or `docs/specs/0005-customer-auth/verify.md`.

## Minor

### 🟡 Single-use token consumption is not race-safe — `apps/api/src/infrastructure/database/user.repository.ts:111` (`saveVerified`) and `:137` (`savePasswordReset`)

**Problem**: `verifyEmail` and `resetPassword` do _find by token hash_ → _check expiry_ → _unconditional update that clears the token columns_ (`apps/api/src/application/use-cases/verify-email.ts:40`, `apps/api/src/application/use-cases/reset-password.ts:41`). Two concurrent requests carrying the same link token both find the row and both complete with 200, because neither write is conditioned on the token still being present. The spec's key invariant "a verification or reset token is cleared on use, so a second attempt is rejected" holds only outside a race window.

**Why it matters**: Practically low impact (a second reset just sets another hash; both revokers already run), but it is a genuine TOCTOU on the one-time-token invariant, unlike the failure counter which was given a compare-and-swap.

**Suggested fix**: Use `updateMany({ where: { id, emailVerificationToken: tokenHash } })`-style conditional writes (or a transaction with a re-read) and map `count === 0` to the invalid-token path, mirroring the CAS pattern already used for `saveFailedLogin`.

### 🟡 Password reset writes are not atomic — `apps/api/src/application/use-cases/reset-password.ts:41-42`

**Problem**: The reset saves the new password hash and then revokes all sessions in two independent writes with no transaction. A failure (or crash between) the two leaves every existing refresh token still active against the new password, weakening AC-9's eviction of an attacker's sessions precisely when the reset was the customer's response to a theft.

**Why it matters**: The revocation is the security payload of the reset; it must not be a step that can silently not happen.

**Suggested fix**: Wrap `savePasswordReset` + `revokeAllForUser` in one Prisma transaction (a `SessionRepository` unit-of-work method keeps the port clean), or at minimum document the failure mode and add a session-audit means of detecting it.

### 🟡 OAuth signed state is not provider-bound — `apps/api/src/presentation/auth/auth.routes.ts:318-338` with `apps/api/src/infrastructure/auth/jwt-token-service.ts:78`

**Problem**: The state JWT carries a nonce and `next` but no provider claim, and the callback compares the query state only against the cookie value, not against a provider binding. A state issued for a Google start also satisfies the Facebook callback (and vice versa) within its 10-minute life.

**Why it matters**: Exploitability is low — the attacker still needs a valid provider round trip with their own code — but state/CSRF binding is the whole point of the value, and binding `provider` (or `iss` per provider) costs one claim. It also makes the `issueFromChain`-style stateless audit reasoning easier later.

**Suggested fix**: Include `provider` in `OAuthStateClaims`, verify it in `handleOAuthCallback`, and encode it into the signed state before it is sent to the provider.

### 🟡 Web auth env is validated lazily per request, not at startup — `apps/web/src/lib/auth/web-env.ts:25`

**Problem**: `getWebAuthEnv()` throws on the first request that needs it; nothing fails the Next.js process at boot. A production deployment missing `PROXY_SHARED_SECRET` or `API_INTERNAL_URL` starts green and then 500s every auth request and admin screen (`proxy.ts` fails closed to redirects to a sign-in page the login form's own POST then 500s against — a confusing failure surface).

**Why it matters**: AC-15 mandates fail-fast startup for the API; the web side of the same security surface deserves the same property, and the current failure mode (per-request caches empty, random 500s) hides the root cause.

**Suggested fix**: Validate eagerly in a server-only module imported by `proxy.ts`/`route.ts` (guarded so the build still succeeds outside a request scope), or surface the missing variable once at boot with a clear message; alternatively log once and cache the failure instead of re-throwing per request.

### 🟡 No test pins the `x-auth-role` trust boundary — `apps/web/src/proxy.ts:234-245`

**Problem**: The proxy correctly `headers.delete("x-auth-role")` before re-setting it from the API-verified guard, and the layout reads only that header (`apps/web/src/app/admin/layout.tsx:82-90`). But neither `proxy.test.ts` nor `admin/layout.test.tsx` contains a case where a **client-supplied** `x-auth-role: ADMIN` header must be ignored. The untracked test additions harden other things (`require-role.test.tsx`, `use-session.test.ts`, `web-env.test.ts`, `cookies.test.ts`) but not this one.

**Why it matters**: The whole admin guard's soundness reduces to this two-line invariant; a refactor of the header assembly (the code even hedges against a stale value with the delete) could silently invert it, and only typecheck would stand in the way.

**Suggested fix**: One proxy test: request `/admin` with `x-auth-role: ADMIN` and no session cookie → expect the sign-in redirect and that the downstream render never sees the header; one layout test: `x-auth-role: ADMIN` arriving without a guard role falls back to the API session read.

## Nits

- ⚪ `apps/api/src/presentation/auth/auth.routes.ts:472-475`, `timingSafeStringEquals` short-circuits on length mismatch, leaking length — irrelevant for two self-generated JWTs, but a fixed-length/filled compare would make the helper's "timing safe" doc literally true.
- ⚪ `apps/api/src/presentation/auth/auth.routes.ts:83-98`, `resendAccountLimit` re-implements the body's email normalization (`trim().toLowerCase()`) instead of reusing a shared normalizer — a silent-drift risk if the Zod schema rules change.
- ⚪ `apps/api/src/presentation/auth/auth.routes.ts:160-167`, the `/refresh` route always emits two `Set-Cookie` clears when the refresh cookie is merely absent from a logged-out request — harmless cookie noise on every dead refresh probe (and the 60/min IP limit encourages stale clients to keep it up).
- ⚪ `apps/api/src/config/env.ts:209-218`, `parseEmailFrom` accepts any string containing `@` (e.g. `foo@`), weaker than the URL/secret validation the same file applies elsewhere.

## Strengths

- The refresh/rotation state machine (`Session.isReuse`/`isWithinRotationGrace` in `apps/api/src/domain/entities/session.ts`, the `rotate()` compare-and-set transaction in `session.repository.ts:52-81`, and the grace-successor-liveness rule in `refresh.ts`) is the most subtle part of the spec and it is implemented exactly, including the "password reset kills the chain even inside the grace window" case the naive design misses — and it is tested for all three revocation origins.
- Timing- and enumeration-consciousness throughout: dummy hash for unknown accounts (`login.ts:78-83`) and equal bcrypt work for OAuth-only and locked accounts, timing-safe proxy secret, generic 401/202/429 bodies everywhere, and links logged only outside production.
- Defense in depth on the proxy: secret + Origin checked at both layers, an allowlist so the catch-all cannot become an open relay with the secret, a streamed body cap, `redirect: "manual"` + `getSetCookie()` relay, and a one-shot refresh/replay that excludes `login`/`refresh` themselves.
- Documentation and operability: compose binds raw ports to loopback with the reason written beside them, Caddyfile/nginx split `/api/auth/*` correctly, `.env.example` files and `docs/deployment.md` were updated, and the E2E fixtures solve the hashed-token problem honestly by writing a known HMAC rather than weakening production code.

## Test coverage

Strong for a slice this size, and the spec's ACs are individually named in test titles so gaps are visible by inspection: unit tests own the entity invariants and use-case branches (`auth.test.ts` covers lock/no-extend, race-retry of the failure counter, grace vs reuse vs sign-out/reset replay, OAuth-link provider-pair rules); `routes.integration.test.ts` runs the real router against real PostgreSQL and asserts cookie attributes, cookie clearing, malformed-body/cookie 4xxs (not 500s), and every rate limit mythical C10-style burst; `oauth.integration.test.ts` drives both strategies through the local mock provider including state tampering; the web side unit-tests the allowlist, refresh/replay, client-IP last-hop rule, admin guard fail-closed, guard components and forms; Playwright covers 13 flows across 2 projects with per-test `X-Forwarded-For` keys so the suite is restart-free.

Untested or under-tested: the `x-auth-role` trust boundary (Minor above); no automated test exercises Caddy/nginx routing (C19 is a manual `docker compose config` check); the same-link double-consume race (Minor above) has no test. Nothing else material: every critical scenario from the spec's Critical test scenarios list maps to at least one named automated test except the manual-only deploy-proxy routing.
