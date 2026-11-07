# Review, feat/customer-auth, 2026-11-03

**Reviewed by**: big-pickle (fresh reviewer; author on deepseek-v4.1-flash-1017-basic)
**Scope**: 140 files, branch `feat/customer-auth` vs `fe553dfe5801e69255e9f6d6de24a5a90be63b2a`, including uncommitted and staged work. Vendored `.agents/skills/**`, `skills-lock.json`, `package-lock.json`, and `docs/reviews/**` were treated as install/review noise and not reviewed as application code.
**Verdict**: Changes requested

## Summary

This is the third review of the customer auth branch. The r2 fixes are in place: the admin guard refreshes with the refresh cookie, forwards the client address, rewrites both rotated cookies into the render, and relays the clearing pair on failure; the tests now assert the real API contract, and the new browser test covers the expired-access reload. The core security choices are sound: host-only HttpOnly cookies, keyed token hashes, bcrypt cost 12, generic credentials errors, timing-safe proxy secret, Origin checks at both proxy layers, and a shared redirect sanitizer.

Three Majors remain in the session and email lifecycle. Rotation is not atomic, so concurrent refreshes can fork two live token chains. The 10-second grace window ignores why the successor was revoked, so a reset or sign-out can be outlived by replaying the predecessor. The Resend idempotency key is per recipient rather than per issue, so a resend is rejected as a duplicate after the previous link has already been invalidated. The Minors cover stale OAuth-link tokens, resend account enumeration, unthrottled endpoints, a login timing oracle, missing upstream timeouts, and optimistic sign-out.

## Previous review findings

- 🟠 Admin guard ignored the refresh cookie, `apps/web/src/proxy.ts:79` — **fixed**. `guardAdminPath` refreshes once with the long-lived cookie, retries `/auth/me`, relays the rotated pair, and rewrites the request cookie header for the same render (`proxy.ts:79-113`, `162-202`). The tests cover refresh-alone, expired-access, dead-refresh, customer, and the query-string case (`proxy.test.ts:153-247`).
- 🟡 Proxy trusted a client-supplied `X-Forwarded-For` while Compose published port 3000 on all interfaces, `apps/web/src/app/api/auth/[...path]/route.ts:80` — **fixed**. `readClientIp` takes the last hop (`apps/web/src/lib/auth/client-ip.ts:18-27`), the guard and auth route both forward it (`proxy.ts:84,133,173`; `route.ts:175`), Compose binds web to loopback (`docker-compose.yml:73`), and `docs/deployment.md:68-74` documents the single-edge rule.
- ⚪ Admin redirect dropped the query string, `apps/web/src/proxy.ts:57` — **fixed** (`proxy.ts:71`; `proxy.test.ts:153-158`).
- ⚪ `auth-fakes.test.ts` was untracked — **fixed**. It is staged, as are the new `client-ip.ts` and `cookies.ts`.
- ⚪ The guard tests would pass if the request lost the headers the real API validates, `apps/web/src/proxy.test.ts:174-206` — **fixed**. The tests assert `origin`, `x-proxy-secret`, `cookie`, and `x-forwarded-for` on the refresh, and assert both rotated values in `x-middleware-request-cookie` (`proxy.test.ts:200-221`).
- ⚪ The render saw the new access token beside the old revoked refresh token, `apps/web/src/proxy.ts:172-179` — **fixed**. Both cookies are rewritten into the request header (`proxy.ts:190-196`; `proxy.test.ts:217-219`), and the misleading `getSessionUser` comment was replaced (`apps/web/src/lib/auth/session.ts:8-13`).
- ⚪ `docs/specs/0005-customer-auth/verify.md:217` still said the first `X-Forwarded-For` value is used — **fixed**. S11 now says the last value and documents the single-edge assumption.
- ⚪ The guard made up to three serial API calls with no timeout — **fixed**. Both fetches use `AbortSignal.timeout(5_000)` (`proxy.ts:41,136,177`).
- ⚪ `nextStep.txt` is a tracked scratch note — **not treated as a finding**. It is still modified, but `AGENTS.md` says it is the repository owner's file and must not be changed by agents.

## Major

### 🟠 Concurrent refresh can fork two live token chains because `markRotated` is unconditional, `apps/api/src/infrastructure/database/session.repository.ts:45-56`

