# Review, feat/customer-auth, 2026-11-05

**Reviewed by**: Big Pickle (fresh reviewer, round 9)
**Scope**: 147 files, feat/customer-auth vs main (merge base `fe553df`, includes uncommitted working tree; `package-lock.json`, `.agents/skills/**`, and prior `docs/reviews/**` excluded as churn)
**Verdict**: Changes requested

## Summary

This is the full customer-auth slice: 11 use cases, domain entities and rules, Prisma repositories, JWT/bcrypt/email adapters, 13 API routes with guard and rate-limit layers, the Next.js auth proxy and route guards, shared schemas, the deploy topology configs, and unit/integration/E2E suites. The implementation is careful and unusually well tested: typecheck and lint pass, and all 440 tests pass (API 176, web 207, shared 57). One Major remains from round 8: the refresh path still treats _any_ revoked token, including one revoked by sign-out with no successor, as reuse and then revokes every active session for the account. Four minors and seven nits follow; none are blockers.

## Major

### 🟠 Signed-out refresh tokens still trigger the account-wide reuse cascade, `apps/api/src/domain/entities/session.ts:138-140`

**Problem**: `isReuse(now)` is still `isRevoked() && !isWithinRotationGrace(now)`, so it never requires a successor. `isWithinRotationGrace` was tightened to require `replacedByTokenId !== null` (`session.ts:126`), but `isReuse` was not, so a row revoked at sign-out (revoked, no successor) counts as reuse. In `refreshSession` the replayed token fails `issueFromGrace` precisely because it has no successor (`refresh.ts:112-113`), falls through to `deps.sessions.revokeAllForUser(session.userId, now)` (`refresh.ts:49`), and returns 401. The mirrored rotate-race branch repeats the same cascade at `refresh.ts:74`. This contradicts spec 0005 (`docs/specs/0005-customer-auth/index.md:163`): "Reuse means presenting a token whose row is revoked **and has a successor**, more than 10 seconds after that rotation."

**Why it matters**: A refresh token captured once (old device, backup, log leak) remains a permanent account-wide kill switch. Replaying a token the user already signed out revokes every active session for the account, including sessions created after the previous kill, and the attacker can repeat it indefinitely. The same path makes a benign race harmful: a refresh already in flight when the user signs out on another tab reaches `refresh.ts:74` and signs out the user's other devices too — the exact failure the 10-second grace window exists to prevent. It fails closed, which is why this is a Major rather than a Blocker, but it is a real denial-of-service lever the spec explicitly rules out. The behavior is also pinned by a test: `session.test.ts:47-54` asserts "treats a revoked session without a successor as reuse immediately", and no test replays a _signed-out_ token through the use case or route, so the blast radius is unexercised.

**Suggested fix**: Require a successor in one place: `isReuse(now)` becomes `isRevoked() && replacedByTokenId !== null && !isWithinRotationGrace(now)`. Then a revoked row with no successor fails `issueFromGrace` and throws the neutral `invalidSession()` 401 without cascading, while a revoked row _with_ a successor whose successor is inactive still cascades as intended. Update `session.test.ts:47-54` to assert the opposite, update the `refresh.ts:6-19` JSDoc ("Outside that window it is reuse"), and add a regression test: sign out, replay the cookie after the grace window, expect 401 **and** another active session still alive. If the team instead intends "any dead token kills the account", record that in spec 0005 rather than leaving the implementation and the spec in conflict.

## Minor

### 🟡 Token-hash lookups have no index, `apps/api/src/infrastructure/database/user.repository.ts:42-55`

**Problem**: `findFirst` filters on `emailVerificationToken` and `passwordResetToken`, both `VarChar(255)` with no index (`apps/api/prisma/schema.prisma:24,27`), unlike `Session.tokenHash`.

**Why it matters**: Verification and reset clicks, plus the resend flows that rewrite those columns, become sequential scans of the users table as it grows.

