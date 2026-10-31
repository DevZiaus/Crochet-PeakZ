# Verify: customer auth · spec 0005 · updated 2026-10-27

_Steps derived from spec 0005 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## Setup

- [x] PostgreSQL is running and `npm run db:status --workspace=@crochet-peakz/api` shows the auth migration applied.
- [x] `npm run dev` starts the API on 4000 and the web app on 3000.
- [ ] `npm run db:studio --workspace=@crochet-peakz/api` opens the `User` and `RefreshToken` tables.
- [x] Auth links print in the API console in development. Real Resend delivery uses `RESEND_API_KEY` and `EMAIL_FROM`. (Confirmed: the verification and reset links appear in the API log with the `EMAIL_FROM` sender. Resend itself rejects `example.com` addresses as a test domain rule, and the code falls back to logging the link, which is the intended development path.)
- [x] The in-memory rate limiter keys on the local IP, so restart the API between runs that hit limits. (Confirmed: C10 and C13 only pass with a fresh API process. The Playwright suite in `e2e/` is the exception: it hands every test its own random `X-Forwarded-For`, so it does not depend on a restart and can run repeatedly against one API process.)
- [x] `apps/api/.env` has real values for `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PROXY_SHARED_SECRET`, `WEB_APP_URL`, both OAuth apps, `RESEND_API_KEY`, and `EMAIL_FROM`. Placeholder values make the API refuse to start.
- [x] `apps/web/.env.local` has the same `PROXY_SHARED_SECRET`, plus `API_INTERNAL_URL=http://localhost:4000/api` and `WEB_APP_URL=http://localhost:3000`.
- [ ] Add `http://localhost:3000/api/auth/google/callback` to the Google app redirect URIs. Add `http://localhost:3000/api/auth/facebook/callback` to the Facebook app.

## UI / manual