**Problem**: `refreshSession` reads the row, creates a successor, then calls `markRotated`, which updates by `id` with no `revokedAt: null` guard and no transaction (`refresh.ts:68-80`). Two requests that both read the same active row before either update both create successors and both return 200. The last update wins the `replacedByTokenId` link; the other successor is a live, unlinked 30-day token. If `create` succeeds and `markRotated` fails, the old token also stays active beside an orphaned successor.

**Why it matters**: A refresh token is supposed to be single use (AC-6). A stolen token raced against the legitimate refresh can leave a chain that never triggers reuse detection, because neither chain ever presents a rotated token again. The race window is narrow, but an attacker can widen it with a burst of concurrent requests, and the consequence is a persistent session that a password reset or "sign out everywhere" response may not revoke.

**Suggested fix**: Make rotation atomic. Add a repository `rotate` operation that, in one transaction, conditionally revokes the old row (`where: { id, revokedAt: null }`) and creates and links the successor only when the update affected exactly one row; when it affects zero, re-read the row and route it through the grace/reuse logic. Add a `Promise.all` test against the real database that presents the same token twice and asserts exactly one active successor.

### 🟠 The 10-second rotation grace can outlive a password reset or sign-out, `apps/api/src/application/use-cases/refresh.ts:50-59`

**Problem**: The grace branch only checks that the presented row was rotated (`revokedAt` and `replacedByTokenId` are set) and that the rotation was at most 10 seconds ago (`apps/api/src/domain/entities/session.ts:113-119`). It never checks that the successor is still active. `revokeAllForUser` only sets `revokedAt` on rows where it is null (`session.repository.ts:67-72`), so a rotated predecessor keeps its `replacedByTokenId` after a reset or reuse revoke, and a logout of the successor leaves the link too. Within 10 seconds of rotation, replaying the predecessor calls `issueFromChain`, which creates a new active row and returns a fresh pair even though the reset or logout just revoked the account's sessions. The comment on `isWithinRotationGrace` says the window never applies to a reset, but the code cannot tell the difference.

**Why it matters**: A completed password reset must revoke every session (AC-9), and sign out must leave the browser signed out (AC-7). A stolen predecessor replayed in the 10-second window after the reset can mint a new 30-day session, defeating the revocation. The window is narrow, but the fix is cheap and the contract is explicit.

**Suggested fix**: In the grace branch, load the successor by `replacedByTokenId` and require it to be active and unexpired before issuing a new pair; or have `revokeAllForUser` clear `replacedByTokenId` on every row for the user so a global revoke removes grace eligibility. Cap grace replays to one per rotation so repeated calls cannot mint an unbounded family, and add a test that rotates, resets, replays the old token at +5s, and expects 401 with zero active rows.

### 🟠 A resend reuses the recipient's idempotency key, so Resend rejects the new link after the old one is invalidated, `apps/api/src/infrastructure/email/auth-email-templates.ts:86`

**Problem**: `composeAuthEmail` builds `idempotencyKey` as `<kind>/<recipient>`, so every send to the same address uses the same key for 24 hours. `resendVerification` and `forgotPassword` overwrite the stored token hash before sending (`resend-verification.ts:45-58`, `forgot-password.ts:25-38`), invalidating the previous link. The new send has a different URL and payload but the same key, so Resend returns `409 invalid_idempotent_request`; the sender throws in production (`resend-email-sender.ts:73-85`), the use cases catch and log, and the route still answers 202. The customer is left with an invalid old link and no new email until the key expires.

**Why it matters**: This breaks AC-3's "issues a new link that invalidates the previous one" and the equivalent reset resend. A customer who loses the first verification or reset email can be locked out for 24 hours, which is the exact recovery path the resend exists for. The test named "scopes the idempotency key to the recipient so a resend is distinct" (`resend-email-sender.test.ts:100-110`) only varies the recipient, so it enshrines the bug.

**Suggested fix**: Make the key unique per issue, for example `<kind>/<recipient>/<hash(url)>` or pass the token hash or an issue id into the composer; keep it stable only for retries of the same issue. Add a test that sends the same recipient twice with different URLs and asserts the keys differ and both sends succeed.

## Minor

