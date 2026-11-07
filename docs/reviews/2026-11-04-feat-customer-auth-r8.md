# Review, feat/customer-auth, 2026-11-04 (round 8)

**Reviewed by**: GLM-5.3-Flash (fresh reviewer, round 8)
**Scope**: 143 tracked files + 5 untracked test files, feat/customer-auth vs main (merge base `fe553df`, includes uncommitted working tree; `package-lock.json` and `.agents/skills/**` excluded as churn)
**Verdict**: Changes requested
**Round context**: r7 (same day) concluded "Approve with nits" on a smaller diff. Round 8 re-read the full change set in the current working tree and found one new Major in the refresh/reuse cascade. Both r7 nits remain unaddressed and are re-raised below.

## Summary

This round re-reviewed the entire customer-auth slice in its current state: all 11 use cases, domain entities and rules, repositories, token/email services, the 13 API routes with their guard and rate-limit layers, the Next.js auth proxy and route guards, shared schemas, the deploy topology configs, and the full unit/integration/E2E suites (all run locally this round; everything passes). No blockers. One Major: the refresh path treats _any_ revoked token as "reuse" and cascades an account-wide revocation, which is broader than the spec's definition of reuse and converts a dead (signed-out) refresh token into a permanent, session-wide kill lever. Two minors and five nits follow.

## Blockers

None.

## Major

- 🔴 **Signed-out (or any revoked-without-successor) refresh tokens trigger the account-wide reuse cascade** — `apps/api/src/application/use-cases/refresh.ts:43-51`, mirrored in the rotate-race re-read at `:66-77`, underpinned by `apps/api/src/domain/entities/session.ts:138-140`.

  The spec scopes reuse precisely (`docs/specs/0005-customer-auth/index.md:163`): "Reuse means presenting a token whose row is revoked **and has a successor**, more than 10 seconds after that rotation." But the entity's `isReuse(now)` is `isRevoked() && !isWithinRotationGrace(now)` — it never checks `replacedByTokenId` — so any revoked row outside the grace window counts, including rows revoked at sign out, which have no successor. In the use case, a replayed signed-out token fails `issueFromGrace` (it returns `null` precisely because there is no successor, `refresh.ts:113`) and then falls through to `deps.sessions.revokeAllForUser(...)` at `refresh.ts:49`. The request does fail closed with 401, but the response also kills **every active session for the account**.

  Two concrete consequences:

  1. _Permanent DoS lever._ An attacker who once captured a refresh token (old device compromise, log leak, backup) keeps a working account-wide session-kill capability forever, even after the victim signs out that device. Each replay of the dead token revokes all sessions, including new ones established after the previous kill. Under the spec's definition the dead token would earn a bare 401 and never harm sessions created after it.
  2. _Benign sign-out race._ A same-device refresh already in flight (second tab, service worker, a request that read the cookie just before sign-out cleared it) can land while sign out is revoking the row — or lose the `rotate` race to a concurrent sign-out (`refresh.ts:63-77` reaches the same cascade at line 74). The user's other devices are then signed out too, because of the user's own sign-out. The grace window exists specifically "so two tabs cannot sign the customer out everywhere" (index.md:163); this path reintroduces that failure through a different door.

  Note the deviation is pinned as intended behavior by the docs and tests: `refresh.ts:9-14` says "Once sign out or a password reset revokes the chain … Outside that window it is reuse: every session for the account is revoked", and `apps/api/src/domain/entities/session.test.ts:47` asserts "treats a revoked session without a successor as reuse immediately". There is no test that drives a _signed-out_ token through the refresh use case or route, so the cascade's blast radius is unexercised.

  **Suggested fix**: make the successor a requirement of reuse, in one place. In `Session`, define `isReuse(now)` as `isRevoked() && replacedByTokenId !== null && !isWithinRotationGrace(now)` (and update `session.test.ts:47` accordingly). Then `refresh.ts` can keep its shape — for a revoked row with no successor, `issueFromGrace` returns `null` and the fall-through throws the neutral `invalidSession()` 401 without cascading. The mirrored race branch at line 74 gets the same correction for free. Revoked rows _with_ a successor whose successor is dead (password reset consumed the chain, or the successor was itself replayed) continue to cascade, which is the spec-intended protection. Update the `refresh.ts:6-19` JSDoc to match. Password-reset scenarios are unaffected: `reset-password.ts:42` already revoked everything, so a post-reset cascade is a no-op; sign-out is the only behavior-changing path. Alternatively, if the team deliberately wants "replay of any dead token kills the account", that is a defensible-but-harsh stance — but then it must be recorded in spec 0005 (which currently says the opposite), not silently deviated from. A regression test is warranted: sign out, replay the cookie after the grace window, expect 401 **and** other sessions still active.

  Severity: Major, not Blocker — it fails closed, does not bypass any credential check, and exploitation requires a previously captured token that is already dead.

## Minors

