# Review, feat/customer-auth, 2026-11-04

**Reviewed by**: big-pickle (fresh reviewer; author on deepseek-v4.1-flash-1017-basic)
**Scope**: 226 files, branch vs `fe553df` (222 tracked + 4 new untracked; the 50-file uncommitted r5 round was read line by line). Vendored `.agents/skills/**`, `skills-lock.json`, `package-lock.json`, and `docs/**` were treated as install/review noise and not reviewed as application code.
**Verdict**: Approve with nits

## Summary

This is the fifth review of the customer auth branch, focused on the five r4 fixes. Four of the five are correct and complete: sign out now returns a result the menu honours, the Resend idempotency key hashes the recipient and link into a bounded key, malformed cookie values decode to an absent cookie, and a different provider keeps the stored provider id including `null`. The `require-role` query-string fix does not work: it copies the page query as siblings of `next`, so the sign-in form (which only reads `next`) still drops it, and the new test asserts that wrong URL. The remaining findings are small: a sign-out failure is still silent, two route-local cookie readers have no malformed-value test, and malformed JSON bodies return 500 on the new public auth endpoints.

## Minor

### 🟡 Query string is still dropped after sign-in, `apps/web/src/components/auth/require-role.tsx:28-31`

**Problem**: `signInReturnPath` copies the page's query params as siblings of `next`: `/login?status=open&next=%2Fadmin%2Forders`. `LoginForm` reads only `searchParams.get("next")` and calls `resolvePostSignInPath(nextParam, role)` (`apps/web/src/components/auth/login-form.tsx:30-31,66`), so `status=open` is never part of the destination. The r4 finding asked for the query to be preserved; this shape preserves it only on the login URL, not through sign-in. `require-role.test.tsx:80-109` now locks in the wrong URL, so the suite will defend the bug.
**Why it matters**: An admin who opens a filtered view such as `/admin/orders?status=open`, is signed out, and signs back in lands on the unfiltered page. The r4 fix therefore does not change behaviour, and the added test makes a future correct fix look like a regression.
**Suggested fix**: Build `next` from the pathname plus the serialized search params (pathname + `?` + `searchParams.toString()`) and leave `/login` with only the `next` param. Update both assertions to expect `/login?next=%2Fadmin%2Forders%3Fstatus%3Dopen`, and add a case proving `resolvePostSignInPath` returns the query.

### 🟡 Failed sign-out is now a silent no-op, `apps/web/src/components/auth/auth-menu.tsx:43-50`

**Problem**: The r4 fix correctly stopped navigating on `{success:false}`, but nothing replaces the old behaviour: no message, no retry, no disabled/busy state. Radix closes the dropdown on select, so from the customer's point of view clicking "Sign out" does nothing at all. `auth-menu.test.tsx:196-212` asserts only that `router.replace`/`refresh` were not called.
**Why it matters**: On a shared device a customer can believe they signed out while the refresh cookie is still live. A transient network or 5xx failure is indistinguishable from a dead control, and the only recovery is to reload and try again blindly.
**Suggested fix**: Surface the failure in the menu (inline alert or toast) with a retry action, and keep the account control enabled so the customer can try again. Extend the failure test to assert the message/retry is shown.

### 🟡 Route-local cookie readers have no malformed-value test, `apps/api/src/presentation/auth/auth.routes.ts:247-264,415-435`

**Problem**: The r4 malformed-cookie fix was applied to `readRefreshCookie` and the route-local `readCookie`, but the only regression test exercises `/me`, which goes through the exported helper in `auth-middleware.ts:80-100` (`routes.integration.test.ts:487-492`). `/refresh`, `/logout`, and the OAuth callback use the two copies in `auth.routes.ts`, so the paths most exposed to a hostile `Cookie` header are untested. Because the logic is duplicated, a future edit to one copy will not fail any test.
**Why it matters**: The whole point of the fix is that a malformed percent sequence is attacker-controlled input and must not become a 500. A regression in the untested copies would only appear in production, and the current suite would stay green.
**Suggested fix**: Import the tested `readCookie` from `auth-middleware.ts` (or extract it to a shared module) and delete both copies. Add integration cases sending `cp_refresh=%E0%A4%A` to `/refresh` and `/logout`, and a malformed state cookie to the OAuth callback, asserting 401/redirect rather than 500.