**Suggested fix**: Add `@@index([emailVerificationToken])` and `@@index([passwordResetToken])` (plain or partial `WHERE ... IS NOT NULL`) and a migration. Keep the columns unique-safe at the application layer if unique indexes are undesirable for nullable values.

### 🟡 Comments still call the stored digest "SHA 256" although it is HMAC-SHA256, `apps/api/src/domain/ports/token-service.ts:32`

**Problem**: Six sites describe the stored token digest as a plain SHA-256 hash, while `hashOpaqueToken` computes an HMAC keyed with `JWT_REFRESH_SECRET` (`apps/api/src/infrastructure/auth/jwt-token-service.ts:74`). The sites are `domain/ports/token-service.ts:32`, `domain/ports/session-repository.ts:21`, `domain/ports/user-repository.ts:46,48`, `application/use-cases/issue-session.ts:9`, and `domain/entities/session.ts:49`; spec 0005 says SHA-256 at lines 67, 70, 83, 130, 158, 185 and 222.

**Why it matters**: The next maintainer may "fix" a keyed digest back to the documented plain hash, or reason incorrectly about what a database leak exposes. The keyed design is a genuine improvement; the documentation should not undersell it.

**Suggested fix**: Say "HMAC-SHA256 keyed with `JWT_REFRESH_SECRET`" in those comments and in the spec, keeping `jwt-token-service.ts:106` (which really is plain SHA-256) unchanged.

### 🟡 Docker quick start cannot boot the API as written, `docs/deployment.md:36-37`

**Problem**: The quick start says to copy `.env.docker.example` and edit only `POSTGRES_PASSWORD`, but the copied values `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PROXY_SHARED_SECRET` contain `change-me` and `RESEND_API_KEY` / OAuth secrets are `...` (`.env.docker.example:41-59`). `PLACEHOLDER_PATTERN` rejects the former (`apps/api/src/config/env.ts:142,162`) and `parseCredential` rejects the latter (`env.ts:176`), so the API exits at startup. The example file does tell the reader to run `openssl rand -hex 32`; the quick start does not.

**Why it matters**: The reference self-hosted path fails on the first command for a new operator, and the failure is a startup error that looks like a code fault rather than a docs omission.

**Suggested fix**: Change the quick start to "generate the four secrets with `openssl rand -hex 32` and fill in the Resend and OAuth values" (or make the example values valid-but-obviously-dev and have production reject them), and note that OAuth variables are required even if only local sign-in is used.

### 🟡 Expired lock leaves the counter at the maximum, so one wrong password re-locks immediately, `apps/api/src/domain/entities/user.ts:157-166`

**Problem**: `recordFailedLogin` returns early while locked and increments otherwise, but nothing resets `failedLoginAttempts` when `lockedUntil` passes. A user who waits out the 15 minutes still has a count of at least 5; the next wrong password goes to 6, re-triggers the threshold, and locks the account for another 15 minutes. Only a success or password reset clears it (`user.ts:172-175`). Spec 0005 says the lock is "a fixed 15 minutes rather than a lever an attacker can hold forever".

**Why it matters**: A legitimate user who waits out the lock and then mistypes once is locked again for the full duration, which is the lever the rule was meant to remove. There is no test for the post-expiry path: `user.test.ts:22` only covers attempts made _while_ locked.

**Suggested fix**: In `recordFailedLogin`, when `lockedUntil` is non-null and `!isLocked(now)`, reset the counter to zero (and `lockedUntil` to null) before incrementing; or have the login use case clear the expired lock. Add a test that fails once exactly after `LOCK_DURATION_MS` and asserts the account is not re-locked and the counter is 1.

## Nits

