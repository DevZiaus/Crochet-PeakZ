# Review, feat/customer-auth, 2026-11-06

**Reviewed by**: GLM-5.3-Flash Free (author model: unknown, per orchestrator)
**Scope**: 144 files (136 in the branch diff vs merge base `fe553dfe`, 8 untracked: the `20261105120000_user_token_indexes` migration and 7 test files), branch vs base `main`
**Verdict**: Approve with nits

## Summary

Spec 0005 is implemented end to end: register/verify/resend, login with lockout, rotating refresh sessions with a 10 second grace window, reuse detection, forgot/reset, Google and Facebook OAuth with signed state and email attestation checks, a Next.js request proxy (`proxy.ts`) plus an `/api/auth` route-handler proxy, shared `next` sanitization, rate limits, and a very large, genuinely meaningful test suite (unit, integration against real PostgreSQL, an in-process mock OAuth provider, and 26 Playwright flows). The security core is unusually careful: hashed refresh tokens, conditional single-row claims for every multi-step write, guarded consume of one-time tokens, timing-safe comparisons, and cookies that follow the spec exactly. I found no blockers and no majors; the findings below are edge cases and process gaps.

## Minor

### 🟡 Google email attestation is default-allow when the field is absent, `apps/api/src/presentation/auth/auth.routes.ts:485-488`

**Problem**: For Google, `profile._json?.email_verified !== false` treats a profile whose `_json` carries no `email_verified` at all as verified. Spec 0005 invariant: "The provider must assert that the email is verified before the API resolves or links an account". Facebook is strict (`verified === true`); Google is not.
**Why it matters**: If a deployment ever returns a Google-shaped profile without the assertion (a different userinfo endpoint, a future scope change, or the test-only endpoint overrides pointing somewhere odd), an unproven email can link an existing account — the exact failure the invariant exists to prevent, and it is silent. Real Google always includes the field when the `email` scope is granted, so the practical exposure today is small.
**Suggested fix**: Use `profile._json?.email_verified === true` for Google, and update the mock provider and tests to assert the strict rule (including the missing-field refusal).

### 🟡 Server-side session fallback calls `/auth/me` without forwarding the client IP, `apps/web/src/lib/auth/session.ts:30-37`

**Problem**: `getSessionUser()` forwards the cookie and secret but no `x-forwarded-for`. The API's `/me` IP limiter (`auth.routes.ts:207`) then keys every one of these calls into the single `"unknown"` bucket (120/min across all of them).
**Why it matters**: This is only the fallback path (the request proxy normally supplies `x-auth-role`, so the layout skips the call), so today it is mostly latent. But the moment another server component reuses this helper, all server-side reads share one rate bucket and would 429 together — manifesting as users silently rendered signed out (`getSessionUser` returns null on non-200). It also makes the bucket collapse pattern invisible to future callers.
**Suggested fix**: Forward `readClientIp(headers)` like every other server-side caller (`proxy.ts` and the route handler both do), or drop the /me call and rely on the proxy's proved role header.

### 🟡 Playwright suite is not wired into CI, `.github/workflows/ci.yml`

**Problem**: CI runs lint, format, unit/integration tests, build, and typecheck, but never `npx playwright test`, even though the e2e suite (`e2e/auth.spec.ts`, 26 flows) is the browser-level proof for AC-2/5/7/10/12/13 and `playwright.config.ts` was added for it.
**Why it matters**: A regression in the three-way browser↔proxy↔API contract (Set-Cookie relay, replay-once, admin guard, robots headers) merges green; only a manually run suite catches it. `verify.md` shows it was exercised manually, but nothing enforces it going forward.
**Suggested fix**: Add a CI job (or a step after Test) that runs `npx playwright test` with the `DATABASE_URL` service already present; it is self-starting via `webServer`.

### 🟡 Untracked files must land in the milestone commit, `apps/api/prisma/migrations/20261105120000_user_token_indexes/migration.sql` and 7 test files

**Problem**: The token-index migration and `session.repository.test.ts`, `require-role.test.tsx`, `instrumentation.test.ts`, `cookies.test.ts`, `use-session.test.ts`, `web-env.test.ts` exist only in the working tree — `git ls-files --others` lists them; the branch diff does not contain them.
**Why it matters**: If the milestone commit is made without `git add`, the branch ships without the second migration (fresh environments get no `email_verification_token`/`password_reset_token` indexes, and later `prisma migrate` flags drift) and silently loses seven test files, including the only tests for repository rotation races.
**Suggested fix**: Stage and commit these files together with the milestone commit this review gates.

## Nits

- ⚪ `apps/api/src/presentation/auth/proxy-guard.ts:28`, the shared secret check short-circuits on `given.length !== expected.length` before `timingSafeEqual`, leaking the secret length by timing; the codebase already has the constant-width comparator (`timingSafeStringEquals`) used for OAuth state — reuse it here.
- ⚪ `apps/web/src/components/auth/oauth-buttons.tsx:9-33`, raw hex fills (`#4285F4` etc.) in the provider SVG marks technically violate the "every color resolves to a token" rule; if treated as brand logos this is fine, but a one-line comment justifying the exemption would keep later audits quiet.
- ⚪ `playwright.config.ts:40,52`, both `webServer` commands use `npm run start`, which requires a prior `npm run build` (the AGENTS.md gotcha); a clean checkout waits out the 120/180 s timeouts before failing with just a connection error. A `command` that builds first, or an early error, would save people that run.

## Strengths

- The session rotation design is exemplary: single-use tokens with `replacedByTokenId` chains, a grace window that cannot revive chains after sign out or reset, reuse revoking all sessions, and every multi-step write made idempotent via conditional claims (`rotate`, `revokeChain`, `saveVerified`, `completePasswordReset` all guard on the exact expected row), including a real-DB test that reproduces the lock-window race in `revokeChain`.
- Login hardening covers the subtle cases: dummy-hash bcrypt for unknown emails and locked rows to equalize response timing, a fixed 15-minute lock that failures cannot extend, and compare-and-swap loops so parallel failures never drop an increment — each with a corresponding test.
- The test suite is not decorative: it asserts JSON envelope shapes, exact `Set-Cookie` attributes, both the grace replay and the post-window revocation, provider attestation refusals, tampered/foreign state, malformed bodies, and per-IP bucket isolation, plus 26 end-to-end flows over the real stack.
- The Next.js side is careful where it matters: fail-closed admin guard at the proxy (markup never reaches non-admins), one refresh + one replay with the rotated cookies relayed even when the replay fails, `Set-Cookie` relay over `getSetCookie()`, body-size caps at both the edge and the proxy, and a strict proxy allowlist so the catch-all route is not an open relay.

## Test coverage

Coverage is a genuine strength and above the bar for this feature: domain entities, all ten use cases (including the concurrency CAS loops and grace/reset chain edge cases), both Prisma repositories against real PostgreSQL (including a transactionally gated race reproduction for `revokeChain`), the HTTP surface (`routes.integration.test.ts`, every AC-12 limit, malformed-input paths), a full OAuth round trip against the local mock provider, env validation, web components (forms, guards, menus), the route handler proxy, `proxy.test.ts`, instrumentation, env, cookies, `use-session`, and Playwright e2e. The only untested production logic I could find is narrow: `getSessionUser`'s fallback is exercised only through the admin layout test mock, and the Google missing-`email_verified` path has no test because the strict/refused branch does not exist yet (see Minor #1). The one enforcement gap is that the e2e suite has no CI hook.
