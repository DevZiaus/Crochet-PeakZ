# Review, feat/customer-auth, 2026-11-04

**Reviewed by**: big-pickle (fresh reviewer; author on deepseek-v4.1-flash-1017-basic)
**Scope**: 139 files, branch vs `fe553df` (135 tracked + 4 new untracked tests; the 49-file uncommitted r6 round was read line by line). Vendored `.agents/skills/**`, `skills-lock.json`, `package-lock.json`, `docs/**`, and the owner's `nextStep.txt` were treated as install/review noise and not reviewed as application code.
**Verdict**: Approve with nits

## Summary

This is the sixth review of the customer auth branch, focused on the r6 hardening round. All four r5 Minors are genuinely fixed: `require-role` now folds the query string into `next` and its test asserts the corrected URL, sign-out failure shows an alert with a retry, the cookie readers are deduplicated, and malformed JSON maps to a 400/413 instead of a 500. The round also adds meaningful defence in depth (per-route and per-email throttles, refresh-on-admin-render, proxy allowlist and timeouts, loopback-bound container ports). The remaining findings are small: the header sign-in link still drops query strings, the new retry control is not keyboard reachable inside the Radix menu, and a few efficiency/ordering gaps remain. No blockers or majors; `npm run typecheck`, `npm run lint`, and all workspace tests pass.

## Minor

### 🟡 Header sign-in link still drops the query string, `apps/web/src/components/auth/auth-menu.tsx:45-46,97`

**Problem**: `next` is built from `usePathname()` only. `usePathname` excludes the search string, so the signed-out header link on a filtered view such as `/shop?category=hats&page=2` points at `/login?next=%2Fshop`, not `/login?next=%2Fshop%3Fcategory%3Dhats%26page%3D2`. This is the same defect r5 fixed in `require-role`, left in the most common sign-in entry point. `auth-menu.test.tsx:90-110` mocks `usePathname` without a query and only asserts path-only hrefs, so the gap is untested.
**Why it matters**: A customer who signs in from the header after filtering a listing lands on the unfiltered page and loses their place, while the same flow through a protected route now preserves it. The two entry points disagree.
**Suggested fix**: Read `useSearchParams()` (or `window.location.search`) and append it to the pathname before sanitizing, reusing the same helper shape as `require-role.tsx:29-37`. Add a test that renders with `?status=open` and asserts `next` carries the encoded query.

### 🟡 "Try again" retry control is not keyboard reachable, `apps/web/src/components/auth/auth-menu.tsx:167-177`

**Problem**: The retry `Button` is rendered as a plain element inside `DropdownMenuContent`. Radix's menu owns focus and roves only across `[role="menuitem"]` children; `Tab` is intercepted to close the menu and return focus to the trigger. The retry button is therefore skipped by arrow keys and `Tab`, so a keyboard-only customer cannot reach or activate the control that the r6 fix added.
**Why it matters**: AGENTS.md sets WCAG 2.1 AA as the UI baseline. The failure path now has a visible recovery action that mouse users can click but keyboard users cannot focus. Reselecting "Sign out" does work, but that is a hidden workaround, not the advertised retry.
**Suggested fix**: Render the retry as a `DropdownMenuItem` with `onSelect`, or move the alert outside the menu content (for example under the trigger) so it participates in the normal tab order. Add a keyboard-oriented test or an explicit note in the menu test that the retry is a menu item.

### 🟡 Sign-out error state survives closing the menu, `apps/web/src/components/auth/auth-menu.tsx:47-49,107`

**Problem**: `signOutFailed` is only cleared at the start of `handleSignOut`. `onOpenChange={setOpen}` does not reset it, so after one failed attempt a customer who closes the menu and reopens it later sees the stale "We could not sign you out" alert again, even though no new attempt has run.
**Why it matters**: The alert describes a past request as if it just happened, which is misleading on a security-sensitive control and makes the menu look broken. It is a small state bug, not a security hole, because `signOut` still keeps the local user on failure.
**Suggested fix**: Clear the flag when the menu closes, for example `onOpenChange={(next) => { setOpen(next); if (!next) setSignOutFailed(false); }}`, and add a test that fails once, closes, reopens, and asserts the alert is gone.

### 🟡 Admin renders fetch `/me` three times, `apps/web/src/proxy.ts:86-97`, `apps/web/src/app/admin/layout.tsx:46`, `apps/web/src/components/auth/require-role.tsx:55`

**Problem**: One admin navigation now performs the role lookup in the request proxy (`fetchRole`), repeats it in the server layout through `getSessionUser()`, and repeats it again from the client through `useSession()`. When the access token is expired the proxy path is even longer: `/me`, `/refresh`, `/me`, then the layout's `/me`.
**Why it matters**: Every admin page pays two extra API round trips and database reads on a path that has already proven `ADMIN` before the render. It also multiplies load on `/me`, which is the most frequently called auth endpoint, and makes the proxy refresh work partly redundant.
**Suggested fix**: Have `guardAdminPath` pass the verified user id and role to the render as request headers (the proxy already overwrites `x-auth-return-to`), then let the layout trust those headers instead of calling the API again; the client guard can stay as the second layer. If that is too much for this round, wrap `getSessionUser` in React `cache()` so repeated server calls in one render dedupe.