### 🟡 OAuth linking leaves the previous verification and reset tokens live, `apps/api/src/infrastructure/database/user.repository.ts:170-190`

**Problem**: `saveOAuthLogin` sets `emailVerified: true` and optionally clears `passwordHash`, but never clears `emailVerificationToken`/`emailVerificationExpiresAt` or `passwordResetToken`/`passwordResetExpiresAt`. A reset link issued before the OAuth link still matches the stored hash after the link.

**Why it matters**: AC-8 says linking to an existing unverified local account verifies it and clears the password. The stale reset link can set a new password on the now-OAuth-only account, re-adding the credential the link was supposed to remove. The verification token is also left live.

**Suggested fix**: Clear both token pairs in the same update when linking/verifying, and add a test that a reset token issued before the OAuth link is rejected afterwards.

### 🟡 The resend 429 is only returned for an existing unverified account, `apps/api/src/application/use-cases/resend-verification.ts:38-42`

**Problem**: `resendVerification` returns 429 only when an existing unverified account is inside the 60-second throttle. Unknown and already verified addresses return 202. Two requests for the same address therefore reveal whether an unverified account exists. The use case doc says "The controller always answers 202" (`:18`), but the route returns 429 (`auth.routes.ts:104-115`).

**Why it matters**: This is account enumeration, which the generic 202 copy is meant to prevent. AC-3 says resend always answers 202, while AC-12 also allows 429 for a throttled resend, so the spec is contradictory; the current behavior picks the leaky side.

**Suggested fix**: Key the resend throttle on the normalized email for every request, so unknown and verified addresses also get 429 on a repeat, or keep 202 and return `Retry-After` without a distinct status. Update the doc comment and settle AC-3/AC-12 on one rule.

### 🟡 `/logout`, `/me`, and the OAuth entry/callback routes are not throttled, `apps/api/src/presentation/auth/auth.routes.ts:160-176,203-206`

**Problem**: The router throttles register, verify-email, resend, login, refresh, forgot, and reset, but `/logout`, `/me`, and both OAuth entry/callback pairs have no limiter. AC-12 opens with "Every auth endpoint is throttled."

**Why it matters**: `/me` is database-backed and authenticated, `/logout` revokes a row, and the OAuth callback performs a provider exchange and database write. The practical exposure is lower than the credential endpoints, but the contract is explicit and the OAuth callback is the most expensive of the unthrottled routes.

**Suggested fix**: Add modest per-IP limits to the OAuth entry/callback and `/me`/`/logout`, or document why they are exempt and amend AC-12 to list only the endpoints that are throttled.

### 🟡 Unknown emails and locked accounts skip bcrypt, `apps/api/src/application/use-cases/login.ts:29-33`

**Problem**: `loginUser` returns before bcrypt for an unknown email (`:29-33`) and for a locked account (`:39-41`), while a known unlocked account spends bcrypt cost 12 (about 250ms) at `:43-45`. The generic 401 body does not hide the timing difference.

**Why it matters**: An attacker can enumerate accounts and lock state from response latency, which is the same information the generic message is meant to hide.

**Suggested fix**: Run a dummy bcrypt verify against a fixed hash on the unknown and locked paths so every failure spends the same work.

### 🟡 The auth proxy and the server session read have no upstream timeout, `apps/web/src/app/api/auth/[...path]/route.ts:86-119`

**Problem**: The auth proxy's two `fetch` calls and the server session read (`apps/web/src/lib/auth/session.ts:27-33`) have no `AbortSignal.timeout`, unlike the admin guard (`proxy.ts:41,136,177`). A hung API holds the web request until the platform kills it.

**Why it matters**: A slow or dead API turns into hung Next requests and connection exhaustion rather than a fast 502. The guard already treats this as a failure mode worth bounding, so the user-facing auth proxy should too.

**Suggested fix**: Add the same 5-second timeout to both surfaces and map a timeout to a 502/503 response; the session read can return null.

### 🟡 Sign out clears the local user even when the logout request fails, `apps/web/src/lib/auth/use-session.ts:61-68`

**Problem**: `signOut` awaits the logout POST but ignores the response and always calls `setUser(null)`. If the request fails (offline, API down, 403), the HttpOnly cookies remain, so a reload signs the user back in while the UI said they were signed out.