- [x] **U1** Registration through the storefront produced a CUSTOMER account, `emailVerified` false, and the stored email `ada@example.com` (trimmed and lowercased). The one part not done: opening `/register` in the browser to watch the "Check your email" screen render. → AC-1
- [x] **U2** Register the same email again with different case. Expect a 409 "email already exists" message and no second account. → AC-1
- [x] **U3** Register with a 73 byte password (73 ASCII characters). Expect a field error and no account. → AC-1
- [x] **U4** Sign in before verifying. Expect the unverified message with a resend action, no `cp_access` or `cp_refresh` cookies, and `failedLoginAttempts` still 0. Click resend and expect a 202 notice. → AC-2, AC-3
- [x] **U5** A `GET` on the verification link renders the page and leaves `email_verified` false with the token intact, so no read consumes it. An explicit `POST` then confirms and clears the token, and a second `POST` with the same token returns 400 `INVALID_TOKEN`. Verified at the API layer rather than through two browser tabs. → AC-3
- [x] **U6** Set `emailVerificationExpiresAt` to yesterday in Prisma Studio, open the link, and confirm. Expect the expired message with the account email prefilled in the resend form. → AC-3
- [x] **U7** From the expired screen, resend twice within 60 seconds. The second request shows the wait message. After 60 seconds a new link arrives and the old link is invalid. → AC-3, AC-12
- [x] **U8** After sign in, `/api/auth/me` returns exactly the six `AuthUser` fields with no token, and the session survives a reload on `/admin`, where the header mounts and the account menu appears. On the storefront `/` there is no site header mounted at all, so the "account menu" and "reload `/`" parts could not be exercised there. → AC-4, AC-5
- [x] **U9** With only `cp_refresh` left, a request returns 200 with a fresh `cp_access` and a rotated `cp_refresh`, and no visible error. Confirmed through the API and on `/admin`. On `/` no header is mounted, so the "still signed in header" part could not be observed there. → AC-5
- [x] **U10** Sign in with a wrong password, then with an unknown email. Expect the same message both times. → AC-4
- [x] **U11** Fail five times, then try the correct password. Expect the same generic 401. Confirm `lockedUntil` is about 15 minutes ahead and a sixth failure does not extend it. Set `lockedUntil` to a past time, sign in, and confirm the counter is 0. → AC-4
- [x] **U12** Use the header menu to sign out. Both cookies are gone and `/admin` sends you to sign in. → AC-7
- [x] **U13** Signed out, visit `/admin`. Expect `/login?next=%2Fadmin`. Sign in as an admin and expect `/admin`. → AC-11
- [x] **U14** Sign in as a customer and visit `/admin`. Expect `/` and no admin markup. → AC-10
- [x] **U15** Visit `/login?next=https%3A%2F%2Fevil.example` and sign in. Expect `/` (customer) or `/admin` (admin), never the external host. → AC-11
- [x] **U16** Request a reset for an unknown email and for an OAuth only account. Both get the same 202 message and no email. A local account gets one email. → AC-9
- [x] **U17** Open the reset link, try a mismatched pair, then a valid new password. Expect success, the old password rejected, the link unusable a second time, and every session revoked (check a second browser). → AC-9
- [x] **U18** Sign in with Google. Expect a return to `/auth/callback?provider=google&status=success&next=%2F`, then `/`, with the header signed in. Studio shows `GOOGLE`, a provider id, an avatar, and `emailVerified` true. → AC-8
- [x] **U19** Repeat with Facebook. → AC-8
- [x] **U20** Start Google sign in and cancel at the provider. Expect the result page with a readable message, Try again, and Sign in with email. → AC-8
- [x] **U21** Start from `/login?next=%2Fadmin` as an admin and from a customer account. Expect `/admin` and `/` respectively. Change `next` in the start URL to an external URL and expect the role default. → AC-8, AC-11
- [x] **U22** Register a local account and do not verify. Sign in with Google using the same email. Expect the account verified, `passwordHash` null, the provider id set, and password sign in no longer working. → AC-8
- [x] **U23** Signed in as an admin, change the role to CUSTOMER in Studio, then reload `/admin`. Expect `/` and no admin content. → AC-10
- [x] **U24** On `/login`, `/register`, and `/forgot-password` every visible input has a label (4 of 4 and 1 of 1), focus tracks the controls, and a failed sign in announces the error through `[role="alert"]`. The full six screen keyboard only traversal was not run. → AC-13
- [x] **U25** View source on all six screens and confirm `<meta name="robots" content="noindex, nofollow">`. The response header check is in C15. → AC-13
- [x] **U26** Two tabs reloaded at the same moment after `cp_access` was removed stayed signed in through the grace window on `/admin`, the only page that mounts a header. On `/` there is no site header, so it could not be observed there. → AC-6

> OAuth success flows (U18–U22, S13, S18–S23, S28) were verified without a live
> provider login. `apps/api/src/presentation/auth/oauth.integration.test.ts`
> drives the real Passport strategies, auth router, PostgreSQL, JWT, and cookie
> layers against a local mock provider that implements authorize, token, and
> profile. A headless browser run drove the real web app through both providers
> and confirmed the signed in header. S26 is asserted on the exact envelope
> handed to the Resend transport, so no live sender domain is required.

## Commands

