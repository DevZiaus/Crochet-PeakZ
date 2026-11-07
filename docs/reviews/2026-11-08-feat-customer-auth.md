# Review, feat/customer-auth, 2026-11-08

**Reviewed by**: Crouton Alpha (author on DeepSeek V4.1 Flash)
**Scope**: 148 files, branch vs base
**Verdict**: Approve with nits

## Summary

Customer auth (spec 0005) remains a well-layered slice with Clean Architecture API, HttpOnly rotating sessions, proxy secret + Origin + per-client rate limiting, and a thoroughly tested web proxy. The unreviewed delta since commit `7f05f1c` (29 files in `git diff HEAD`) correctly closes the six r14 minors and six nits: OAuth parallel-create now retries as an existing account, the failed-login guard falls back to an atomic locked-row increment, the web proxy rejects short/placeholder secrets, the refresh replay carries the rotated pair, the grace-branch orphan is documented as an accepted tradeoff, and the dead ports/types are removed. No blockers, majors, or minors remain.

## Nits

- ⚪ `apps/api/src/config/env.ts:142`, `PLACEHOLDER_PATTERN` and the 16-character proxy minimum are duplicated between the API and `apps/web/src/lib/auth/web-env.ts:20`; a comment says they are kept in step, but a shared constant (or a test that asserts both copies match) would prevent drift.
- ⚪ `apps/api/src/infrastructure/database/user.repository.ts:242`, `incrementFailedLogin` locks the row with `SELECT "id" FROM "users" ... FOR UPDATE` and then `findUnique`s the same row. Correct and tested, but one `SELECT ... FOR UPDATE RETURNING` would hold the lock for a shorter window.
- ⚪ `apps/api/src/infrastructure/database/user.repository.ts:242`, the raw SQL hardcodes `"users"`, so a future `@@map` rename would silently break the lock. A test that asserts the raw table matches the Prisma mapping would make that visible.

## Strengths

- Single-use tokens are enforced atomically everywhere: `rotate` deletes its own successor on losing a race, verification/reset consumption is conditional on the stored digest, and password reset commits token + hash + session revocation in one transaction.
- Login is disciplined: dummy-hash verification for unknown/locked/OAuth-only accounts, fixed non-extending 15-minute lock, CAS-guarded failure increments with a real atomic fallback so a burst can never silently drop an attempt, and a successful login that never erases a parallel failure.
- The trust boundary is well handled: timing-safe secret comparison including length, Origin checks on writes at both layers, `ALLOWED_AUTH_PATHS` allowlist in the proxy, `request_body` + 1 MB JSON limits at Caddy/web/API, loopback-only ports, and documented single-edge IP semantics.
- Clean Architecture is actually respected: domain has zero framework/ORM imports, use cases depend on ports only, Prisma types never leak past the repositories, and error codes stay HTTP-free until `presentation/auth/http.ts`.

## Test coverage

Strong across every layer. Domain (`user`, `session`) and application (`auth.test.ts`) unit tests cover register/resend/login/lock/verify/refresh-grace/reuse/reset/logout/OAuth-linking including the new parallel-write races, without infrastructure mocks (in-memory port fakes). `routes.integration.test.ts` plus `auth.integration.test.ts` and `oauth.integration.test.ts` run the real router against real PostgreSQL and a local mock OAuth provider, asserting AC-1–AC-15 behavior including 429/Retry-After, cookie clearing, and token rotation. Email tests assert the exact Resend envelope without live sends. The unreviewed delta is well covered: `AlwaysRacingUserRepository` proves the `incrementFailedLogin` fallback, `RacingOAuthRepository` proves the parallel first sign-in continues as the existing account, the Prisma adapter tests prove P2002 translation, concurrent fallback increments and expired-window restart, the route handler test proves the replay carries both cookies, and `web-env`/`env` tests prove the length/placeholder/localhost rules. The `git diff HEAD` delta has no untested new logic; only by-design gaps remain (no live Google/Facebook/Resend, the `/` home page mounts no site header). Playwright e2e is now wired into CI with a real PostgreSQL service, closing the earlier enforcement gap.
