# Review, feat/storefront-contact, 2026-11-25

**Date**: 2026-11-25
**Branch**: feat/storefront-contact, HEAD 048a252
**Reviewed by**: A fresh context reviewer in this environment. The client exposes no reviewer model selection, so the cross model pairing the workflow prefers could not be enforced, and the author's model was not visible to me.
**Scope**: 16 modified files, uncommitted working tree against HEAD 048a252 (+56 / -20), plus confirmation or refutation of all ten findings from `docs/reviews/2026-11-25-feat-storefront-contact.md`. The branch against `main` is 114 files from merge base `1a3699f9`; that larger diff was not re reviewed.
**Verdict**: Changes requested

## Summary

The diff applies most of the prior findings correctly. The API can no longer be reused by Playwright, the transport line and its "all required" placement are fixed, the PaaS bullet now states its precondition, the rationale duplicate is gone, the `ApiEnv` field is honest, and the origin, wait and comment nits are addressed without weakening the tests. The exception is the Caddy rewrite. The syntax is now valid and the block placement is right, but the recommended option still promises a single hop it does not produce, and it quotes the wrong Caddy error. That is a Major because an operator who follows the recommendation will key both the contact limiter and the auth throttles on the Cloudflare edge IP, which is the failure this branch exists to remove. Three Minors and three Nits follow, none in runtime code.

## Major

### 🟠 Caddy Option A still promises a single hop it does not deliver, `deploy/Caddyfile:11-21` and `docs/deployment.md:200-205`

**Problem**: Both places tell the operator to set `trusted_proxies static <cloudflare-cidrs>` and `client_ip_headers CF-Connecting-IP` in Caddy, keep `TRUST_PROXY=1` and `TRUSTED_PROXY_HOPS=1`, and expect the visitor IP to arrive as one hop. Caddy's `client_ip_headers` changes the resolved client IP used by `{client_ip}`, access logs, matchers and the optional PROXY protocol info, but it does not rewrite the HTTP `X-Forwarded-For` that `reverse_proxy` sends. The `reverse_proxy` handler still builds the upstream header as `X-Forwarded-For: <prior value>, <TCP peer>`: `addForwardedHeaders` takes `clientIP` from `req.RemoteAddr` and appends it (the same in v2.8.4 and master), and that value is never the `ClientIPVarKey` that `client_ip_headers` sets. Behind Cloudflare the prior value is the visitor IP and the appended peer is the Cloudflare edge IP, so the last entry, which `readClientIp` and `getClientIp` pick at one hop, is the edge IP. The Nginx half of the same bullet is fine, because `real_ip_header` rewrites `$remote_addr`; the Caddy half is not.

**Why it matters**: An operator who follows the recommended option gets exactly the failure this branch set out to remove: every visitor behind one Cloudflare edge shares the contact bucket and the auth throttles, so ordinary shoppers start receiving 429s. It is worse than a doc typo because the text presents the setting as the recommended hardening. This sentence predates the diff, but the diff rewrote this exact block, so the fix leaves it standing.

**Suggested fix**: Make the Caddy recipe actually replace the upstream header, for example with `header_up X-Forwarded-For {client_ip}` on each `reverse_proxy` (a snippet keeps it in one place), or drop the Caddy half of Option A and tell Caddy users to use Option B with `TRUST_PROXY=2` and `TRUSTED_PROXY_HOPS=2`. The origin firewall condition in step 1 still applies either way. Please verify the chosen form against a running Caddy before calling it recommended; the evidence here is Caddy's source and docs, not a live proxy run.

