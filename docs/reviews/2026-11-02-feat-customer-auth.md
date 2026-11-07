# Review, feat/customer-auth, 2026-11-02

**Reviewed by**: flint-40b-free (author on deepseek-v4.1-flash-1017-basic)
**Scope**: 134 files, branch vs base (feat/customer-auth against `fe553dfe5801e69255e9f6d6de24a5a90be63b2a`, plus untracked auth test files)
**Verdict**: Changes requested

## Summary

The branch adds the customer auth feature end to end: domain entities and ports, use cases, Prisma adapters, the Express auth router (proxy guard, rate limits, cookie policy), the Next.js auth proxy (refresh and replay, relay), the six auth screens, the shared Zod/types, and the Vitest/Playwright coverage. The core machinery is genuinely well built: rotation with a 10 second grace window, reuse revocation, fixed-window lockout, generic credential errors, HttpOnly/SameSite/Secure cookies, refresh token HMAC storage, bcrypt cost 12, and fail-fast env validation are all present and tested.

The headline problem before merge is in the refresh failure path: when a presented refresh token is rejected, the API answers 401 without clearing the auth cookies, so the web proxy's refresh-and-replay failure handling can never perform its documented cookie clearing.

## Major

### 🟠 Failed refresh does not clear auth cookies when a presented refresh token is rejected, `apps/api/src/presentation/auth/auth.routes.ts:133`

**Problem**: `POST /api/auth/refresh` clears both auth cookies only when the refresh token is absent (`if (!raw)` at line 138). When a token is presented and the use case rejects it (unknown, expired, or rotated-then-replayed), the error path answers 401 without clearing.

**Why it matters**: Session revocation (password reset, refresh reuse detection) invalidates the credential server side, but the browser keeps the `cp_refresh` cookie. The web proxy (`apps/web/src/app/api/auth/[...path]/route.ts:134-138`) is explicitly written to relay a failed refresh's cookie clearing ("Relay the refresh cookie clearing so the browser stops retrying") and its test (`apps/web/src/app/api/auth/[...path]/route.test.ts:151-174`, mocked upstream at lines 31-48) encodes that contract. Because the real API never emits clearing on the token-present failure path, the relay forwards nothing, the stale refresh cookie survives, and the client keeps re-attempting refresh against a dead credential on subsequent authenticated calls.

**Suggested fix**: clear both auth cookies before answering 401 on any failed refresh (wrap the use case call and clear on error), keeping the missing-cookie path as-is.

## Minor

### 🟡 `/api/auth/verify-email` and `/api/auth/reset-password` are not throttled, `apps/api/src/presentation/auth/auth.routes.ts:89`

**Problem**: The acceptance contract (AC-12) requires every auth endpoint to be throttled with the listed limits; the router applies `createRateLimit` to register, resend, login, refresh, and forgot-password, but the verify-email and reset-password handlers (around lines 89-96 and 183-192) have none.

**Why it matters**: Contract deviation from the governing spec, even though the high-entropy token space reduces brute force risk; unthrottled token endpoints should still carry the 429 + Retry-After behaviour the rest of the surface has.

**Suggested fix**: add rate limits to the two handlers, or explicitly exempt token endpoints in the spec with justification.

### 🟡 In-memory session fake seeds `createdAt` from `expiresAt`, `apps/api/src/test-support/auth-fakes.ts:314`

**Problem**: `InMemorySessionRepository.seed` writes `createdAt: session.expiresAt` instead of the row's own creation time.

**Why it matters**: Latent defect in auth test support; any future assertion on session creation timestamps will fail confusingly.

## Nits

- ⚪ `apps/api/src/application/use-cases/register.ts:31` declares `let user;` without an explicit type instead of a typed local.

## Strengths

- Clean Architecture boundaries hold: domain has no external imports, ports/adapters keep Prisma, jose, bcrypt, and Resend behind interfaces.
- Refresh rotation, grace window, and reuse revocation are entity-level rules and are unit tested directly; lockout, unverified sign-in, and reset flows are covered.
- Security wiring is sound: proxy shared secret with timing-safe compare and placeholder rejection, write Origin allow-list, HttpOnly/SameSite/Secure cookies with correct Max-Age values, refresh token HMAC storage, bcrypt cost 12, and fail-fast env validation.

## Test coverage

TEST_SIGNAL = configured. Coverage is broadly strong: use cases (lock, unverified, rotation/reuse, reset), integration routes (cookie Max-Age, rate limits, generic credential error, unverified no-counter), web component tests for the new forms, proxy tests, and the Playwright auth suite.

The gap that enabled this review: the failed-refresh cookie clearing is only asserted through a mocked upstream refresh response, which is precisely where implementation and tested contract diverge (see Major).
