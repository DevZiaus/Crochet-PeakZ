# Review, feat/customer-auth, 2026-11-03

**Reviewed by**: big-pickle (fresh reviewer; author on deepseek-v4.1-flash-1017-basic)
**Scope**: 15 files in the fix round (branch `feat/customer-auth` vs `fe553dfe5801e69255e9f6d6de24a5a90be63b2a`, including uncommitted and staged work). Vendored `.agents/skills/**` and `skills-lock.json` were treated as install noise and not reviewed as application code.
**Verdict**: Changes requested

## Summary

This is a third look at customer auth, focused on the fix round after the 2026-11-03 pre-merge review. The admin guard is now correct: it refreshes once with the refresh cookie, relays the rotated pair to the browser, writes the new access token into the request headers for the same server render, and relays the clearing pair when the refresh is dead. The earlier X-Forwarded-For finding is closed from both ends (last-hop selection plus a loopback-only Compose bind), the query string is preserved and tested, and the new shared cookie module removes the duplicated parsing. Typecheck, lint, and the web/API unit tests all pass.

One new Major remains in the refresh path. The guard's server-to-server refresh does not forward the client address, so every proxy-initiated refresh is keyed on the API's single `"unknown"` rate-limit bucket. Any anonymous caller can keep that bucket saturated with `GET /admin` plus a dummy `cp_refresh` cookie, and legitimate admins then get bounced to the sign-in screen when their access cookie expires, which is the exact symptom this round set out to remove.

## Previous review findings

- 🟠 Admin guard ignored the refresh cookie, `apps/web/src/proxy.ts:79` — **fixed**. `guardAdminPath` now calls `/auth/me`, refreshes once with the long-lived cookie, retries `/auth/me`, and returns the rotated `Set-Cookie` values (`proxy.ts:79-107`). The continued response rewrites the request `cookie` header so the layout reads the new access token in the same render (`proxy.ts:211-224`). `proxy.test.ts:174-233` covers the refresh-alone, expired-access, dead-refresh, and customer paths. Residual test gaps are recorded as Minor below.
- 🟡 Proxy trusted a client-supplied `X-Forwarded-For` while Compose published port 3000 on all interfaces, `apps/web/src/app/api/auth/[...path]/route.ts:80` — **fixed**. `readClientIp` now takes the last hop (`route.ts:237-246`), `docker-compose.yml:73` binds the published web port to `127.0.0.1`, and `docs/deployment.md:68-71` documents why. Tests cover the multi-hop and `X-Real-IP` fallback cases (`route.test.ts:176-201`). Caddy talks to `web:3000` over the Compose network, so the loopback bind does not break the proxy profile.
- ⚪ Admin redirect dropped the query string, `apps/web/src/proxy.ts:57` — **fixed**. `nextPath` is now pathname plus search (`proxy.ts:67`) and `proxy.test.ts:152-158` asserts `/login?next=%2Fadmin%2Fproducts%3Fpage%3D2`.
- ⚪ `auth-fakes.test.ts` was untracked — **fixed**. Both it and `cookies.ts` are staged.
- ⚪ `nextStep.txt` is a tracked scratch note — **not fixed**. It is still modified, now to a single line, `/check verfy customer auth` (also misspelt).

## Major

### 🟠 Proxy-initiated refresh has no client IP, so all admin refreshes share one poisonable rate-limit bucket, `apps/web/src/proxy.ts:157-166`

**Problem**: `refreshAccessCookie` POSTs to `/auth/refresh` with only `cookie`, `x-proxy-secret`, and `origin`. It does not forward `x-forwarded-for` (the `/api/auth` route does, `route.ts:173-174`). The API's refresh route is throttled at 60/min and keyed on `getClientIp(req) ?? "unknown"` (`apps/api/src/presentation/auth/rate-limit.ts:34`; `getClientIp` reads `x-forwarded-for` and returns null when absent, `proxy-guard.ts:59-64`). With no header, every refresh the guard initiates lands in the single `"unknown"` bucket. The guard is reachable without a valid session: send `GET /admin` with `Cookie: cp_access=x; cp_refresh=dead` and each request makes `/auth/me` fail (unthrottled) and then spends one `/auth/refresh` token keyed `"unknown"`. Sixty requests a minute from one anonymous client saturate the bucket.

**Why it matters**: Once saturated, a real admin whose 15 minute access cookie expires gets 429 from the refresh, `refreshAccessCookie` returns no usable cookie, `guardAdminPath` treats that as "no answer", and the admin is redirected to `/login?next=…` (`proxy.ts:96-98`) — the AC-5 silent refresh fails exactly when the guard is supposed to provide it. The admin self-heals through the login page's client refresh (which goes through the per-IP `/api/auth` bucket), so this is an availability and fix-integrity regression, not a token compromise or an account lockout. The API also cannot attribute guard refreshes to an address for logs or limits.

**Suggested fix**: Forward the client address on the guard's refresh the same way the auth route does. Extract the last-hop `readClientIp` out of `route.ts` into a small shared helper, pass the incoming request headers into `refreshAccessCookie`, and set `x-forwarded-for` on the refresh (and on `/auth/me` for consistency). Add a `proxy.test.ts` assertion that the refresh request carries `origin`, `x-proxy-secret`, and the forwarded address.