Sources: [reverse_proxy docs](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy) (it "sets or augments" `X-Forwarded-For`, and `trusted_proxies` trusts the incoming values), [global options docs](https://caddyserver.com/docs/caddyfile/options) (`client_ip_headers` sits under `servers`), and the `addForwardedHeaders` function in [reverseproxy.go v2.8.4](https://github.com/caddyserver/caddy/blob/v2.8.4/modules/caddyhttp/reverseproxy/reverseproxy.go).

## Minor

### 🟡 The quoted Caddy error is the wrong message and the wrong kind of option, `deploy/Caddyfile:20-21`

**Problem**: The text says an older build rejects `client_ip_headers` at startup with the message "unrecognized global option". The option is not a global option; it is a sub option of the `servers` global block. Caddy's parser reports `unrecognized servers option 'client_ip_headers'` (the default branch of `unmarshalCaddyfileServerOptions` in `caddyconfig/httpcaddyfile/serveroptions.go`), and a reported instance for the sibling `client_ip_hash` shows the same wording in issue #5469. The version requirement is also softened to "a Caddy build that has it", while the option shipped in Caddy 2.7.0 (PR #5104, milestone v2.7.0), not 2.8.

**Why it matters**: This is the confidently wrong documentation sentence the last round asked to fix. An operator who greps logs or docs for the quoted text will not find it, and "global option" points at the wrong block if they try to reproduce it.

**Suggested fix**: Drop the quote and say a Caddy build without the option refuses to start; if you want a version, say Caddy 2.7 or later. If you keep the message, quote `unrecognized servers option 'client_ip_headers'`.

Sources: [serveroptions.go](https://github.com/caddyserver/caddy/blob/master/caddyconfig/httpcaddyfile/serveroptions.go), [issue #5469](https://github.com/caddyserver/caddy/issues/5469), [PR #5104](https://github.com/caddyserver/caddy/pull/5104).

### 🟡 The Playwright config header still says a running dev server is reused, `playwright.config.ts:6-11`

**Problem**: The header says "When `npm run dev` is already up locally, the servers are reused and no build runs." That is no longer true for the API: the new `reuseExistingServer: false` at line 57 makes Playwright abort when port 4000 is occupied. The per entry comment and the README say the opposite of the header.

**Why it matters**: The whole point of the change is that reuse must not happen. A developer who hits the new abort reads the file header first and gets the old instruction, and Playwright's own message suggests setting `reuseExistingServer: true`, which is the unsafe change this diff removed.

**Suggested fix**: Rewrite the header to say the web server may be reused, the API is always built and started, and the suite stops if a dev API holds port 4000.

### 🟡 Heroku cannot meet the platform hostname precondition as written, `docs/deployment.md:189-194`

**Problem**: The bullet requires that the platform hostname (`*.onrender.com`, `*.herokuapp.com`) be "disabled or firewalled" before using `TRUST_PROXY=2`. That is true on Render, whose docs describe disabling the `onrender.com` subdomain so requests to it return 404 without reaching the service. It is not true on Heroku: "Your app's Heroku domain always remains active, even if you set up a custom domain", and the only documented remedy is a redirect at the app. A common runtime app cannot firewall the shared router.

**Why it matters**: The bullet exists to stop a caller reaching the API host directly and prepending a spoofed `X-Forwarded-For`, which turns five messages per 15 minutes into no limit. Pairing an unattainable condition with a recommendation may leave a Heroku operator either stuck or assuming a redirect is enough, when it does not stop direct API calls.

**Suggested fix**: Split the two platforms. Keep the disable step for Render, and for Heroku say to keep `TRUST_PROXY=1` unless a fronting proxy rejects requests whose Host is the platform hostname, or say plainly that `TRUST_PROXY=2` is not safe there without that control.

Sources: [Heroku custom domains](https://devcenter.heroku.com/articles/custom-domains), [Render custom domains](https://render.com/docs/custom-domains).

## Nits

- ⚪ `apps/web/src/app/api/contact/route.ts:128-131`, the new comment says a missing secret is "a supported shape here" and points at `route.test.ts`, but no test asserts the secretless forward. The first four route tests exercise the no secret path only because `PROXY_SHARED_SECRET` is absent from the vitest process; if it were set, the forwarding test would still pass with the header present, so nothing pins the behaviour the comment cites. Either assert the header is absent with the variable unset, or reword the comment to say the contact relay treats the secret as optional hardening, unlike auth.
- ⚪ `README.md:69-73`, "It needs PostgreSQL, the seeded accounts, and both servers running (`npm run dev`)" reads as an instruction to keep `npm run dev` up, while the next sentence says to stop its API. Say "both servers available" and let `webServer` start them, or drop the `npm run dev` parenthetical.
- ⚪ `.env.docker.example:31-34`, "Keep it in step with `TRUST_PROXY` above" is loose. The API maps a `TRUST_PROXY` value that is not a number, including `false`, to one hop, so the shipped pair `false` and `1` is the one hop case, not a mismatch. Say "match the same chain depth: raise this to 2 when you raise `TRUST_PROXY` to 2".

## Prior finding verification

1. **The contact E2E can reach live Resend when Playwright reuses a dev API** → **Fixed.** `reuseExistingServer: false` is set on the API entry only (`playwright.config.ts:57`), and the web entry still reuses (`:69`), which matches the rewritten README. I held port 4000 with a dummy server and Playwright aborted immediately with `http://localhost:4000/api/health is already used, make sure that nothing is running on the port/url or set reuseExistingServer:true in config.webServer.` A normal run then built and started both servers and passed 2 of 2, so the log transport is guaranteed by construction. The failure is loud; the residual is the stale config header above.
2. **`CONTACT_EMAIL_TRANSPORT` missing from the env examples, and `TRUSTED_PROXY_HOPS` in the all required block** → **Fixed.** `apps/api/.env.example:51-53` adds the commented test only line beside `CONTACT_EMAIL`, and it matches the parser, which rejects `log` when `NODE_ENV=production` (`apps/api/src/config/env.ts:333-358`). `.env.docker.example` moves `TRUSTED_PROXY_HOPS` out of the "Customer auth" block to line 34, under a "Web container only" comment. `docker-compose.yml` passes `TRUSTED_PROXY_HOPS` only to `web` and `TRUST_PROXY` only to `api`, so the label is accurate. The remaining issue is only the "in step" wording (nit above).
3. **The PaaS two hop advice omits the origin access precondition** → **Partly fixed.** The precondition is now stated, and it is correct for Render. It is not achievable on Heroku, so the bullet over promises for one of the two platforms it names (Minor above).
4. **`deploy/Caddyfile` Option A is not a valid top level construct** → **Syntax fixed, substance still wrong.** The snippet now shows the whole global options block, the file says it must be the first block, and the block is correctly nested. But the single hop promise is false (Major) and the quoted error is wrong (Minor). I therefore refute the prior review's statement that "the two tier advice it encodes is right".
5. **Spec 0005 rationale repeats a Facebook paragraph** → **Fixed.** Exactly the duplicated two lines are gone (`docs/specs/0005-customer-auth/rationale.md:85-87`). One copy remains, and the paragraph flow into "The cross check changed three things" is intact.

Prior nits:

- **(a) Raw `PROXY_SHARED_SECRET` read in the contact relay** → **The author's decision is correct; the original suggestion would be worse.** `getWebAuthEnv` throws when the secret is missing, short, or a placeholder (`apps/web/src/lib/auth/web-env.ts:54-70`), while the API's contact router deliberately accepts an absent secret (`ContactRouterOptions.proxySharedSecret?`, used only to trust `x-proxy-client-ip`). Switching would turn a supported route state into a 500, couple a public relay to auth config, and force every contact route test to construct auth env. The raw read is one line with the same trim and no second source of truth. The only defect is the comment's citation (nit above).
- **(b) `origin` derived from the loaded page** → **Correct, and it cannot mask a cross origin failure.** The route rejects a request when `sec-fetch-site` is `cross-site`, or when the Origin does not match `WEB_APP_URL` or the request Host (`apps/web/src/app/api/contact/route.ts:26-50`). The new value is the browser's own origin, which is what a same origin submission sends. A genuine cross origin post still fails, and `route.test.ts:29-46` keeps that covered. The old fixed value only added an incidental assertion that the base URL was `localhost:3000`; that is not the security check.
- **(c) The 3,500 ms wait** → **The claim is true and the margin is sound.** `CONTACT_MIN_FILL_TIME_MS = 3000` in `packages/shared/src/contact/index.ts:43`. The 3,500 ms value is a 500 ms margin measured from after `load`, while the form measures from mount, so the server's 3,000 ms check passes. The comment names the constant and the tradeoff honestly.
- **(d) `contactEmailTransport` required** → **Honest and correctly updated.** `loadEnv` always returns a value, defaulting to `resend` (`apps/api/src/config/env.ts:151-154` and `:333-358`). The five `ApiEnv` literals in `app.test.ts`, `oauth.integration.test.ts`, `routes.integration.test.ts`, `catalog.routes.test.ts` and `contact.routes.test.ts` each gained the one line, and no other producer exists. `npm run typecheck` is clean, and no caller compared the field to `undefined`, so nothing relied on the old optional type.
- **(e) The Resend sender comment** → **Fixed and accurate.** The composition root now uses the option for the log transport (`apps/api/src/index.ts:79-85` and `:123`), so "tests and the E2E log transport" is the right scope.

## Strengths

- The E2E transport invariant is now enforced by construction rather than by a remembered README note: the API is never reused, and the config states why. The failure is immediate and loud.
- The author declined the `getWebAuthEnv` suggestion for the right reason and left a comment that records the optionality of the secret, rather than following the reviewer mechanically. That is the correct call.
- The `ApiEnv` change is a small honesty improvement, and all five fixtures were updated without touching behaviour.
- The rationale deduplication is exactly two lines and leaves the decision record coherent.
- The E2E now derives the origin from the loaded page, which removes a port assumption without weakening the origin check, and the wait comment ties the magic number to the shared constant.

## Test coverage

Gates I ran, with results. `npm run typecheck` clean. `npm run lint` clean. `npm run test` was not green on the first two attempts because `apps/web/src/components/contact-form.test.tsx` ("pre-selects initialTopic and submits with that topic") timed out at 5 s under full suite load (492 of 493), while the same file passes alone (5 of 5, about 7 s) and a third full web run passed 493 of 493. That test and its component are untouched by this diff, so I treat it as a load flake, not a finding against the change. The API workspace passed 320 of 320, the shared workspace 85 of 85, and the targeted API files (`env.test.ts`, `contact.routes.test.ts`, `app.test.ts`) 61 of 61. The web contact route test passed 7 of 7. `npx playwright test e2e/contact.spec.ts --project=desktop` passed 2 of 2 in 2.1 minutes with Playwright building and starting both servers, which also proves the API is not reused and the log transport applies. I did not treat `npm run format:check` as a signal on this Windows checkout, where many untouched files are CRLF and others LF; I checked the 16 modified files instead. Each is uniformly CRLF or LF, none mixed, and the diff contains no reformat of unrelated lines. `personalNotes.txt` is untouched.

Covered by the diff: the env parser value is required and every fixture has it; the E2E origin is derived; the wait is documented; the examples and docs are consistent apart from the items above. Not covered: no Docker image or `docker compose up` run, no live Caddy process (the Caddy finding comes from its source and docs), no live Resend send, and no mobile project run. The rest of the 114 file branch was not re reviewed.

## Evidence and limits

- I read the complete diff of all 16 files and the surrounding code that the findings depend on (`web-env.ts`, `instrumentation.ts`, `contact.routes.ts`, `client-ip.ts`, `env.ts`, `docker-compose.yml`, `ci.yml`, and `route.test.ts`). I did not re review the other 98 files of the branch against `main`.
- Caddy claims: verified against the Caddy docs and the `serveroptions.go` and `reverseproxy.go` sources (v2.8.4 and master). No Caddy binary was run here, so the exact startup wording is quoted from the parser's error string and a reported instance, not from a local reproduction.
- Heroku and Render claims: verified against their current documentation, linked above.
- Reviewer model pairing: not enforced, as stated in the metadata. This was a fresh context review with no history of the branch.

## Reconciliation note (main thread)

This file came from one delegated reviewer in a single run. It settled normally, wrote everything above in one pass, and nothing was truncated or dropped, so no part of its scope had to be redone.

What the main thread re checked independently before acting on it:

- **The Caddy Major.** Re read in the upstream source, not taken on trust. `addForwardedHeaders` in `reverseproxy.go` builds the upstream `X-Forwarded-For` from `req.RemoteAddr`, and `ClientIPVarKey` appears only in the PROXY protocol block, so `client_ip_headers` cannot deliver the single hop the recommendation promises. The finding stands.
- **The quoted parser error.** Confirmed in `serveroptions.go` as `unrecognized servers option '%s'`, so the old "unrecognized global option" wording was wrong and the Minor stands.
- **The stale `playwright.config.ts` header.** Confirmed word for word in the file.

What the main thread did not verify, and why it is left as written:

- **The Caddy 2.7.0 attribution.** It rests on the linked pull request and milestone. A check of the 2.8, 2.9 and 2.10 release bodies finds no mention of `client_ip_headers`, which is consistent with an earlier introduction but is not proof. The 2.7.0 release body itself could not be queried afterwards because the GitHub API rate limited the request. Treat the version number as the least certain claim in this file; the safe wording for the doc fix quotes no version at all.
- **The Heroku and Render behaviour.** Taken from the linked vendor documentation, which is the right source for it, and not reproduced against a live app.
- **The gate runs.** Performed by the reviewer, not repeated afterwards. No file changed between those runs and this note, so the results still describe the tree as it stands.

Not covered anywhere in this pass, in addition to the gaps listed under Test coverage: a Docker image build or `docker compose up`, a live Caddy process, a live Resend send, the mobile Playwright project, and the other 98 files of the branch against `main`.
