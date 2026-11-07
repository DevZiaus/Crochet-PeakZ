# Review, feat/customer-auth, 2026-11-05

**Reviewed by**: GLM-5.3-Flash Free (fresh-eyes reviewer for /check review r13; author on deepseek-v4.1-flash:free)
**Scope**: 145 files, branch vs main (merge base fe553df), full change set with priority on the post-r12 delta
**Verdict**: Approve with nits

## Summary

The branch adds complete customer authentication: register/verify/resend, login with lockout, password reset, JWT access + rotating opaque refresh sessions, Google/Facebook OAuth with signed state, a Next.js auth proxy with one-shot refresh-and-replay, web session UI, and full test suites including real-PostgreSQL integration tests. The newest delta fixed the r12 `revokeChain` walk race in `session.repository.ts` (re-read after a blocked guarded write, visited-set loop guard) and reworked the login failure counter to compare-and-swap writes; both are backed by dedicated tests. No blockers or majors. I independently verified the r12 race is genuinely closed and found the rest of the auth core (token hashing, rotation single-use, grace window vs sign-out/reset, per-route rate limits, proxy guard, env validation, next-path sanitization) sound.

## Minor

### 🟡 Resend burns the previously delivered link before the email send succeeds — `apps/api/src/application/use-cases/resend-verification.ts:45-61`

**Problem**: `saveVerificationIssue` overwrites the stored token hash (invalidating the older link the customer may still hold), and only afterwards is the email attempted, inside a `try/catch` that logs and swallows the failure. A transient Resend failure leaves the account with exactly one stored link that was never delivered.
**Why it matters**: The customer's real recovery path is "I never got the email, resend" — that request is then rejected until the throttle expires, with no valid link in any inbox in the meantime.
**Suggested fix**: Attempt the email send before (or instead of after) persisting the new issue, or persist-then-send with a rollback of the stored issue on failure. Registration (`register.ts:58-66`) has the same swallowed-send pattern, but there the throttle is short and account creation is one-shot; the resend path is where link-burning actually bites.

### 🟡 Refresh Set-Cookies are lost when the replayed request errors — `apps/web/src/app/api/auth/[...path]/route.ts:255-270`

**Problem**: When a 401 triggers a successful refresh, the rotated token pair is captured in `refreshSetCookies` and `nextAccess`, then the replay runs inside a `try/catch` whose failure branch returns `upstreamUnavailable()` — discarding the refresh cookies computed moments earlier.
**Why it matters**: The API has already revoked the old refresh token (rotation is atomic), so after the failed replay the browser holds a dead refresh cookie with nothing to replace it. The session ends and the only recovery is a full sign in, for what is a transient upstream error.
**Suggested fix**: On a replay `fetch` failure, return the 502 with `refreshSetCookies` relayed (`headers.append("set-cookie", ...)` on `upstreamUnavailable`'s response), so the browser stores the new pair and the next request works.

## Nits

- ⚪ `apps/web/src/app/api/auth/[...path]/route.ts:346-359`, `relay()` copies upstream `cache-control` and then unconditionally overwrites it with `no-store`; the upstream copy is dead code.
- ⚪ `apps/api/src/presentation/auth/auth.routes.ts:318-330`, provider errors other than `access_denied` (e.g. `server_error`) are not mapped explicitly and fall through to the generic state-validation path; the final `provider_error` redirect is correct, but a table of error codes would document the intent.
- ⚪ `apps/api/src/presentation/auth/rate-limit.ts:68-76`, pruning only removes fully-stale keys, so a sustained burst of unique keys keeps the map at the 10 000 threshold for the whole window; bounded, but worth a comment stating the worst-case bound.

## Verified resolved (prior rounds)

- `apps/api/src/infrastructure/database/session.repository.ts:84-126` — the r12 `revokeChain` race is fixed: after a guarded write is refused, the successor link is re-read so a rotation landed in that window is not left live, and the `visited` set stops a cycle from looping forever. Covered end to end by the new real-PostgreSQL test in `session.repository.test.ts:129-184`, which gates a linking transaction and proves the successor is revoked.
- Login failure-counter races in `login.ts` / `user.repository.ts` (`saveFailedLogin`, `saveSuccessfulLogin` CAS) are tested both with racing in-memory fakes (`auth.test.ts:235-274`) and against real Postgres including a two-parallel-writes winner test (`user.repository.test.ts:480`).

## Strengths

- The compare-and-swap repository writes are tested at both fake and real-database levels, including the subtle case where a successful sign in must not erase a parallel failure increment — exactly the bug class most teams miss.
- Timing-considerate and enumeration-resistant login paths (`login.ts:85-102`): unknown email, OAuth-only, and locked accounts all run comparable bcrypt work and return one generic message.
- Refresh-token reuse semantics are genuinely hard to get right and are correct here: single-use rotation with a 10 s grace window that cannot resurrect a chain after sign-out or password reset, with tests for each boundary (`auth.test.ts:372-490`).
- Clean Architecture is honored consistently: domain has no framework imports, ports live in the domain layer, Prisma is confined to infrastructure, and `AuthError` keeps HTTP mapping in the presentation layer.

## Test coverage

Comprehensive. New delta logic (CAS failure writes, success-write CAS with a parallel-commit fake, revokeChain blocked-write race, rotation loser re-read) all has targeted tests: in-memory race fakes in `auth.test.ts`, and real-Postgres integration tests in `user.repository.test.ts` and `session.repository.test.ts` (skipped cleanly without `DATABASE_URL`). Route-level integration tests cover the proxy guard, origin check, rate limits, and OAuth round trip against the local mock provider; email tests assert the envelope handed to the transport rather than calling Resend; web components are covered with React Testing Library, `proxy.ts`/`route.ts` have their own suites, and `e2e/auth.spec.ts` (644 lines) exercises the flows end to end. The two minors above are the only logic paths I could not find a test for: a swallowed resend-email failure, and the replay-fetch-failure branch in the web auth proxy.