- 🟡 **Unindexed token-hash lookups on `users`** — `apps/api/src/infrastructure/database/user.repository.ts:42-55` runs `findFirst` on `emailVerificationToken` / `passwordResetToken` (`prisma/schema.prisma:24,27`, both `VarChar(255)`, no `@@index`). Traffic is low (one lookup per verification/reset click), and the generic `sha256Hex` helper even exists for repository tooling, but the columns are also written by resend flows; a plain index (optionally partial `WHERE IS NOT NULL`) keeps those probes off seq scans as the users table grows.
- 🟡 **Doc drift: comments say "SHA 256", the implementation is HMAC-SHA256 keyed with a secret** — six sites call the stored digest a plain SHA-256 hash while `hashOpaqueToken` computes an HMAC (`apps/api/src/domain/ports/token-service.ts:32`, `domain/ports/session-repository.ts:21`, `domain/ports/user-repository.ts:46,48`, `application/use-cases/issue-session.ts:9`, `domain/entities/session.ts:49`). All token paths (refresh, verification, reset) hash through this keyed function, and spec 0005's invariant also says SHA-256. The keyed digest is a genuine strengthening — keep it, but say so: "HMAC-SHA256 keyed with a dedicated secret" in these comments and the spec line. (`jwt-token-service.ts:106` is accurate as-is; that helper really is plain SHA-256.)

## Nits

- ⚪ r7, still open: `apps/api/src/presentation/auth/auth.routes.ts:318` compares the OAuth `state` query against the cookie with `!==` instead of a timing-safe compare. Not exploitable (the value is independently verified as an HMAC-signed JWT at line 329, and the cookie is HttpOnly), but `proxy-guard.ts` sets the `timingSafeEqual` precedent for secret comparisons; matching it would be consistent.
- ⚪ r7, still open: `apps/api/src/presentation/auth/auth.routes.ts:458` maps a provider profile without an `id` to `providerId: ""` instead of `null` (the column is nullable, and same-provider sign-in later persists it back). Both configured providers always send `id`, so theoretical — but `null` keeps the column semantics clean.
- ⚪ `apps/web/src/components/auth/oauth-buttons.tsx` hardcodes raw hex brand colors (e.g. Google/Facebook marks) where the design system prefers tokens. Brand marks are arguably exempt by `apps/web/AGENTS.md`/`design.md` rules; if the team agrees, note the exemption here or in `design.md` so the next reviewer doesn't re-flag it.
- ⚪ `apps/web/src/components/header.test.tsx` renders `<Header>` → `AuthMenu` with an un-stubbed `fetch`, producing ECONNREFUSED/ECONNRESET noise in every vitest run (observed while running the suite; all tests still pass). Stubbing `fetch` or the `useSession` hook would quiet the output.
- ⚪ In the self-hosted no-edge topology (docker-compose `:8080` direct, no proxy in front of the API), every rate-limited bucket collapses to a single "unknown" client — effectively a per-instance global limit. This is a documented, deliberate assumption (`apps/web/src/lib/auth/client-ip.ts`, docker-compose and `docs/deployment.md` notes), so no change is requested; ideally the README/deploy note would also say "put a proxy in front if you want per-client limits".

## Strengths

- Rotation is honestly atomic: the repository claims the current token inside a transaction so two concurrent refreshes cannot both rotate (`apps/api/src/infrastructure/database/session.repository.ts`), with a real-PostgreSQL race test beside it (untracked `apps/api/src/infrastructure/database/session.repository.test.ts:56`) plus entity-level boundary tests for the grace window.
- The login path is enumeration-resistant end to end: a valid dummy bcrypt compare for unknown emails (this round verified the `DUMMY_PASSWORD_HASH` constant is a real hash whose preimage is unreachable through any acceptance path), uniform 401/202 shapes, and email content that never confirms account existence.
- Refresh/verification/reset digests are HMAC-SHA256 keyed with a dedicated secret rather than the spec's plain SHA-256 — a real strengthening — and the E2E fixture reproduces the digest so browser tests drive real links without a mailbox (`e2e/support/auth-database.ts:84-89`).
- The web↔API trust boundary is deep: proxy-secret timing-safe compare that survives truncation, endpoint allowlist, 1 MB body cap, timeouts, Origin checks at both layers, and any incoming `x-auth-role` header deleted before the proxy sets its own (`apps/web/src/proxy.ts:235`).
- Env validation is fail-fast with real teeth — minimum lengths, distinct secrets, placeholder rejection, absolute-URL checks, production refusal of the six mock-provider overrides (`apps/api/src/config/env.ts`).
- Tests are aimed at the right risks and all pass: api 14 files / 176 tests, web 27 files / 207 tests (shared included) — no mocks at the domain/application layer, real PostgreSQL for repository and route integration, and an in-process OAuth mock so nothing touches live Google, Facebook, or Resend.

## Test coverage

Everything runs green in this round's working tree (vitest counts above; all 5 previously-untracked spec-focused test files now in place, including the Postgres rotation-race test). The E2E suite (`e2e/auth.spec.ts`) drives the real browser → proxy → API → PostgreSQL path with per-test forwarded IPs to avoid rate-limit bucket collisions. The only observed noise is the header test's un-stubbed `fetch` (nit above). Material gaps: the signed-out-token replay path is untested at the use-case/route level (see Major), which is exactly where behavior is changing.
