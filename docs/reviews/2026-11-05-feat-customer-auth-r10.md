# Review, feat/customer-auth, 2026-11-05

**Reviewed by**: GLM 5.3 Flash (author on deepseek-v4.1-flash)
**Scope**: 62 files, feat/customer-auth vs fe553df (uncommitted worktree; `docs/reviews/**` churn and `nextStep.txt` excluded)
**Verdict**: Approve with nits

## Summary

Round 10 of the fresh-eyes review of the customer-auth feature. Every r9 finding is verified fixed in the working tree: the reuse cascade now keys on `replacedByTokenId !== null` (`session.ts:143-149`), token indexes ship with a migration, the OAuth state compare is timing-safe, `providerId` is nullable, the lock counter resets on verify/reset-success, the deployment quick start uses `openssl rand -hex 32`, and `logLinks` is dev-only. The feature remains high quality end to end; the two remaining minors are concurrency edge cases (logout vs. rotation, login counter under race), neither of which is urgent.

## Minor

### 🟡 Sign out can leave the rotation chain alive when the presented row was already rotated, `apps/api/src/application/use-cases/logout.ts:19-27`

**Problem**: `logoutSession` resolves the session behind the presented refresh cookie and revokes only that one row. If the cookie belongs to a row that concurrently rotated — two tabs where tab A's refresh already replaced the row tab B still holds — the row found by `findByTokenHash` is already revoked **with** `replacedByTokenId` set, and plain `revoke(session.id)` follows no successor. The live successor keeps working, so AC-7's "leaves the browser signed out" does not hold for the device holding the successor token. A second wrinkle: `revoke()` in `session.repository.ts:84-89` writes `revokedAt: now` unconditionally, so signing out on an already-rotated row also overwrites the original rotation timestamp — which `isWithinRotationGrace` (`session.ts:120-129`) compares against, slightly extending the window in which a replay of the stale token is treated as a benign concurrent refresh instead of reuse.

**Why it matters**: sign out is the user-visible guarantee that this browser session is dead; the multi-tab case is exactly the state rotation itself creates, so the gap is reachable in normal use. The `revokedAt` overwrite weakens reuse detection for that token in the same window. Impact is bounded (the successor chain is the same account, and the stale token itself is dead either way), so this is real but not urgent.

**Suggested fix**: in logout, when the found row has `replacedByTokenId`, revoke the successor chain as well (walk the `replacedByTokenId` links), and make the revoke conditional — an `updateMany` guarded by `revokedAt: null` — so sign out never rewrites an existing revoke timestamp.

### 🟡 Account lock counter is read-modify-write; concurrent attempts can lose increments, `apps/api/src/application/use-cases/login.ts:58-64`

**Problem**: `recordFailedLogin` bumps the counter on the in-memory entity loaded by a single `findByEmail`, then `saveLoginState` writes the absolute value back. Two concurrent failed logins both read count N and both write N+1, losing one increment; the success path (`login.ts:75-80`) can similarly interleave with a concurrent failure and clobber a count. The counter and lock update is also a standalone write, not part of any transaction.

**Why it matters**: the five-failure / 15-minute lock is a security control against brute force; lost increments stretch the effective attempt budget, and an attacker driving parallel sign-in requests keeps the counter below the threshold longer. It is bounded — the lock still triggers eventually and the route is rate limited — which keeps this at Minor rather than Major.

**Suggested fix**: persist the counter as an atomic increment in the repository (an `updateMany` with `{ failedLoginAttempts: { increment: 1 } }`, plus the computed lock conditionally), or re-read-and-claim conditionally inside `saveLoginState` so a concurrent writer cannot clobber a newer count.

## Nits

- ⚪ `apps/web/src/lib/auth/use-session.ts:12`, the `refresh` action exposed by `useSession` has no production caller — components re-validate with `router.refresh()` after mutations instead. Wire it up where a stale session value needs re-reading, or drop it (with its test stubs) until there is a consumer.
- ⚪ `apps/api/src/domain/entities/session.ts:120`, `isWithinRotationGrace` is correct but its proximity to `isReuse` makes the two easy to confuse after refactors; a one-line comment on the timeline (rotated at, grace until) would help future readers.

## Strengths

- Session rotation is claimed atomically: a single Postgres transaction creates the successor and flips the old row, and `rotate()` drops its own successor when another request wins the race, keeping exactly one live chain — proven with a real-database concurrency test (`session.repository.test.ts`).
- Enumeration-resistant sign in: identical bcrypt work and identical 401 for unknown addresses, DUMMY hash for OAuth-only accounts, fixed lock behavior that a locked attempt never extends (`login.ts:32-56`).
- Deep, well-tested web↔API trust boundary: proxy secret plus forced origin on auth calls, client IP relay, and refresh-once-replay-once semantics are all pinned by integration tests on both sides (`proxy.test.ts`, `route.test.ts`).
- Fail-fast env validation, including rejecting the dev-only OAuth provider overrides when `NODE_ENV=production`.
- Layered test pyramid with real coverage: domain rules per row (grace, reuse, lock expiry), 11 use cases, repository tests against real Postgres (duplicate-email translation, nullable `providerId`), OAuth round trip against the local mock provider, and an E2E spec walking every AC.

## Test coverage

Tests pass in the worktree: API 178 (14 files), web 207 (27 files), shared 57 (4 files); `npm run typecheck` green. New logic is well covered — the r9 regressions (signed-out replay → neutral invalid session; lock counter reset) both have dedicated tests, and the rotation race has a real-database test. Deliberately untested edges match the two minors: no test exercises signing out when the presented row already has a successor, and the concurrent-login counter race is not covered (hard to do against the in-memory fakes; an integration test with two parallel requests against real Postgres would pin both). Everything else on the AC list, including cookies, rate limiting, proxy replay, OAuth state, and guard behavior, has direct test evidence.
