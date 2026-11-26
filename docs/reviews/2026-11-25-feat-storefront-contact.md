# Review, feat/storefront-contact, 2026-11-25

**Reviewed by**: a fresh context reviewer in this environment. The client does not expose reviewer model selection, so the cross model pairing the workflow prefers could not be enforced here.
**Scope**: 114 files, branch vs `main` (merge base `1a3699f9`). Depth concentrated on `048a252` (fix: harden proxy hops, contact E2E, Resend warning, and auth docs) over `98d054b`, 39 files, plus verification of every open item from the 2026-11-24 review.
**Verdict**: Approve with nits

## Summary

`048a252` closes every open item from the 2026-11-24 review in code, not only in the commit message: spec 0005 now describes the hop and trusted header rules that actually run, the hero logo attribution is corrected in both files, the trusted hop count is configurable on each tier with a secret authenticated `x-proxy-client-ip` for router hops in between, and a real Playwright spec now drives the contact path. I checked each claim against the implementation, ran both contact E2E projects against locally started built servers (both passed), and ran the full unit suite (API 320, web 493, shared 85, zero failures). What remains is small: one test path can still reach live Resend when Playwright reuses a dev server, the new test transport is missing from the env examples, one PaaS hop recommendation lacks the origin access precondition its VPS twin states, and spec 0005's rationale repeats a paragraph verbatim. Nothing here blocks merge.

## Prior review verification (2026-11-24)

- 🟡 **Spec 0005 still documents the first entry client IP rule** → **Fixed.** `docs/specs/0005-customer-auth/index.md:137` now states that the proxy resolves the visitor IP through `readClientIp` at `TRUSTED_PROXY_HOPS` (default `1`, falling back to `X-Real-IP` or `"unknown"`), sends it in `x-proxy-client-ip` with the secret, and that `getClientIp` trusts that header once the secret matches or else selects the `TRUST_PROXY` hop. That matches `apps/web/src/lib/auth/client-ip.ts:55-74` and `apps/api/src/presentation/auth/proxy-guard.ts:77-109`. The proxy contract paragraph at `index.md:117` was updated the same way.
- 🟡 **Hero logo misattribution** → **Fixed.** `apps/web/AGENTS.md:81` and `docs/specs/0003-design-system/index.md:63,132` now say `BrandLogo` covers the header, footer and auth layout, `AdminLayout` renders `logo.webp` inline, and the home hero renders `logo-square.webp` directly. The code agrees (`(storefront)/page.tsx:129`, `admin-layout.tsx:92,253`, `(auth)/layout.tsx:53`), and `logo-square.webp` was removed from the "remaining variants" list because the hero uses it.
- 🟡 **Last hop keying collapses every bucket behind a CDN** → **Fixed by design, and the fix is tested.** The hop count is explicit on both tiers (`TRUST_PROXY` numeric through `getTrustedProxyHops`, `apps/api/src/config/env.ts:523-529`; `TRUSTED_PROXY_HOPS` through `getTrustedProxyHops`, `client-ip.ts:15-40`), both selectors clamp to the earliest entry for short chains, and the authenticated `x-proxy-client-ip` removes the dependence on how many routers sit in between. `contact.routes.test.ts:264-385` proves two visitors behind one Cloudflare edge keep separate buckets at two hops, and that a forged `x-proxy-client-ip` without the secret is ignored in favour of the `X-Forwarded-For` bucket.
- 🟡 **No end to end coverage of the contact path** → **Fixed and verified here.** `e2e/contact.spec.ts` drives a real browser through the real Next route to the real Express limiter: footer and `/data-deletion` entry points, topic preselect, inline validation with no network post, a 200 with the success copy, a 429 with `Retry-After` and the wait copy, and axe before and after submit. I ran it on both projects against built servers: desktop 2 passed in 22.4 s, mobile 2 passed in 13.1 s.
- Nits from the last round: the nginx body caps are **fixed** (an exact `/api/contact` location at 20 KB and 1 MB for auth, `deploy/nginx.conf.example:30-54`); the "honest browsers" wording is **fixed** (`docs/deployment.md:89`); the Resend warning scope is **fixed** (it now keys on the sender domain and distinguishes the default inbox, `env.ts:252-285`, tested); the absent `Origin` allowance (`apps/web/src/app/api/contact/route.ts:32`), the upstream `origin` overwrite (`route.ts:125`), the hero visual pass and the `themeColor` note are **unchanged and still carried**. I did not reopen them.

## Minor

### 🟡 The contact E2E can still reach live Resend when it reuses a dev server, `playwright.config.ts:57-59` and `e2e/contact.spec.ts:11-14`

