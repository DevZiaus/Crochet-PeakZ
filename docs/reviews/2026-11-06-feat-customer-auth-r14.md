# Review, feat/customer-auth, 2026-11-06

**Reviewed by**: Crouton Alpha
**Scope**: 148 files, branch vs base
**Verdict**: Approve with nits

## Summary

Customer auth (spec 0005) is a large, well-layered slice: Clean Architecture API with domain/application/infrastructure/presentation separation, HttpOnly rotating sessions, proxy secret + Origin + per-client rate limiting, and a Next.js auth proxy with one-time refresh/replay. The overall quality is high with exhaustive unit, integration (real PostgreSQL), OAuth mock round-trip, and Playwright coverage. Findings are all narrow edges and dead code; there are no blockers or majors.

## Minor

### 🟡 OAuth first sign-in race returns link_failed, `apps/api/src/application/use-cases/oauth.ts:30`

**Problem**: `signInWithOAuth` does `findByEmail`, then `createOAuth`. Two concurrent first sign-ins for the same new email both see `null`; the loser hits the email unique violation. Unlike `registerUser`, this P2002 is not translated — the OAuth callback catches it and redirects with `link_failed`.
**Why it matters**: A user signing in from two devices at once (or double-clicking the provider flow) can see a failure even though the account was created, and must retry. Retry then succeeds, so it is recoverable.
**Suggested fix**: Catch the unique-violation on `createOAuth` and re-read by email (or use an upsert-by-email), then continue with the existing-account path.

### 🟡 Grace-replay sessions are unlinked branches, `apps/api/src/application/use-cases/refresh.ts:145`

**Problem**: `issueFromChain` creates the grace-window session with a plain `sessions.create`, leaving its `replacedByTokenId`/predecessor links unset. `revokeChain` from a predecessor therefore cannot reach it.
**Why it matters**: The live successor chain is killed by sign-out-with-old-token, but the grace branch survives. The normal browser flow presents the newest token, so this only matters with rapid concurrent refreshes plus a stale-token sign-out, but it breaks the "logout kills the chain" invariant the code documents.
**Suggested fix**: Link the grace session into the chain (or document the orphan as an accepted tradeoff in the session port comment).

### 🟡 Failed-login CAS drops an increment after five lost races, `apps/api/src/application/use-cases/login.ts:39`

**Problem**: `recordFailedLogin` retries five times on CAS loss, then silently drops the increment. A burst of concurrent failures can therefore keep the counter below the lock threshold.
**Why it matters**: Attacker parallelism is limited by the 10/15min per-IP throttle, so this is a small lock-delay rather than an easy bypass, but it is a deliberate counter loss in security-relevant logic.
**Suggested fix**: Either raise the bound with a comment on the worst-case delay, or add an unconditional atomic increment fallback for the final attempt.

### 🟡 Web env accepts a placeholder shared secret, `apps/web/src/lib/auth/web-env.ts:36`

**Problem**: `getWebAuthEnv` only checks that `PROXY_SHARED_SECRET` is non-empty. The API side rejects short/placeholder secrets at startup, but the web side will boot with e.g. `change-me-proxy-secret` and then fail every auth call with 401 at runtime.
**Why it matters**: Spec AC-15 wants fail-fast on malformed configuration. A mismatched placeholder is a classic local-setup pain (noted as a tradeoff in the spec) and is currently only caught as runtime 401s, not a boot error naming the variable.
**Suggested fix**: Mirror a minimal placeholder/min-length check on the web side in `getWebAuthEnv` (and keep the API copy authoritative).

### 🟡 `createRequireAdmin` is built, tested, but not mounted, `apps/api/src/presentation/auth/auth-middleware.ts:49`

**Problem**: No API route mounts `createRequireAdmin`; the admin area is guarded only in the web proxy/layout. The code comment admits the middleware "is not live protection until a backend admin route attaches it".
**Why it matters**: A future backend admin endpoint could reasonably assume it is protected when it is not, and the guard's DB-recheck behavior (AC-10) is unenforced server-side until then.
**Suggested fix**: Keep the helper if the spec wants it (spec 0005 does name it), but add a single test-only mount or a TODO pointing at the first admin endpoint so it cannot drift; or document the web-only enforcement in the spec's security model.