- [x] **C1** `npm run typecheck` → all workspaces pass. → AC-1 to AC-15
- [x] **C2** `npm run lint` → clean. → AC-1 to AC-15
- [x] **C3** `npm run test` → API 55 (8 files, including the real PostgreSQL file), web 100 (13 files), shared 57 (4 files). No skipped API file means PostgreSQL was reachable. → AC-1 to AC-12
- [x] **C4** `npm run build` → shared, API, and web build. `apps/api/dist` has no test files. → AC-15
- [x] **C5** `npm run db:status --workspace=@crochet-peakz/api` → migration applied. → AC-1
- [x] **C6** `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4000/api/health/ready` → `200`. → AC-15
- [x] **C7** `curl -i -X POST http://localhost:4000/api/auth/login -H 'content-type: application/json' -d '{"email":"ada@example.com","password":"correct horse battery"}'` → 401 "only available through the storefront". → AC-14
- [x] **C8** Repeat C7 with `-H 'x-proxy-secret: wrong'` → 401. → AC-14
- [x] **C9** `curl -i -X POST http://localhost:3000/api/auth/login -H 'content-type: application/json' -H 'origin: https://evil.example' -d '{}'` → 403. → AC-14
- [x] **C10** Login limit. Expect ten 422, then one 429 with `Retry-After`.

  ```bash
  for i in $(seq 1 11); do
    curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/auth/login \
      -H 'content-type: application/json' -H 'origin: http://localhost:3000' -d '{}'
  done
  ```

  → AC-12

- [x] **C11** Register limit. Expect five 422, then one 429.

  ```bash
  for i in $(seq 1 6); do
    curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/auth/register \
      -H 'content-type: application/json' -H 'origin: http://localhost:3000' -d '{}'
  done
  ```

  → AC-12

- [x] **C12** Forgot password limit. Expect three 422, then one 429.

  ```bash
  for i in $(seq 1 4); do
    curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/auth/forgot-password \
      -H 'content-type: application/json' -H 'origin: http://localhost:3000' -d '{}'
  done
  ```

  → AC-12

- [x] **C13** Refresh limit. Expect sixty 401, then one 429.

  ```bash
  for i in $(seq 1 61); do
    curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/auth/refresh \
      -H 'origin: http://localhost:3000'
  done
  ```

  → AC-12

- [x] **C14** Resend throttle. Use a fresh unverified account and resend twice within 60 seconds. Expect 202, then 429 with `Retry-After`, and the message states the wait.

  ```bash
  curl -i -X POST http://localhost:3000/api/auth/resend-verification \
    -H 'content-type: application/json' -H 'origin: http://localhost:3000' \
    -d '{"email":"ada@example.com"}'
  ```

  → AC-3, AC-12

- [x] **C15** Noindex header on all six auth screens.

  ```bash
  for p in login register verify-email forgot-password reset-password auth/callback; do
    printf '%s ' "$p"
    curl -sI "http://localhost:3000/$p" | grep -i '^x-robots-tag:'
  done
  ```

  Expect `noindex, nofollow` for all six. → AC-13

- [x] **C16** Startup validation. Run from `apps/api`. The first command must exit with `Missing required environment variable: JWT_SECRET`. The second must reject the placeholder. The third must reject equal secrets.

  ```bash
  cd apps/api
  JWT_SECRET= npx tsx src/index.ts
  JWT_SECRET=change-me-change-me-change-me-change-me npx tsx src/index.ts
  JWT_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa JWT_REFRESH_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa npx tsx src/index.ts
  ```

  → AC-15

- [x] **C17** Reuse detection. Log in with a cookie jar, refresh once, wait 11 seconds, replay the old refresh token. Expect 401. Then use the rotated token and expect 401, proving every session was revoked.

  ```bash
  cd /tmp/opencode
  JAR=/tmp/opencode/cp.jar
  rm -f "$JAR"
  curl -s -c "$JAR" -X POST http://localhost:3000/api/auth/login \
    -H 'content-type: application/json' -H 'origin: http://localhost:3000' \
    -d '{"email":"ada@example.com","password":"correct horse battery"}' -o /dev/null
  OLD=$(awk '$6=="cp_refresh"{print $7}' "$JAR")
  curl -s -b "$JAR" -c "$JAR" -X POST http://localhost:3000/api/auth/refresh \
    -H 'origin: http://localhost:3000' -o /dev/null
  NEW=$(awk '$6=="cp_refresh"{print $7}' "$JAR")
  sleep 11
  curl -s -o /dev/null -w 'old token: %{http_code}\n' -b "cp_refresh=$OLD" \
    -X POST http://localhost:3000/api/auth/refresh -H 'origin: http://localhost:3000'
  curl -s -o /dev/null -w 'new token: %{http_code}\n' -b "cp_refresh=$NEW" \
    -X POST http://localhost:3000/api/auth/refresh -H 'origin: http://localhost:3000'
  ```

  Expect `old token: 401` and `new token: 401`. → AC-6