- ⚪ `apps/api/src/presentation/auth/auth.routes.ts:318`, the OAuth `state` query is compared to its cookie with `!==` rather than a timing-safe compare. It is not exploitable (the value is independently verified as an HMAC-signed token at line 329 and the cookie is HttpOnly), but `proxy-guard.ts:28` sets the precedent for secret comparisons.
- ⚪ `apps/api/src/presentation/auth/auth.routes.ts:458`, a provider profile without an `id` maps to `providerId: ""` instead of `null`. The column is nullable; both configured providers always send an id, so this is theoretical, but `null` keeps the column semantics honest.
- ⚪ `apps/web/src/components/auth/oauth-buttons.tsx:9-33`, raw brand hex values are hardcoded where the design system prefers tokens. Brand marks are arguably exempt; if so, note the exemption in `design.md` so it is not re-flagged.
- ⚪ `apps/web/src/components/header.test.tsx` renders `AuthMenu` with an un-stubbed `useSession`/`fetch`, producing ECONNREFUSED noise in every test run while still passing. Stub the hook or `fetch`.
- ⚪ `apps/api/src/presentation/auth/auth-middleware.ts:45`, `createRequireAdmin` is exported and unit-tested but mounted on no production route. AC-10's API half is currently only exercised by the integration test that mounts it by hand; a comment here or in the router wiring would stop a later reader mistaking it for active protection.
- ⚪ `apps/api/src/infrastructure/email/resend-email-sender.ts:67-71,80-81` logs the full verification/reset link (containing the raw token) whenever `NODE_ENV !== "production"` (`apps/api/src/index.ts:101`). Spec 0005 asks for exactly this development fallback (line 222) while also saying no raw token is ever logged (line 158); clarify the spec to "never logged in production" and, ideally, log the link only when Resend is not configured.
- ⚪ In the self-hosted no-edge topology (API port published directly), all rate-limit buckets collapse to one "unknown" client, i.e. a per-instance global limit. This is documented (`docs/deployment.md:68-73`, `apps/web/src/lib/auth/client-ip.ts`), so no change is requested; a one-line reminder in the quick start would help operators.

## Strengths

- Rotation is genuinely atomic: the repository claims the old token inside a transaction, so two concurrent refreshes cannot both rotate (`apps/api/src/infrastructure/database/session.repository.ts`), with a real-PostgreSQL race test (`apps/api/src/infrastructure/database/session.repository.test.ts:56`) and entity-level grace-window boundary tests.
- Login is enumeration-resistant end to end: a real dummy bcrypt hash for unknown emails, uniform 401/202 responses, and email copy that never confirms account existence.
- The web↔API trust boundary is deep: a timing-safe proxy secret that survives truncation, an endpoint allowlist, a 1 MB body cap, timeouts, Origin checks at both layers, and deletion of any incoming `x-auth-role` before the proxy sets its own (`apps/web/src/proxy.ts:235`).
- Env validation fails fast with real teeth — minimum lengths, distinct secrets, placeholder rejection, absolute-URL checks, and production refusal of the mock-provider overrides (`apps/api/src/config/env.ts`).
- `sanitizeNextPath` / `resolvePostSignInPath` (`packages/shared/src/auth/next-path.ts`) is a single well-documented rule shared by API and web, rejecting protocol-relative, absolute, backslash, control-character, and auth-screen destinations.

## Test coverage

The suite is strong and green in this working tree: API 14 files / 176 tests, web 27 files / 207 tests (including shared), shared 4 files / 57 tests, plus a Playwright E2E suite that drives browser → proxy → API → PostgreSQL with per-test forwarded IPs. Domain and application layers use real in-memory fakes, and repository/route integration uses real PostgreSQL; nothing calls live Google, Facebook, or Resend. The material gap is the one attached to the Major: no test replays a signed-out (revoked-without-successor) refresh token through `refreshSession` or `POST /refresh`, so the account-wide cascade and its blast radius are unexercised; the current entity test asserts the behavior the spec forbids. The lock-expiry path is also untested beyond "attempts while locked do not extend the lock". Both are cheap regression tests to add with the fixes.