### 🟡 Malformed JSON bodies return 500 on public auth routes, `apps/api/src/presentation/middleware/errorHandler.ts:36-42`

**Problem**: `apps/api/src/app.ts:37` mounts `express.json({ limit: "1mb" })` ahead of the new public auth router. Body-parser rejects malformed JSON and oversized bodies with an error carrying `status = 400`/`413`, but `errorHandler` only honours `AppError`, so every such request becomes `500 Internal server error` and logs `[ERROR]` with a stack. There is no test for it (`app.test.ts` only covers an unexpected throw).
**Why it matters**: Anyone can send `POST /api/auth/login` with a broken body and generate 500s and error-log noise, which pollutes monitoring and makes routine client mistakes look like server faults. It also returns the wrong status to the caller.
**Suggested fix**: In `errorHandler`, honour `err.status`/`err.statusCode` for body-parser errors (or map `err.type === "entity.parse.failed"` and `"entity.too.large"` to 400/413) before falling back to 500. Add an integration test posting invalid JSON to `/api/auth/login`.

## Nits

- ⚪ `apps/api/src/presentation/auth/auth.routes.ts:415`, `readCookie` duplicates the exported helper in `auth-middleware.ts:80`; import it instead of keeping a second copy.
- ⚪ `apps/api/src/infrastructure/database/user.repository.ts:173`, the implementation types `providerId` as `string` while the port (`domain/ports/user-repository.ts:90`) allows `string | null`; TypeScript method bivariance hides the null the use case can pass. Match the port type.
- ⚪ `apps/api/src/presentation/auth/auth.routes.ts:316`, the OAuth callback reads `"cp_oauth_state"` by literal while `OAUTH_STATE_COOKIE_NAME` already exists in `domain/auth-constants.ts:63`; use the constant so the cookie name cannot drift from `cookies.ts`.
- ⚪ `apps/api/src/application/use-cases/oauth.ts:46-50`, the `LOCAL` branch still writes the incoming `providerId` while `authProvider` stays `LOCAL`. The comment says this is intentional support data, so this is optional, but the pair remains inconsistent for local accounts that later link a provider.

## Strengths

- Rotation is now a single conditional transaction: the successor is created, `updateMany({ id, revokedAt: null })` claims the predecessor, and a losing transaction deletes its own successor. The concurrent-rotation test runs against real Postgres, so the race is exercised rather than mocked.
- The grace window now requires the successor to still be active, which closes the replay hole after sign out or password reset without narrowing the legitimate multi-tab retry window.
- Security hardening is consistent: per-route throttles, dummy bcrypt for unknown and locked accounts, issuer/audience-bound OAuth state, allowlisted proxy paths, and timeouts on upstream calls.
- The Resend idempotency key is bounded by construction (`prefix/64-hex/32-hex`), and the long-address test asserts both the shape and the 256 character cap.

## Test coverage

Strong overall and improving. `npm run typecheck`, `npm run lint`, and `npm test` pass (API 169, web 193, shared 57). The r5 round adds real behaviour tests for sign-out success/failure, the role guard, the long-address idempotency key, and the malformed `/me` cookie. The gaps are the ones above: the require-role test asserts the wrong URL, the `auth.routes.ts` cookie readers have no malformed test, and malformed JSON has none. The `require-role` and sign-out tests are otherwise meaningful (they assert navigation and non-navigation, not mocks), so the suite is close; fixing those three gaps would make the r4 fix round fully covered.