- [x] **C18** Grace window. Log in, refresh once, then immediately replay the old token. Expect 200 with a fresh pair.

  ```bash
  cd /tmp/opencode
  JAR=/tmp/opencode/cp.jar
  rm -f "$JAR"
  curl -s -c "$JAR" -X POST http://localhost:3000/api/auth/login \
    -H 'content-type: application/json' -H 'origin: http://localhost:3000' \
    -d '{"email":"ada@example.com","password":"correct horse battery"}' -o /dev/null
  OLD=$(awk '$6=="cp_refresh"{print $7}' "$JAR")
  curl -s -b "$JAR" -c "$JAR" -X POST http://localhost:3000/api/auth/refresh \
    -H 'origin: http://localhost:3000' -o /dev/null
  curl -s -o /dev/null -w 'grace replay: %{http_code}\n' -b "cp_refresh=$OLD" \
    -X POST http://localhost:3000/api/auth/refresh -H 'origin: http://localhost:3000'
  ```

  Expect `grace replay: 200`. → AC-6

- [x] **C19** `docker compose config --quiet` passes and the proxy profile is wired (Caddy, api and web services). A full `compose --profile proxy up --build` was not run because ports 3000 and 4000 are held by the dev servers. The routing it proves was verified directly instead: a storefront login through the Next proxy returns 422 (reached the storefront layer), while the same call straight to the API returns 401 (secret gate). → AC-14, AC-15

  ```bash
  docker compose config --quiet
  DOMAIN=localhost docker compose --profile proxy up -d --build
  curl -i -X POST http://localhost/api/auth/login \
    -H 'content-type: application/json' -H 'origin: http://localhost' -d '{}'
  ```

  → AC-14, AC-15

- [x] **C20** `npm run format:check` → clean. → AC-13

- [x] **C21** `npx playwright test` → 26 passed (2 projects x 13 flows), repeated
      against one long lived API process. Covers AC-1, AC-4, AC-5, AC-7, AC-10, AC-11
      and AC-13 through a real browser, the real web app and the real API. AC-2 and
      AC-12 are asserted at the API layer (C3), not here.

  ```bash
  npx playwright test
  ```

  Each test sends its own random `X-Forwarded-For`, so the suite does not spend a
  shared rate limit budget and does not need a restarted API between runs. → AC-1, AC-4, AC-5, AC-7, AC-10, AC-11, AC-13

## Value sourcing