**Problem**: The log transport is injected only through the API `webServer.env` block (`playwright.config.ts:57-59`). With `reuseExistingServer: !process.env["CI"]` (`:53`), Playwright does not start that command when something already answers on port 4000, so a `npm run dev` API keeps whatever transport its own environment provides. Both tests submit real messages: once in the first test and five times plus the browser attempt in the second. On that path the API either sends real mail or fails hard. This checkout has a live `re_` key in `apps/api/.env` with `CONTACT_EMAIL` unset, and `personalNotes.txt` records the Resend account in test mode, so on this machine a reused dev server rejects the send, the relay returns 502, and the first test fails at its `200` assertion with nothing pointing at the cause. The spec header also states the transport is set by `playwright.config.ts`, which is not true on the reuse path.
**Why it matters**: the project rule is that email tests must never call live Resend. This is the one place a test can, and the other outcome is a confusing failure that invites someone to weaken the assertion instead of the setup.
**Suggested fix**: make the invariant checkable rather than remembered. For example surface the active contact transport on `/api/health` outside production, or return a test header from the contact route, and have the spec fail early with a clear message when it is not `log`. Setting `reuseExistingServer: false` for the API server also closes it, at the cost of a build per run. Keep the README note either way.

### 🟡 The new contact transport variable is missing from the env examples, `apps/api/.env.example:47-50`

**Problem**: `CONTACT_EMAIL_TRANSPORT` is documented in `docs/deployment.md:311` but appears in no `.env*.example` file, while the root `AGENTS.md` requires new runtime variables to be documented in the `.env*.example` files and `docs/deployment.md`. Separately, `.env.docker.example:52` places the web only `TRUSTED_PROXY_HOPS` inside the block whose comment says every value is required and the API refuses to start without it (`.env.docker.example:37`), which is not true of that variable.
**Why it matters**: a developer or operator who works from the example files cannot discover the override, and the docker example implies the API needs a variable only the web reads.
**Suggested fix**: add a commented `CONTACT_EMAIL_TRANSPORT` line beside `CONTACT_EMAIL` in `apps/api/.env.example`, marked test only and rejected in production, and move `TRUSTED_PROXY_HOPS` into a web section or reword that block comment.

### 🟡 The PaaS two hop advice omits the origin access precondition, `docs/deployment.md:187-190`

**Problem**: the VPS section requires restricting ports 80 and 443 to Cloudflare before trusting two hops (`docs/deployment.md:192-195`). The Render/Heroku bullet instead recommends `TRUST_PROXY=2` when browsers call the API subdomain through the orange cloud proxy, with no requirement that the platform hostname stop answering direct requests. At two hops a caller who reaches the origin hostname directly can put an arbitrary prefix in front of the address the platform router appends, so the app reads the caller supplied value. Each request can then claim a fresh contact bucket.
**Why it matters**: that quietly turns five contact messages per 15 minutes into no limit, the same class of failure this branch has fixed twice. Auth stays behind the proxy secret, so the exposure is contact mail abuse rather than account access, which is why this is a Minor.
**Suggested fix**: add the same requirement to the PaaS bullet (disable or firewall the platform hostname and serve the API only through Cloudflare), or say plainly that `TRUST_PROXY=2` is safe only when direct access to the origin hostname is blocked.

### 🟡 Spec 0005 rationale repeats the new Facebook paragraph, `docs/specs/0005-customer-auth/rationale.md:85` and `:87`

**Problem**: the paragraph that records the Facebook `User.email` premise, the decision not to add a confirmation step, and the follow up appears twice, word for word.
**Why it matters**: this is the decision record a future agent or an `/architect` run trusts when touching OAuth linking. A duplicated block reads as a merge slip and doubles the text that must stay accurate.
**Suggested fix**: delete one copy.

## Nits

- ⚪ `apps/web/src/app/api/contact/route.ts:128`, the contact relay reads `PROXY_SHARED_SECRET` straight from `process.env` while the auth relay uses the validated `getWebAuthEnv().proxySharedSecret`; sharing the accessor keeps the two relays from drifting.
- ⚪ `e2e/contact.spec.ts:173,222`, `origin` is hardcoded to `http://localhost:3000` although the base URL comes from config; read it from the base URL so a port change does not break the direct posts.
- ⚪ `e2e/contact.spec.ts:23`, `CONTACT_MIN_WAIT_MS` is a magic 3,500 ms tied to `CONTACT_MIN_FILL_TIME_MS` in `packages/shared`; a comment naming that constant, or deriving the value plus a margin, keeps the wait honest if the shared threshold changes.
- ⚪ `apps/api/src/config/env.ts:71`, `contactEmailTransport` is typed optional although the parser always returns a value, which forces readers to handle an `undefined` that cannot occur.
- ⚪ `apps/api/src/infrastructure/email/resend-contact-email-sender.ts:29`, the `transport` option still says "for unit tests" although the composition root now uses it for the E2E log transport.
- ⚪ `deploy/Caddyfile:8-15` (found in the second pass, see Coverage below), Option A tells the operator to add a global `servers { ... }` block. `servers` is a global option, so it has to sit inside the top level `{ }` block above the site address, and `client_ip_headers` needs Caddy 2.8 or later. Copied literally the snippet is rejected when Caddy starts, which fails loudly rather than silently, and the two tier advice it encodes is right.

## Strengths

