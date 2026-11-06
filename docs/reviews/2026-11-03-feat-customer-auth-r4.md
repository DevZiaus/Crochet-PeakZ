# Review, feat/customer-auth, 2026-11-03

**Reviewed by**: big-pickle (fresh reviewer; author on deepseek-v4.1-flash-1017-basic)
**Scope**: 41 files in the uncommitted r4 fix round (on top of a 140 file branch diff vs `fe553dfe5801e69255e9f6d6de24a5a90be63b2a`), including the three new untracked test files. Vendored `.agents/skills/**`, `skills-lock.json`, `package-lock.json`, and `docs/reviews/**` were treated as install/review noise and not reviewed as application code.
**Verdict**: Approve with nits

## Summary

This is the fourth review of the customer auth branch. All 19 findings from r3 are fixed: rotation is now a single conditional transaction, the grace window requires an active successor, the Resend idempotency key is per issue, OAuth link tokens are cleared, resend and the remaining auth endpoints are throttled, unknown and locked logins pay the bcrypt cost, upstream calls have timeouts, sign-out no longer clears the local user on failure, the access cookie lifetime is derived, OAuth state is issuer/audience bound, and the proxy/admin redirect paths are allowlisted and preserve the query string. The four r3 test gaps now have real tests, including a concurrent-rotation test against Postgres that runs in CI.

No blockers or majors remain. The two Minors are a stale sign-out navigation on the web client and an idempotency key that can exceed Resend's 256 character cap for long addresses. The Nits are small robustness and consistency issues.

## Minor

### 🟡 Failed sign-out still navigates away, `apps/web/src/components/auth/auth-menu.tsx:115-119`

**Problem**: `signOut` in `apps/web/src/lib/auth/use-session.ts:61-77` correctly keeps the local user when the logout request fails, but it resolves with no result. The menu then runs `router.replace("/")` and `router.refresh()` unconditionally in `.then`, so a failed sign-out sends the customer to the home page as if it succeeded.
**Why it matters**: The r3 fix stopped the hook from lying about the local state, but the menu still lies to the user: they leave the account menu, land on the storefront, and the session cookie is still live. If they walk away believing they are signed out on a shared device, the next visitor is still signed in. There is also no error surfaced, so a transient failure looks identical to success.
**Suggested fix**: Have `signOut` return whether the server revoked the session (a boolean or a result object). In the menu, navigate and refresh only on success; on failure keep the user in place and show an error toast or inline message with a retry.

### 🟡 Resend idempotency key can exceed the 256 character limit, `apps/api/src/infrastructure/email/auth-email-templates.ts:87`

**Problem**: The key is built as `` `${template.keyPrefix}/${email.to}/${linkDigest(email.url)}` ``. The digest is 32 hex characters and the prefix is short, but `email.to` is the raw recipient address, and the shared schema allows addresses up to 255 characters (`packages/shared/src/schemas/auth.ts:48`). A near-limit address produces a key of roughly 300 characters, past Resend's documented 256 character maximum, so the send is rejected.
**Why it matters**: This is an edge case (very long but schema-valid addresses), but when it triggers, the customer cannot receive verification or reset mail at all, and the failure looks like a provider error rather than a validation problem. It is cheap to make impossible.
**Suggested fix**: Hash the recipient and the URL together into a fixed length key (for example `<prefix>/<sha256(email.to + url)>`), so the key is bounded regardless of address length. Add a test with a 255 character address asserting the key stays under the cap.

## Nits

- ⚪ `apps/api/src/presentation/auth/auth-middleware.ts:88`, `apps/api/src/presentation/auth/auth.routes.ts:256`, `apps/api/src/presentation/auth/auth.routes.ts:412`, `decodeURIComponent` is called on the raw cookie value. A malformed percent sequence throws, which reaches the error handler as a 500 instead of a 401. Wrap it and treat a decode failure as an absent cookie.
- ⚪ `apps/web/src/components/auth/require-role.tsx:46`, the client-side `/login?next=` redirect is built from `usePathname()` only, so the query string is dropped. The server proxy and admin layout preserve it, so the two paths disagree. Include `useSearchParams()` in the return target.
- ⚪ `apps/api/src/application/use-cases/oauth.ts:45-52`, `keepProvider` falls back to `profile.providerId` when `existing.providerId` is null. That stores the incoming provider's id while `authProvider` stays on the original provider, producing a mismatched pair. Keep null, or only fall back when the providers match.

## Strengths

- The rotation rewrite is the right shape: a conditional `where: { id, revokedAt: null }` update inside one transaction, with the successor created and linked only when exactly one row was revoked, and the zero-row case routed back through the grace/reuse logic. The concurrent-rotation test asserts the real Postgres behaviour rather than a mock.
- The grace window now requires the successor to still be active, which closes the reset/sign-out replay hole without widening the legitimate-retry window. The tests cover the grace-after-reset and grace-after-sign-out cases specifically.
- Security hardening is consistent across layers: throttling on logout, me, resend, and OAuth; dummy bcrypt on unknown and locked accounts; issuer/audience bound OAuth state; allowlisted proxy and admin return paths; timeouts on every upstream call.
- The Resend idempotency key is now per issue (prefix + recipient + link digest), which fixes the resend-after-invalidation failure while keeping genuine retries idempotent.

## Test coverage

Strong. The r4 round added the tests r3 asked for: concurrent rotation against real Postgres, grace after reset and after sign-out, resend idempotency, and failed sign-out. The three new untracked files (`session.repository.test.ts`, `use-session.test.ts`, `web-env.test.ts`) are meaningful behaviour tests, and CI provides Postgres plus migrations so the conditional database integration test runs there. `npm run typecheck` and `npm run test` pass (API 166 tests, web 187, shared 57). The two Minors above are the only new logic without direct coverage: a long-address idempotency key test and a failed-sign-out navigation test would close them.