## Minor

### 🟡 The new refresh tests would pass if the request lost the headers the real API validates, `apps/web/src/proxy.test.ts:174-206`

**Problem**: The mock's `/auth/refresh` branch (`proxy.test.ts:41-76`) ignores request headers, so the guard tests stay green even if `origin` or `x-proxy-secret` were removed — the real API answers 403 without them (`proxy-guard.ts`). The tests also never assert `x-middleware-request-cookie` on the continued response, which is the only mechanism that puts the refreshed access token in front of the server render (`proxy.ts:214-217`). A regression there would silently send the layout back to the old expired cookie and re-open the previous Major, with every unit test still passing. No e2e covers "delete `cp_access`, reload `/admin`, dashboard renders" (`verify.md` U9 is a manual check).

**Why it matters**: This is the same failure mode the prior review called out — a test that pins a mock shape rather than the contract. The browser half is asserted; the render half and the API-validated headers are not.

**Suggested fix**: Assert the refresh call's `origin`, `x-proxy-secret`, and cookie headers, and assert the continued response's `x-middleware-request-cookie` contains `cp_access=<new>`. Add one Playwright case that removes the access cookie and reloads `/admin`.

### 🟡 The render sees the new access token but the old, revoked refresh token, `apps/web/src/proxy.ts:172-179`

**Problem**: `writeCookie` rewrites only `cp_access` in the cookie header passed to `NextResponse.next({ request: { headers } })`. The rotated `cp_refresh` is relayed to the browser but the request header keeps the token the API just rotated. Today that is harmless because the layout's `getSessionUser` only calls `/auth/me`, which ignores the refresh cookie, but the header is now internally inconsistent: a valid access token next to a revoked refresh token. If a future render-time call ever refreshes with the request cookies, the API would classify it as reuse (outside the 10 second window) and revoke every session for the account. The new comment in `apps/web/src/lib/auth/session.ts:8-11` reinforces the wrong mental model by saying "a 401 here means the refresh cookie is no longer valid either".

**Why it matters**: Latent, but the blast radius is a full account sign-out, and the misleading comment makes it likely someone builds on it.

**Suggested fix**: Replace both cookies in the request header using the values already present in `setCookies` (`readSetCookie(setCookies, REFRESH_COOKIE)`), and reword the `getSessionUser` comment to say the proxy has already refreshed and that a 401 means the access token the layout sent was refused.

## Nits

- ⚪ `docs/specs/0005-customer-auth/verify.md:217` (S11), the verification note still says "the first `X-Forwarded-For` value is used" while the web proxy now takes the last hop; update it so a future verifier tests the current rule.
- ⚪ `nextStep.txt:1`, still a tracked scratch note, now `/check verfy customer auth` (misspelt, and unrelated to the branch); revert it or drop it from the diff.
- ⚪ `docs/deployment.md:68-71`, "leave the published web port closed" reads oddly next to a Compose file that publishes it on loopback; say "do not publish it beyond loopback".
- ⚪ `apps/web/src/proxy.ts:122,157`, the guard makes up to three serial API calls with no timeout; a hung API blocks the admin navigation until the platform timeout. Consider `AbortSignal.timeout` on both fetches.
- ⚪ `apps/web/src/app/api/auth/[...path]/route.ts:237-246`, the last-hop rule assumes exactly one trusted edge; with a CDN appending before Caddy, the last entry is the CDN address and every client collapses into one bucket. Document the single-edge assumption, or make the trusted hop count configurable.

## Strengths

- The guard result is modelled cleanly: rejection, cookies for the browser, and the cookie header for the render are separate fields, and every failure path (`/me` refused, refresh refused, API unreachable, no role in the body) still fails closed to sign-in without rendering admin markup.
- The failed-refresh contract is now symmetric: the API clears both cookies on `INVALID_SESSION` (`auth.routes.ts:147-156`), the auth route relays the clearing pair, and the guard relays it on the redirect; each leg has a test.
- The earlier X-Forwarded-For finding was fixed at both layers instead of only in code (last hop plus loopback publish plus a deployment note), and the new shared `lib/auth/cookies.ts` removes the duplicated parsing between the two proxy surfaces.
- Convention adherence is good: named exports, JSDoc on the new public helpers, typed `GuardResult`/`RoleAnswer`, and the shared schemas still own the wire contracts.

## Test coverage

TEST_SIGNAL = configured. The fix round is well covered at the unit and HTTP layers: the guard's refresh, dead-refresh relay, customer redirect, query-string preservation, and last-hop/`X-Real-IP` forwarding all have tests; the API's refresh-clearing, verify-email and reset-password throttles, and the session fake's `createdAt` all have new assertions; typecheck, lint, and the web/API suites pass.

The remaining gaps are the ones in the two Minors: the guard tests do not assert the headers the real API validates or the request-header rewrite that feeds the render, and no browser test exercises the expired-access admin reload that this round exists to fix. The "200 without a `cp_access` in `Set-Cookie`" fallback in `refreshAccessCookie` is also untested, though the API always sets both cookies.