- The hop fix is layered and honest about its assumption: an options object whose default preserves the old behaviour, the same clamp on both tiers for short chains, and a secret authenticated header that removes the router count from the equation. The tests pin the discriminating cases rather than the happy path, notably that a forged `x-proxy-client-ip` without the secret falls back to the `X-Forwarded-For` bucket instead of earning a fresh one (`contact.routes.test.ts:331`).
- The contact spec is a genuine end to end test: real browser, real Next route, real Express limiter, axe before and after submit, and assertions on the 429 copy and on the message surviving the failure. I ran it against built servers on both projects and it passed, with the API log confirming the log transport and no Resend call.
- The Resend warning change answers the old nit precisely: it keys on the sender domain, distinguishes the default inbox from a custom one, stays a pure tested helper, and the composition root suppresses it while the log transport is active (`apps/api/src/index.ts:79-85`).
- The deployment docs now give the operator a real choice (normalise the client IP at the edge, or trust two hops) instead of a caveat, and the nginx example gained the exact match `/api/contact` location with the 20 KB cap (`deploy/nginx.conf.example:43-54`).
- Startup validation of `TRUSTED_PROXY_HOPS` is wired into `instrumentation.ts` with a test, so a typo fails boot rather than every auth request.

## Test coverage

Gates I ran: `npm run typecheck` clean (API, web including its test tsconfig, shared, e2e); `npm run lint` clean; `npm run test` 320 API, 493 web, 85 shared, all passed with PostgreSQL available; `npx playwright test e2e/contact.spec.ts` passed 2 of 2 on both the desktop and mobile projects against locally started built servers with `CONTACT_EMAIL_TRANSPORT=log`. `npm run format:check` reported 452 files including untouched files such as `tsconfig.base.json`, which points at this Windows checkout's line endings rather than the branch, so I did not treat it as a signal (inference, the cause was not verified).

Covered: hop selection at one and two hops, short chain clamping, blank entry filtering, the authenticated header with and without a matching secret, the same field forwarded by the auth relay, the session read and the admin guard, the contact router over real HTTP at two hops, the two hop and forged header cases (`contact.routes.test.ts:311,331`), the widened Resend warning, the transport parser (default, `log` outside production, rejected in production, unknown rejected), and the instrumentation fail fast. The E2E adds the browser path: footer and `/data-deletion` entry, topic preselect, inline validation with no network post, a 200 with the success copy, a 429 with `Retry-After` and the wait message, and bucket isolation for a second IP.

Gaps: nothing drives a real web server with `TRUSTED_PROXY_HOPS=2` (the unit and route tests construct the headers) and the E2E runs at the default of 1, so two hop web behaviour is proven at function and relay level rather than end to end. That is proportionate for a config value with a tested parser and two tested selectors. The `index.ts` log transport branch has no direct test, but it is three lines over an envelope the sender tests already assert.

## Coverage and limits

This file came from two passes, and the split matters when you weigh it.

Pass one, the delegated reviewer, read all 39 files of `048a252` and named 20 of them in its findings. Pass two ran in the main thread over the 18 delta files that pass one never named: `contact.routes.ts`, `auth.routes.ts` and `rate-limit.ts` (the hop wiring), `proxy.ts` and `session.ts` (the forwarded authenticated header), `proxy-guard.test.ts`, `env.test.ts`, `contact.routes.test.ts`, `client-ip.test.ts`, `proxy.test.ts`, `session.test.ts`, the auth and contact `route.test.ts` files, `instrumentation.test.ts`, `deploy/Caddyfile`, `docker-compose.yml`, `.github/workflows/ci.yml`, `README.md`, and `apps/web/.env.local.example`. Pass two read every one of them, confirmed the wiring is asserted by tests rather than assumed (including a relay test at `TRUSTED_PROXY_HOPS=2` and a route test proving a forged `x-proxy-client-ip` without the secret is ignored), and produced exactly one new nit, the Caddy snippet above. So no file in the delta went unread.

Not covered, and why:

- **The visual change.** The landing hero, the botanical palette, and the logo blend treatment (commits `f1bc65a`, `0882740`) are not judged here. Whether the hero reads correctly at real sizes is a `/check verify` question, and a diff cannot settle it.
- **A started stack.** No Docker image was built and no `docker compose up` was run. `deploy/`, `docker-compose.yml`, and the one origin proxy path are judged from their contents plus the relay tests, not from a live container run. A `docker compose up -d --build` followed by a manual contact submission is still the one proof nobody has produced on this branch.
- **Two hops in a browser.** `TRUSTED_PROXY_HOPS=2` is proven at parser, selector, relay, and route level, never through a real browser against a real server behind a simulated CDN.
- **Live deliverability.** Nothing here sends through the real Resend account. The warning logic, the envelope, and the log transport are tested; whether the configured sender is verified in the account is an operator check, and `personalNotes.txt` records the account sitting in test mode.
- **Reviewer model pairing.** This client exposes no reviewer model selection, so the review ran on a fresh context agent with no history of the code, but the cross model pairing the workflow prefers was not enforced.
- **The rest of the branch at depth.** The 75 files from `feat/customer-auth`, `feat/product-catalog-storefront`, and `feat/currency-switcher` were swept for regressions and for still open items from three earlier rounds, not re reviewed. Their own review rounds own that judgement.