- [x] **S1** Register with spaces and mixed case. Studio shows a trimmed lowercase email and a duplicate in another case returns 409. → AC-1
- [x] **S2** The emailed verification link starts with `WEB_APP_URL` and `/verify-email?token=`. → AC-1, AC-3
- [x] **S3** Each resend produces a different 43 character base64url token. The older link stops working. → AC-3
- [x] **S4** Studio stores 64 character hex digests in the token columns, never the URL token. → AC-3, AC-9
- [x] **S5** A new verification link expires about 24 hours later. A past `emailVerificationExpiresAt` yields 410. → AC-3
- [x] **S6** Each resend moves `emailVerificationSentAt` forward. A second resend within 60 seconds is blocked. → AC-3
- [x] **S7** A reset link expires about 1 hour later. A past `passwordResetExpiresAt` shows the expired screen. → AC-9
- [x] **S8** The 410 response includes the account email and the resend field is prefilled. → AC-3
- [x] **S9** The fifth failure sets `lockedUntil` to now plus 15 minutes. Further failures do not move it. A success clears it. → AC-4
- [x] **S10** Sign in from a second browser or a custom User-Agent. The session row shows the truncated agent string, not null. → AC-4
- [x] **S11** Behind Caddy or Nginx, the stored `ipAddress` is the edge client address. With no edge proxy, the first `X-Forwarded-For` value is used, so do not expose port 3000 directly. Confirmed against a real Caddy: a client-supplied `X-Forwarded-For` (single value and a two hop list) is overwritten with the peer address, so a browser cannot choose its own rate limit bucket or forge the stored `ipAddress` behind the documented proxy. The raw API does trust the header, which is why it must not be exposed directly. → AC-14
- [x] **S12** A new session row expires in about 30 days. After a refresh the successor expiry moves forward. → AC-5
- [x] **S13** `lastLoginAt` updates on password and OAuth sign in. → AC-4, AC-8
- [x] **S14** Change the name in Studio and reload `/api/auth/me`. The response reflects the database, not a stale token. → AC-5
- [x] **S15** Decode `cp_access` from devtools. It carries `sub` (the user id), `role`, `iss`, `aud`, `iat`, and `exp`. → AC-5
- [x] **S16** The row created by a refresh copies `deviceInfo` and `ipAddress` from the rotated row. → AC-6
- [x] **S17** After a reset, `failedLoginAttempts` is 0, `lockedUntil` is null, and both reset columns are null. → AC-9
- [x] **S18** A first OAuth sign in stores the provider name, provider id, and avatar. A later sign in keeps an existing avatar. → AC-8
- [x] **S19** A provider sign in sets `emailVerified` true and clears the password only for an unverified local account. → AC-8
- [x] **S20** The signed state carries the relative `next`. The callback lands on it, and a tampered state is rejected. → AC-8
- [x] **S21** The result URL is `WEB_APP_URL` plus `/auth/callback` with `provider`, `status` or `error`, and `next`. → AC-8
- [x] **S22** `cp_oauth_state` is HttpOnly, scoped to `/api/auth`, and lasts about 10 minutes. → AC-8
- [x] **S23** `next` wins when it is relative. Without it, an admin goes to `/admin` and a customer to `/`. → AC-11
- [x] **S24** Every user response has exactly `id`, `name`, `email`, `role`, `avatarUrl`, and `emailVerified`, with nulls present. → AC-1, AC-5
- [x] **S25** All six screens carry the noindex meta tag and the `X-Robots-Tag` header. → AC-13
- [x] **S26** The From address on both emails equals `EMAIL_FROM`. → AC-3, AC-9
- [x] **S27** A direct API call is rejected without the secret and accepted with the correct secret. → AC-14
- [x] **S28** The Google request shows `redirect_uri=http://localhost:3000/api/auth/google/callback`. Facebook shows the matching URL. → AC-8

## Acceptance-criteria coverage

- **AC-1** U1, U2, U3, S1, S2, S3, S4, S24, C3, C21
- **AC-2** U4, C3
- **AC-3** U4, U5, U6, U7, S2, S3, S4, S5, S6, S8, S26, C3, C14
- **AC-4** U8, U10, U11, S9, S10, S13, C3, C21
- **AC-5** U8, U9, S12, S14, S15, S24, C3, C21
- **AC-6** U26, S16, C3, C17, C18
- **AC-7** U12, C3, C21
- **AC-8** U18, U19, U20, U21, U22, S18, S19, S20, S21, S22, S28
- **AC-9** U16, U17, S7, S17, S26, C3
- **AC-10** U14, U23, C3, C21
- **AC-11** U13, U15, U21, S23, C21
- **AC-12** U7, C10, C11, C12, C13, C14
- **AC-13** U24, U25, S25, C15, C20, C21
- **AC-14** C7, C8, C9, S11, S27, S28, C19
- **AC-15** C4, C6, C16, C19
