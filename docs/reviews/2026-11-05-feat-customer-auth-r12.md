# Review, feat/customer-auth, 2026-11-05

**Reviewed by**: GLM-5.3-Flash Free (fresh-eyes reviewer for /check review r12; author on deepseek-v4.1-flash:free)
**Scope**: ~230 files, branch vs base (merge base `fe553df`, including uncommitted tracked changes and the seven untracked files: the `20261105120000_user_token_indexes` migration, `apps/web/src/instrumentation.ts(+test)`, `session.repository.test.ts`, and four web test files)
**Verdict**: Approve with nits

## Summary

Round 12 re-read the full branch with priority on the newest delta. Verified every open finding from r11 (and the carry-overs from r8/r10) is now fixed in the working tree: Facebook sign in refuses an unverified email exactly like Google, single-use verification/reset tokens are consumed with guarded writes (the reset is one transaction tied to session revocation), the OAuth `state` is provider-bound (and iss/aud separated from access tokens), web auth env validates at boot via `instrumentation.ts`, and the `x-auth-role` trust boundary is pinned by three dedicated proxy tests. The new download since r11 (CAS refresh rotation, certificate-of-ownership logout chain walk, lock counter CAS, provider-pair preservation, rate limits on previously bare routes, error handler 4xx pass-through, idempotency-key bounding) is coherent and well covered. I could not find any blocker or new major; one residual concurrency edge in the logout chain walk remains.

Verified fixed (with evidence):

- **r11 Major — Facebook email verification**: `toOAuthProfile` now requires `verified === true` for Facebook (Google keeps `email_verified !== false`), an `email_unverified` error code was added end to end (shared `OAUTH_ERROR_CODES`, callback message, spec AC-8 and invariant updated), the mock provider emits `verified`, and the integration suite asserts "refuses a Facebook email the provider has not verified (M1)" (`oauth.integration.test.ts`). The provider-pair rule also now never rewrites one provider's name with another's id (`oauth.ts`).
- **r11 Minor — race-safe token consumption**: `saveVerified(userId, tokenHash)` and `completePasswordReset({..., tokenHash})` are conditional writes (`updateMany` guarded on the stored digest; count 0 → invalid link), the latter tying hash-swap + lock clear + session revocation into one transaction. Covered by unit tests (single-use invalidation, parallel-write winner) and real-PostgreSQL repository tests.
- **r11 Minor — provider-bound OAuth state**: `OAuthStateClaims` carries `provider`, verified against the route in `handleOAuthState`/`handleOAuthCallback`, plus `iss`/`aud` claims separating state from access tokens, plus a padded timing-safe query⇄cookie comparison. Spec updated.
- **r11 Minor — web env fail fast**: `apps/web/src/instrumentation.ts` calls `getWebAuthEnv()` at server start (nodejs runtime, skipped during `phase-production-build`), with three tests covering build/edge/runtime guards.
- **r11 Minor — `x-auth-role` trust boundary tests**: `proxy.test.ts:178-207` pins "ignores a client supplied x-auth-role when there is no session", "refuses a CUSTOMER even when they claim x-auth-role: ADMIN", and "overwrites a forged x-auth-role with the role the API proved"; `admin/layout.test.tsx` covers the fall-through to the API role read.
- **r10/r8 carry-overs**: sign out now revokes the whole successor chain via `revokeChain` with a `revokedAt: null` guard (no grace-window overwrite); the failure counter is CAS-gated (`saveFailedLogin`) with a re-read retry loop; `isReuse` requires a successor (r8 Major, fixed by `replacedByTokenId !== null` and now tested for sign-out and reset replay); the token-hash columns are indexed by the new migration; docs/spec say HMAC-SHA256.

## Minor

### 🟡 The logout chain walk can miss a successor created in flight — `apps/api/src/infrastructure/database/session.repository.ts:84-110`

**Problem**: `revokeChain` walks by reading `replacedByTokenId`, then conditionally revoking, then following the value just read. A concurrent `rotate` on a mid-chain row can claim the row between the walk's read and its `updateMany`: the read returned `replacedByTokenId: null`, the rotation then sets `revokedAt` + `replacedBy: S2` (the walk's guarded write to that row becomes a no-op because `revokedAt` is no longer null), and the walk terminates on the stale `null` link — leaving the freshly rotated successor S2 live after the user signed out. The residual window is milliseconds (second tab refreshing at the exact moment of sign out) and this is the last surviving sliver of the r10 logout race, which was otherwise closed; the code already inspects `claimed.count` in `rotate` but does not act on a count of 0 here.