### 🟡 `/me` rate limit is bypassed by invalid tokens, `apps/api/src/presentation/auth/auth.routes.ts:192-205`

**Problem**: `requireAuth` runs before `createRateLimit`. A missing or invalid access cookie is rejected with 401 before the limiter is reached, so the `ip:` branch of the key function is dead code and only authenticated requests are throttled. The limiter was added to bound probing of the endpoint, but the unauthenticated path it was meant to bound is the one that never reaches it.
**Why it matters**: A caller can send unlimited requests with forged or expired tokens. The per-request cost is only a JWT verification, so this is not a blocker, but it defeats the stated purpose of the new limit and leaves a cheap CPU amplification path.
**Suggested fix**: Put the rate limiter before `requireAuth` so it keys by `ip` for anonymous callers and by `user:` once `req.auth` exists. Add an integration test that sends an invalid access cookie repeatedly and asserts a 429.

### 🟡 Auth proxy buffers the whole body with no size cap, `apps/web/src/app/api/auth/[...path]/route.ts:117`

**Problem**: `const body = isWrite ? await request.arrayBuffer() : undefined` reads the entire request body into the web process before the API's `express.json({ limit: "1mb" })` can reject it. There is no `Content-Length` check. The nginx example caps at `client_max_body_size 12m`, but the Caddy example and a bare Node deployment do not, and the auth paths are public.
**Why it matters**: An unauthenticated caller can make the web tier hold an arbitrarily large body per concurrent request, which is a cheap memory-pressure/availability vector. Even with the nginx cap, the web process buffers up to 12 MB for a request the API will reject at 1 MB.
**Suggested fix**: Reject a declared `Content-Length` above the API limit with a 413 before reading, or stream the body through instead of materializing it. Also add a request-body limit to the Caddy example so the documented edge matches nginx.

## Nits

- ⚪ `apps/api/src/presentation/middleware/errorHandler.ts:61-68`, `clientErrorStatus(err)` is called twice for the same value; compute it once and reuse the result.
- ⚪ `apps/web/src/lib/auth/cookies.ts:14-22`, the web `readCookie` does not `decodeURIComponent` while the API helper at `apps/api/src/presentation/auth/auth-middleware.ts:80` does. Today's tokens and state values are URL-safe so this works, but the two readers now have different semantics and the asymmetry is easy to trip over if a cookie value ever needs encoding.
- ⚪ `apps/web/src/components/auth/auth-menu.tsx:54-72`, `handleSignOut` accepts an `Event` only to call `preventDefault`, and the retry fabricates `new Event("sign-out-retry")`. A plain `() => Promise<void>` with `preventDefault` handled in `onSelect` would remove the fake event.

## Strengths

- The r5 fixes are correct and covered: `require-role` builds `next` from pathname plus serialized search and the test asserts the full encoded destination; sign-out failure keeps the user and offers a retry; both route-local cookie readers were replaced by the exported helper; malformed and oversized JSON now return 400/413 without error-log noise.
- The proxy is materially safer: an explicit auth-path allowlist prevents it becoming an open relay for the shared secret, every upstream call has a 5 second timeout and a 502 fallback, and a failed refresh relays the cookie clearing instead of looping.
- Admin rendering is genuinely guarded at the right layer. The proxy refreshes the access cookie and rewrites the request cookie header so the server render sees the new pair, then passes `x-auth-return-to` so the layout's fallback redirect keeps the original path and query.
- Session rotation remains the strongest part of the branch: the successor insert and predecessor claim are one conditional transaction, the grace window requires an active successor, and the race is exercised against real Postgres rather than mocks.
- Test quality is high and behaviour-oriented: sign-out success/failure/retry, query preservation, malformed cookies and JSON, per-email resend throttling, proxy allowlist/timeout/origin, and admin render refresh all assert observable outcomes rather than implementation details.

## Test coverage

Strong overall. `npm run typecheck`, `npm run lint`, and `npm test` pass (API 175, web 196, shared 57). The four new untracked suites (`session.repository.test.ts`, `require-role.test.tsx`, `use-session.test.ts`, `web-env.test.ts`) are real behaviour tests, and the r5 gaps now have regression coverage. The remaining gaps are the findings above: the header sign-in link has no query-string case, the retry control has no keyboard/stale-state test, the `/me` limiter ordering is untested, and the proxy body path has no oversized-body case. None of these leaves a branch or security decision unexercised, so the suite is close to complete for this scope.