**Why it matters**: On a shared device the user may believe the session ended when it did not; server-side revocation and cookie clearing are the point of AC-7.

**Suggested fix**: Only clear the local user after a 2xx/204; otherwise keep the user and surface an error, or retry. Add a test for a failed logout.

## Nits

- ⚪ `apps/api/src/presentation/auth/cookies.ts:40`, the access cookie `maxAge` is hardcoded `15 * 60 * 1000` while the token lifetime comes from `ACCESS_TOKEN_TTL_SECONDS`; derive it so the two cannot drift.
- ⚪ `apps/api/src/domain/entities/session.ts:128-130`, `isReuse` is not called by production code; the use case inlines the same condition, so either use it or remove it.
- ⚪ `apps/api/src/infrastructure/auth/jwt-token-service.ts:76-95`, the OAuth state JWT has no issuer/audience; it is separated from access tokens only by claim shape. Add a distinct issuer/audience (or a separate secret) for defense in depth.
- ⚪ `apps/web/src/app/api/auth/[...path]/route.ts:61-84`, `targetPath` is built from the catch-all params with no allowlist, and the proxy adds the shared secret to whatever path results. No current non-auth route trusts the secret, but an allowlist would keep it that way.
- ⚪ `apps/web/src/app/admin/layout.tsx:10`, the layout fallback hardcodes `next=/admin`, so a layout-only redirect from `/admin/products` loses the subpath; use the request path like the proxy does.
- ⚪ `apps/api/src/presentation/auth/proxy-guard.ts:50-64`, the comment says the proxy overwrites XFF with the socket peer and the API honours the first value; the web proxy now selects the last incoming hop, so the comment describes a different rule.
- ⚪ `deploy/nginx.conf.example:4-5`, the header still says "Route `/api/*` to Express"; the example now routes `/api/auth/` to web, like the Caddyfile.
- ⚪ `apps/web/src/lib/auth/web-env.ts:37-40,52-61`, `WEB_APP_URL` is not normalized to an origin, while the API's `parseWebAppUrl` is; a value with a path or trailing slash makes every `Origin` check fail. Normalize with `new URL(value).origin`.
- ⚪ `docker-compose.yml:46-47`, the API port is still published on all interfaces while the docs say the raw API trusts XFF and must not be exposed; bind it to loopback (the web reaches it over the Compose network) or document why it must stay public.
- ⚪ `apps/api/src/application/use-cases/oauth.ts:42-48` and `apps/api/src/infrastructure/database/user.repository.ts:180-188`, `saveOAuthLogin` overwrites `providerId` with the current provider's id even when `authProvider` stays the original, so the stored pair can disagree; only update `providerId` when the provider matches or when linking.

## Strengths

- The admin guard is now correct end to end: it refreshes with the long-lived cookie, forwards the client address and the proxy secret/origin, rewrites both rotated cookies into the render header, relays the clearing pair on failure, and fails closed on every error. The tests now assert the real API contract rather than the mock shape.
- The security basics are solid: host-only HttpOnly `SameSite=Lax` cookies that are `Secure` in production, keyed HMAC token hashes, bcrypt cost 12, generic 401s, a fixed 15-minute lock, no cookies on unverified login, a timing-safe proxy secret, Origin checks at both proxy layers, and `sanitizeNextPath` blocking protocol-relative, backslash, control-character, and auth-screen redirects.
- The X-Forwarded-For fix was applied at all three layers (last-hop read, loopback Compose bind, deployment note), and the new browser test clears `cp_access` and reloads `/admin`, closing the previous coverage gap.

## Test coverage

TEST_SIGNAL = configured. The web suite (23 files, 180 tests) and API suite (13 files, 153 tests) pass; Playwright was not run in this session. The r2 gaps are closed: the guard tests assert `origin`, `x-proxy-secret`, `x-forwarded-for`, and the rewritten `x-middleware-request-cookie`, and `e2e/auth.spec.ts:600-622` covers the expired-access admin reload. The new API tests cover the verify-email/reset-password 429s and the refresh-cookie clearing.

Remaining gaps: there is no concurrent refresh test (`Promise.all` against the real database), no grace-after-reset test, no test that a second email to the same recipient with a new URL is accepted (the existing idempotency test only varies the recipient), and no failed-logout test.
