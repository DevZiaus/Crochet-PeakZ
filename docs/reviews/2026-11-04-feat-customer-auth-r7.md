# Review, feat/customer-auth, 2026-11-04

**Reviewed by**: GLM-5.3-Flash (author on deepseek-v4.1-flash)
**Scope**: ~233 files, feat/customer-auth vs main (merge base `fe553df`, includes uncommitted working tree and untracked test files; `.agents/skills/**` docs and `package-lock.json` excluded as churn)
**Verdict**: Approve with nits

## Summary

This round reviewed the full customer-auth slice end to end: domain entities, all eleven use cases, Prisma repositories, JWT/token services, email templates and sender, the thirteen API routes (rate limits, proxy guard, cookies), the Next.js auth proxy and route guards, shared schemas/sanitizers, and the E2E/integration/unit suites. The working tree changes refine the rotation race handling, repository write coverage, and web-side session plumbing; all were re-read in their current state. No blockers or majors: the concurrency-critical refresh logic, the enumerated-account defenses, and the cross-service trust boundaries are correct and well tested. Two nits below are polish only.

## Nits

- ⚪ `apps/api/src/presentation/auth/auth.routes.ts:318`, the OAuth `state` query value is compared against the state cookie with `!==` rather than a constant-time compare. It is not exploitable — the value is independently verified as an HMAC-signed JWT at line 329, and the cookie is HttpOnly — but `proxy-guard.ts` set the precedent of `timingSafeEqual` for secret comparisons, so matching that style here would be consistent.
- ⚪ `apps/api/src/presentation/auth/auth.routes.ts:458`, `providerId: profile.id ?? ""` stores an empty string when a provider profile omits `id` instead of `null` (the column is nullable, and `signInWithOAuth` later persists it back on same-provider sign in). Both configured providers always send `id`, so this is theoretical; mapping a missing id to `null` would keep the column semantics clean.

## Strengths

- Session rotation is genuinely atomic: the repository claims the current token inside a transaction (`apps/api/src/infrastructure/database/session.repository.ts`) so two concurrent refreshes cannot both rotate, and the reuse-detection/grace-window rules live in the `Session` entity with exhaustive boundary tests (`apps/api/src/domain/entities/session.test.ts:18-45`), including a real-PostgreSQL race test and an end-to-end rotate → grace replay → reuse-revokes-all integration test (`apps/api/src/presentation/auth/auth.integration.test.ts:149-186`).
- The login path is enumeration-resistant throughout: dummy bcrypt compare for unknown emails, a uniform 202 for password reset regardless of account existence, uniform resend behavior keyed by email, and the reset/verification email content never confirms an account exists.
- Token digests are stored as HMAC-SHA256 keyed by `JWT_REFRESH_SECRET` — a deliberate strengthening over the spec's plain SHA-256 — and email links follow the same scheme; the E2E fixture reproduces the exact digest so browser tests drive the real link without a mailbox (`e2e/support/auth-database.ts:84-89`).
- The trust boundary between web and API is enforced in depth: the proxy guard requires the shared secret (timing-safe compare that survives truncated input) plus a strict same-origin check for writes (`apps/api/src/presentation/auth/proxy-guard.ts`, `proxy-guard.test.ts` covers lookalike origins and missing/empty origins), while the web proxy keeps an endpoint allowlist, body cap, timeouts, deletes any incoming `x-auth-role` header before setting its own, and refreshes+replays on a 401 so a single page load can't lose a session race.
- Environment validation is fail-fast with real teeth: minimum lengths, distinct secrets, placeholder rejection, absolute-URL checks, and production rejection of the six test-only mock-provider overrides (`apps/api/src/config/env.ts`, all locked in by `env.test.ts:20-135`).
- The shared `sanitizeNextPath`/`resolvePostSignInPath` pair is used by both the API OAuth state and every web entry point, with open-redirect tests covering protocol-relative URLs, backslashes, encoded auth screens, and the `/administrator` vs `/admin` prefix trap (`packages/shared/src/auth/next-path.test.ts`).

## Test coverage

Coverage is extensive and, more importantly, aimed at the right risks. Domain and application logic is unit tested without infrastructure mocks; repository mapping, the rotation race, all 13 routes (including rate limits driven with explicit client IPs), and the full OAuth round trip are integration tested against real PostgreSQL via the in-process mock provider, so no test ever reaches live Google, Facebook, or Resend (email tests assert the exact envelope handed to the transport). The web side has component tests for every auth surface, proxy behavior tests, and unit tests for the new cookie/client-ip/web-env helpers; the Playwright suite drives the real browser→proxy→API→DB path with per-test client IPs to avoid rate-limit bucket collisions. Remaining untested surface is minor and documented: the in-memory rate limiter's internal pruning is only exercised indirectly through route tests, and the >10k-key prune behavior is untested — acceptable given the limiter is an explicitly documented per-instance tradeoff. Nothing in the new logic is materially uncovered.