### 🟡 Proxy replay carries the stale refresh cookie, `apps/web/src/app/api/auth/[...path]/route.ts:259`

**Problem**: After a successful refresh, the replay request is rebuilt with only the new access cookie (`writeCookie(originalCookie, ACCESS_COOKIE, nextAccess)`); the replay still presents the now-rotated refresh cookie.
**Why it matters**: Today only `/me` replays (which checks access only) and the browser still receives the correct rotated pair via `refreshSetCookies`, so this is benign. Any future replayed endpoint that validates the refresh cookie would fail against a stale value.
**Suggested fix**: Also rewrite the refresh cookie in the replay header for consistency, or comment why only access is needed.

## Nits

- ⚪ `apps/api/src/domain/ports/user-repository.ts:94`, `saveLoginState` is unused by any use case (login uses `saveFailedLogin`/`saveSuccessfulLogin`); the port method, Prisma impl, fake, and tests are dead weight.
- ⚪ `apps/api/src/infrastructure/auth/jwt-token-service.ts:123`, `sha256Hex` is exported but never imported anywhere (auth hashing uses `hashOpaqueToken`).
- ⚪ `apps/api/src/application/dependencies.ts:25`, `AuthDependencies.isProduction` is never read by use cases; cookie Secure handling uses the router deps instead.
- ⚪ `apps/api/src/domain/types.ts:51`, `IssuedTokens` interface is exported but unused (results use `AuthResult`).
- ⚪ `apps/web/src/components/auth/register-form.tsx:13`, `firstIssueMessage` is duplicated verbatim in `reset-password-form.tsx:17`; a shared helper in `lib/auth/api.ts` would do.
- ⚪ `apps/api/src/config/env.ts:214`, `EMAIL_FROM` requires a dotted domain, so `hello@localhost` (handy in local tests) is rejected even outside production.

## Strengths

- Single-use tokens are enforced atomically everywhere: `rotate` deletes its own successor on losing a race, verification/reset consumption is conditional on the stored digest, and password reset commits token + hash + session revocation in one transaction.
- Login is disciplined: dummy-hash verification for unknown/locked/OAuth-only accounts, fixed non-extending 15-minute lock, CAS-guarded failure increments, and a successful login that never erases a parallel failure.
- The trust boundary is well handled: timing-safe secret comparison, Origin checks on writes at both layers, `ALLOWED_AUTH_PATHS` allowlist in the proxy, `request_body` + 1 MB JSON limits at Caddy/web/API, loopback-only ports, and documented single-edge IP semantics.
- Clean Architecture is actually respected: domain has zero framework/ORM imports, use cases depend on ports only, Prisma types never leak past the repositories, and error codes stay HTTP-free until `presentation/auth/http.ts`.

## Test coverage

Strong across every layer. Domain (`user`, `session`) and application (`auth.test.ts`, 783 lines) unit tests cover register/resend/login/lock/verify/refresh-grace/reuse/reset/logout/OAuth-linking including parallel-write races and timing behavior, without infrastructure mocks (in-memory port fakes). `routes.integration.test.ts` (932 lines) plus `auth.integration.test.ts` and `oauth.integration.test.ts` (661 lines) run the real router against real PostgreSQL and a local mock OAuth provider, asserting AC-1–AC-15 behavior including 429/Retry-After, cookie clearing, and token rotation. Email tests assert the exact Resend envelope (including `EMAIL_FROM`) without live sends. Web component tests cover all six auth screens, guards, and the callback redirect; `next-path.test.ts` covers open-redirect rules; `e2e/auth.spec.ts` (644 lines, 26 runs) drives a real browser through the Next proxy. Gaps by design only: no live Google/Facebook/Resend calls (enforced by the mock-provider rule), and e2e cannot observe the header on `/` because the home page mounts no site header (noted in verify.md). No missing-coverage finding per the configured test signal.