**Why it matters**: AC-7's "sign out leaves the browser signed out" can silently fail for the device holding the successor token, and the surviving chain is indistinguishable from a normal session in the DB. Narrow reachability keeps this out of Major.

**Suggested fix**: when the guarded `updateMany` returns `count === 0` during the walk, re-read `replacedByTokenId` and continue from the new value (the row was claimed between read and write — that is the only way to get 0 on an unrevoked target loop, so one bounded re-read per row closes the window). Alternatively move the traversal into one SQL statement (a recursive CTE or chain-anchor fetch) inside a transaction.

## Nits

- ⚪ `apps/api/src/application/use-cases/login.ts:117-122`, the success path still persists the counter absolutely (`saveLoginState` with `failedLoginAttempts: 0`, no CAS): a concurrent failure write can be clobbered after a win. Harmless in practice (a successful sign in already proves the password and clearing the lock is intended), but it is the one branch r10's race-fix did not symmetrise; a `saveFailedLogin`-style CAS here or a plain `updateMany` that touches only `lastLoginAt` when the counter is already 0 would remove the asymmetry.
- ⚪ `apps/api/src/application/use-cases/login.ts:32-55`, `recordFailedLogin` drops the increment silently when all three CAS rounds lose to a parallel burst (three concurrent failures could under count by up to two). Bounded by the IP limit and the lock still forming under load; worth a comment recording the deliberate trade-off, or bump the attempts.
- ⚪ `apps/api/src/presentation/auth/auth.routes.ts:268-271`, `startOAuth`'s JSDoc still says the state carries "a nonce and the relative `next`" — it now carries `provider` as well.
- ⚪ `apps/web/src/app/api/auth/[...path]/route.ts:145`, the write gate is `method !== "GET" && method !== "HEAD"`, so a stray `OPTIONS` is treated as a write (origin check + body read). Browsers do not preflight same-origin fetches so it is unreachable in practice, but an explicit small set (`POST`/`PUT`/`PATCH`/`DELETE`) or an early 405 for `OPTIONS` would make the contract exact.

## Strengths

- The rotation claim is honest about its failure paths: `rotate` creates the successor first, claims the predecessor with a conditional write inside the transaction, and deletes its own successor when it loses (`session.repository.ts:52-81`), and a real-PostgreSQL concurrency test (`session.repository.test.ts:56-98`) plus the gone-after-sign-out/reset grace tests (`auth.test.ts`) pin exactly the state machine the spec draws.
- The security-relevant delta since r11 was closed with tests everywhere it matters, including the ugly ones: body-parser 400 pass-through, malformed-cookie 401s, forwarded-for last-hop semantics, resend throttling for unknown addresses, Facebook unverified refusal, and the forged-role overwrites on both proxy layers.
- `instrumentation.ts` is the right fix for the r11 startup gap: it validates at boot, and the build-phase and edge-runtime guards are themselves tested so the build cannot regress on a machine without the runtime env.
- Operational affordances kept improving: per-route rate limits expanded to cover the previously bare routes (verify, reset, logout, `/me`, OAuth round trip), compose now binds 3000/4000 to loopback with reasons written beside them, and `docs/deployment.md` spells out the one-trusted-edge assumption in both directions.

## Test coverage

Ran in this round's working tree: typecheck green, web 213 tests (28 files), api 190 tests (14 files), shared 57 tests (4 files), all passing; the api suite includes the real-PostgreSQL integration tests and both OAuth round trips against the local mock provider. The newest untracked/changed tests are meaningful, not checkbox tests — the proxy role-claim tests assert on the actual forged header behaviour, the counter race test drives two parallel writes through the real fakes, and the grace-revocation tests walk the sign-out/reset/rotation triads. Untested or under-tested: only the `revokeChain` walk race this review found (hard to reach from a unit test, easy from the same real-database pattern as the rotation race test); the login-success-write nits above; and Caddy/nginx routing which remains a manual `/check verify` step per the verify checklist.
