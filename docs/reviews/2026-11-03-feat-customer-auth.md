# Review, feat/customer-auth, 2026-11-03

**Reviewed by**: big-pickle (author on deepseek-v4.1-flash-1017-basic)
**Scope**: 142 files, branch vs base (feat/customer-auth against `fe553dfe5801e69255e9f6d6de24a5a90be63b2a`, plus uncommitted fixes and `apps/api/src/test-support/auth-fakes.test.ts`)
**Verdict**: Changes requested

## Summary

This is a re-review of the customer auth branch after the 2026-11-02 findings. All four earlier findings are fixed: a rejected refresh now clears both cookies, the token endpoints are throttled, the session fake stores its real `createdAt`, and the untyped register local is gone. The core machinery remains solid: HttpOnly/SameSite/Secure cookies, keyed HMAC token hashes, bcrypt cost 12, rotation with a 10 second grace window and reuse revocation, generic credential errors, a timing safe proxy secret with an Origin check, fail-fast environment validation, and a mock OAuth provider that keeps tests off live providers.

The remaining headline problem is in the admin request proxy: a signed-in admin whose 15 minute access cookie has expired is redirected to `/login` despite holding a valid refresh cookie. It self-heals through the login screen's client refresh, so it is not a security hole, but it contradicts AC-5's silent refresh promise on the primary admin surface and the test that covers it asserts the broken behaviour under a misleading name.

## Previous review findings

- 🟠 Failed refresh did not clear cookies — **fixed**. `apps/api/src/presentation/auth/auth.routes.ts:147-156` clears both cookies on any `INVALID_SESSION` from the refresh use case; `routes.integration.test.ts:516-533` now asserts the clearing headers.
- 🟡 `/api/auth/verify-email` and `/api/auth/reset-password` unthrottled — **fixed**. Both now carry `createRateLimit` (`auth.routes.ts:89-97`, `191-201`) with 429/`Retry-After` covered at `routes.integration.test.ts:693-742`.
- 🟡 Session fake seeded `createdAt` from `expiresAt` — **fixed**. `apps/api/src/test-support/auth-fakes.ts:314` uses `session.createdAt`, backed by the new `auth-fakes.test.ts`.
- ⚪ Untyped register local — **fixed**. `apps/api/src/application/use-cases/register.ts:32` declares `let user: User`.

## Major

### 🟠 Admin area sends a valid session to the login screen whenever the access token has expired, `apps/web/src/proxy.ts:79`

**Problem**: `guardAdminPath` calls `/auth/me` with the incoming cookie and, on any non-200 answer, redirects to `/login?next=...` (lines 79-81). The access cookie has a 15 minute Max-Age and is not refreshed by either server-side guard, so after 15 minutes an admin with a live `cp_refresh` cookie gets a 401 and is bounced to `/login`. The same gap exists in `apps/web/src/lib/auth/session.ts:32-34`, which also returns null on 401 instead of refreshing. Recovery only happens because `RequireGuest` on the login page calls `/api/auth/me` through the refresh-and-replay route, which rotates the tokens and sends the admin back. The layout comment at `apps/web/src/app/admin/layout.tsx:32-34` and the test name at `apps/web/src/proxy.test.ts:129` ("so a reload still works") both describe a silent refresh that these guards do not perform; the test actually asserts a 307 to `/login` (line 135).

**Why it matters**: AC-5 requires the request to be retried once through refresh and to return "without the customer noticing". Every admin navigation after 15 minutes performs a full redirect to the sign-in screen, a client refresh round trip, and a redirect back, with a visible "Checking your session…" pause. It also makes the admin surface the one place where the silent-refresh design does not hold, and the misleading test means a future reader will believe it is covered.

**Suggested fix**: In the admin guard, when `/auth/me` answers 401 and the request carried `cp_refresh`, POST to the API refresh endpoint once with the request cookie, retry `/auth/me`, and attach the rotated `Set-Cookie` headers to the continued response (or re-issue the access cookie for the retry). Do the same in `getSessionUser`, or route both through one helper. Rename the test and assert the refresh-then-allow path.

## Minor

### 🟡 The default Compose stack exposes the web port while the proxy trusts a client-supplied `X-Forwarded-For`, `apps/web/src/app/api/auth/[...path]/route.ts:80`

**Problem**: The proxy derives the client address from the incoming `x-forwarded-for` / `x-real-ip` headers and forwards it to the API, which keys every auth rate limit on it. Behind the documented Caddy profile this is safe because Caddy replaces the header (`verify.md` S11), but `docker-compose.yml:69-70` publishes `web:3000` on all interfaces by default, and S11 explicitly says port 3000 must not be exposed directly. In that supported "no edge proxy" mode a non-browser client can send its own `X-Forwarded-For` (and the known `Origin`) to the web proxy and choose its own rate-limit bucket.

**Why it matters**: Per-IP throttling for sign-in, register, forgot-password, verify, and reset can be evaded, weakening AC-12. Account lockout still bounds password guessing per account, which is why this is a minor rather than a blocker, but the documented safe topology and the default Compose topology disagree.

**Suggested fix**: Take the last address in `X-Forwarded-For` (the hop added by the trusted edge) rather than the first, or bind the published web port to `127.0.0.1` in Compose and document that the proxy profile is required when the host is public.

## Nits

- ⚪ `apps/web/src/proxy.ts:57`, the admin redirect keeps only `request.nextUrl.pathname`, so a deep link such as `/admin/products?page=2` loses its query string after sign-in; include the search string.
- ⚪ `apps/api/src/test-support/auth-fakes.test.ts` is untracked; add it so the regression test for the fixed fake actually lands with the branch.
- ⚪ `nextStep.txt` is a tracked scratch note whose body is truncated to one line in this branch; revert it or drop it from the diff.

## Strengths

- The authentication core is well factored and guarded: access and OAuth state tokens are HS256 with issuer/audience checks, opaque tokens are stored as keyed HMAC digests, refresh rotation and reuse detection are entity-level rules with the concurrent-refresh grace window, and the failed-refresh cookie clearing now matches the web proxy's relay contract.
- The test strategy respects isolation and fidelity: unit tests cover the domain and use cases, the routes suite runs over HTTP against PostgreSQL, OAuth is exercised end to end against a local mock provider, email assertions inspect the transport envelope, CI provisions PostgreSQL and runs migrations before the suite, and Playwright covers the browser flows.

## Test coverage

TEST_SIGNAL = configured. Coverage is strong across the domain, application, HTTP, web, and browser layers, and the new `createdAt` fake test plus the refresh-clearing and token-endpoint throttle assertions close the previous gaps.

The remaining gap is the admin session lifecycle: no test exercises a request to `/admin` with an expired access cookie and a valid refresh cookie, and `apps/web/src/proxy.test.ts:129-136` pins the current bounce to `/login` while claiming a reload still works. That is the test that should have caught the Major above.
