# Verify: customer auth · spec 0005 · updated 2026-10-26

_Steps derived from spec 0005 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## Setup

- [ ] PostgreSQL is running and `npm run db:status --workspace=@crochet-peakz/api` shows the auth migration applied.
- [ ] `npm run dev` starts the API on 4000 and the web app on 3000.
- [ ] `npm run db:studio --workspace=@crochet-peakz/api` opens the `User` and `RefreshToken` tables.
- [ ] Auth links print in the API console in development. Real Resend delivery uses `RESEND_API_KEY` and `EMAIL_FROM`.
- [ ] The in-memory rate limiter keys on the local IP, so restart the API between runs that hit limits.
- [ ] `apps/api/.env` has real values for `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PROXY_SHARED_SECRET`, `WEB_APP_URL`, both OAuth apps, `RESEND_API_KEY`, and `EMAIL_FROM`. Placeholder values make the API refuse to start.
- [ ] `apps/web/.env.local` has the same `PROXY_SHARED_SECRET`, plus `API_INTERNAL_URL=http://localhost:4000/api` and `WEB_APP_URL=http://localhost:3000`.
- [ ] Add `http://localhost:3000/api/auth/google/callback` to the Google app redirect URIs. Add `http://localhost:3000/api/auth/facebook/callback` to the Facebook app.

## UI / manual

- [ ] **U1** Visit `/register`, enter a name, `  Ada@Example.COM  `, and a 12 character password. Expect the "Check your email" screen, a CUSTOMER account with `emailVerified` false, and the stored email `ada@example.com`. → AC-1
- [ ] **U2** Register the same email again with different case. Expect a 409 "email already exists" message and no second account. → AC-1
- [ ] **U3** Register with a 73 byte password (73 ASCII characters). Expect a field error and no account. → AC-1
- [ ] **U4** Sign in before verifying. Expect the unverified message with a resend action, no `cp_access` or `cp_refresh` cookies, and `failedLoginAttempts` still 0. Click resend and expect a 202 notice. → AC-2, AC-3
- [ ] **U5** Copy the verification link and open it in two tabs. Both show "Confirm your email". Confirm in tab A and expect success plus a sign in link. Confirm in tab B and expect an invalid link message with resend. → AC-3
- [ ] **U6** Set `emailVerificationExpiresAt` to yesterday in Prisma Studio, open the link, and confirm. Expect the expired message with the account email prefilled in the resend form. → AC-3
- [ ] **U7** From the expired screen, resend twice within 60 seconds. The second request shows the wait message. After 60 seconds a new link arrives and the old link is invalid. → AC-3, AC-12
- [ ] **U8** Sign in on the verified account. The header shows the account menu. Reload `/` and the session survives. Open `/api/auth/me` and expect the six `AuthUser` fields with no token. → AC-4, AC-5
- [ ] **U9** In devtools, delete only `cp_access`, keep `cp_refresh`, and reload `/`. Expect a new `cp_access` cookie and a still signed in header, with no visible error. → AC-5
- [ ] **U10** Sign in with a wrong password, then with an unknown email. Expect the same message both times. → AC-4
- [ ] **U11** Fail five times, then try the correct password. Expect the same generic 401. Confirm `lockedUntil` is about 15 minutes ahead and a sixth failure does not extend it. Set `lockedUntil` to a past time, sign in, and confirm the counter is 0. → AC-4
- [ ] **U12** Use the header menu to sign out. Both cookies are gone and `/admin` sends you to sign in. → AC-7
- [ ] **U13** Signed out, visit `/admin`. Expect `/login?next=%2Fadmin`. Sign in as an admin and expect `/admin`. → AC-11
- [ ] **U14** Sign in as a customer and visit `/admin`. Expect `/` and no admin markup. → AC-10
- [ ] **U15** Visit `/login?next=https%3A%2F%2Fevil.example` and sign in. Expect `/` (customer) or `/admin` (admin), never the external host. → AC-11
- [ ] **U16** Request a reset for an unknown email and for an OAuth only account. Both get the same 202 message and no email. A local account gets one email. → AC-9
- [ ] **U17** Open the reset link, try a mismatched pair, then a valid new password. Expect success, the old password rejected, the link unusable a second time, and every session revoked (check a second browser). → AC-9
- [ ] **U18** Sign in with Google. Expect a return to `/auth/callback?provider=google&status=success&next=%2F`, then `/`, with the header signed in. Studio shows `GOOGLE`, a provider id, an avatar, and `emailVerified` true. → AC-8
- [ ] **U19** Repeat with Facebook. → AC-8
- [ ] **U20** Start Google sign in and cancel at the provider. Expect the result page with a readable message, Try again, and Sign in with email. → AC-8
- [ ] **U21** Start from `/login?next=%2Fadmin` as an admin and from a customer account. Expect `/admin` and `/` respectively. Change `next` in the start URL to an external URL and expect the role default. → AC-8, AC-11
- [ ] **U22** Register a local account and do not verify. Sign in with Google using the same email. Expect the account verified, `passwordHash` null, the provider id set, and password sign in no longer working. → AC-8
- [ ] **U23** Signed in as an admin, change the role to CUSTOMER in Studio, then reload `/admin`. Expect `/` and no admin content. → AC-10
- [ ] **U24** Use only the keyboard on all six screens. Every control has visible focus, every input has a label, and a failed submit announces the error (`role="alert"`). → AC-13
- [ ] **U25** View source on all six screens and confirm `<meta name="robots" content="noindex, nofollow">`. The response header check is in C15. → AC-13
- [ ] **U26** Open two tabs, delete `cp_access`, and reload both at the same moment. Both stay signed in through the 10 second grace window. → AC-6

## Commands

- [ ] **C1** `npm run typecheck` → all workspaces pass. → AC-1 to AC-15
- [ ] **C2** `npm run lint` → clean. → AC-1 to AC-15
- [ ] **C3** `npm run test` → API 34 (4 files, including the real PostgreSQL file), web 88, shared 34. No skipped API file means PostgreSQL was reachable. → AC-1 to AC-12
- [ ] **C4** `npm run build` → shared, API, and web build. `apps/api/dist` has no test files. → AC-15
- [ ] **C5** `npm run db:status --workspace=@crochet-peakz/api` → migration applied. → AC-1
- [ ] **C6** `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4000/api/health/ready` → `200`. → AC-15
- [ ] **C7** `curl -i -X POST http://localhost:4000/api/auth/login -H 'content-type: application/json' -d '{"email":"ada@example.com","password":"correct horse battery"}'` → 401 "only available through the storefront". → AC-14
- [ ] **C8** Repeat C7 with `-H 'x-proxy-secret: wrong'` → 401. → AC-14
- [ ] **C9** `curl -i -X POST http://localhost:3000/api/auth/login -H 'content-type: application/json' -H 'origin: https://evil.example' -d '{}'` → 403. → AC-14
- [ ] **C10** Login limit. Expect ten 422, then one 429 with `Retry-After`.

  ```bash
  for i in $(seq 1 11); do
    curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/auth/login \
      -H 'content-type: application/json' -H 'origin: http://localhost:3000' -d '{}'
  done
  ```

  → AC-12

- [ ] **C11** Register limit. Expect five 422, then one 429.

  ```bash
  for i in $(seq 1 6); do
    curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/auth/register \
      -H 'content-type: application/json' -H 'origin: http://localhost:3000' -d '{}'
  done
  ```

  → AC-12

- [ ] **C12** Forgot password limit. Expect three 422, then one 429.

  ```bash
  for i in $(seq 1 4); do
    curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/auth/forgot-password \
      -H 'content-type: application/json' -H 'origin: http://localhost:3000' -d '{}'
  done
  ```

  → AC-12

- [ ] **C13** Refresh limit. Expect sixty 401, then one 429.

  ```bash
  for i in $(seq 1 61); do
    curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/auth/refresh \
      -H 'origin: http://localhost:3000'
  done
  ```

  → AC-12

- [ ] **C14** Resend throttle. Use a fresh unverified account and resend twice within 60 seconds. Expect 202, then 429 with `Retry-After`, and the message states the wait.

  ```bash
  curl -i -X POST http://localhost:3000/api/auth/resend-verification \
    -H 'content-type: application/json' -H 'origin: http://localhost:3000' \
    -d '{"email":"ada@example.com"}'
  ```

  → AC-3, AC-12

- [ ] **C15** Noindex header on all six auth screens.

  ```bash
  for p in login register verify-email forgot-password reset-password auth/callback; do
    printf '%s ' "$p"
    curl -sI "http://localhost:3000/$p" | grep -i '^x-robots-tag:'
  done
  ```

  Expect `noindex, nofollow` for all six. → AC-13

- [ ] **C16** Startup validation. Run from `apps/api`. The first command must exit with `Missing required environment variable: JWT_SECRET`. The second must reject the placeholder. The third must reject equal secrets.

  ```bash
  cd apps/api
  JWT_SECRET= npx tsx src/index.ts
  JWT_SECRET=change-me-change-me-change-me-change-me npx tsx src/index.ts
  JWT_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa JWT_REFRESH_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa npx tsx src/index.ts
  ```

  → AC-15

- [ ] **C17** Reuse detection. Log in with a cookie jar, refresh once, wait 11 seconds, replay the old refresh token. Expect 401. Then use the rotated token and expect 401, proving every session was revoked.

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

- [ ] **C18** Grace window. Log in, refresh once, then immediately replay the old token. Expect 200 with a fresh pair.

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

- [ ] **C19** Deployment routing. `docker compose config --quiet` passes. With the proxy profile, a login request with an empty body and the correct Origin returns 422, which proves it reached the Next proxy rather than the API directly. The Docker env must have real secrets, `WEB_APP_URL=http://localhost`, and the same `PROXY_SHARED_SECRET` on both services.

  ```bash
  docker compose config --quiet
  DOMAIN=localhost docker compose --profile proxy up -d --build
  curl -i -X POST http://localhost/api/auth/login \
    -H 'content-type: application/json' -H 'origin: http://localhost' -d '{}'
  ```

  → AC-14, AC-15

- [ ] **C20** `npm run format:check` → clean. → AC-13

## Value sourcing

- [ ] **S1** Register with spaces and mixed case. Studio shows a trimmed lowercase email and a duplicate in another case returns 409. → AC-1
- [ ] **S2** The emailed verification link starts with `WEB_APP_URL` and `/verify-email?token=`. → AC-1, AC-3
- [ ] **S3** Each resend produces a different 43 character base64url token. The older link stops working. → AC-3
- [ ] **S4** Studio stores 64 character hex digests in the token columns, never the URL token. → AC-3, AC-9
- [ ] **S5** A new verification link expires about 24 hours later. A past `emailVerificationExpiresAt` yields 410. → AC-3
- [ ] **S6** Each resend moves `emailVerificationSentAt` forward. A second resend within 60 seconds is blocked. → AC-3
- [ ] **S7** A reset link expires about 1 hour later. A past `passwordResetExpiresAt` shows the expired screen. → AC-9
- [ ] **S8** The 410 response includes the account email and the resend field is prefilled. → AC-3
- [ ] **S9** The fifth failure sets `lockedUntil` to now plus 15 minutes. Further failures do not move it. A success clears it. → AC-4
- [ ] **S10** Sign in from a second browser or a custom User-Agent. The session row shows the truncated agent string, not null. → AC-4
- [ ] **S11** Behind Caddy or Nginx, the stored `ipAddress` is the edge client address. With no edge proxy, the first `X-Forwarded-For` value is used, so do not expose port 3000 directly. → AC-14
- [ ] **S12** A new session row expires in about 30 days. After a refresh the successor expiry moves forward. → AC-5
- [ ] **S13** `lastLoginAt` updates on password and OAuth sign in. → AC-4, AC-8
- [ ] **S14** Change the name in Studio and reload `/api/auth/me`. The response reflects the database, not a stale token. → AC-5
- [ ] **S15** Decode `cp_access` from devtools. It carries `sub` (the user id), `role`, `iss`, `aud`, `iat`, and `exp`. → AC-5
- [ ] **S16** The row created by a refresh copies `deviceInfo` and `ipAddress` from the rotated row. → AC-6
- [ ] **S17** After a reset, `failedLoginAttempts` is 0, `lockedUntil` is null, and both reset columns are null. → AC-9
- [ ] **S18** A first OAuth sign in stores the provider name, provider id, and avatar. A later sign in keeps an existing avatar. → AC-8
- [ ] **S19** A provider sign in sets `emailVerified` true and clears the password only for an unverified local account. → AC-8
- [ ] **S20** The signed state carries the relative `next`. The callback lands on it, and a tampered state is rejected. → AC-8
- [ ] **S21** The result URL is `WEB_APP_URL` plus `/auth/callback` with `provider`, `status` or `error`, and `next`. → AC-8
- [ ] **S22** `cp_oauth_state` is HttpOnly, scoped to `/api/auth`, and lasts about 10 minutes. → AC-8
- [ ] **S23** `next` wins when it is relative. Without it, an admin goes to `/admin` and a customer to `/`. → AC-11
- [ ] **S24** Every user response has exactly `id`, `name`, `email`, `role`, `avatarUrl`, and `emailVerified`, with nulls present. → AC-1, AC-5
- [ ] **S25** All six screens carry the noindex meta tag and the `X-Robots-Tag` header. → AC-13
- [ ] **S26** The From address on both emails equals `EMAIL_FROM`. → AC-3, AC-9
- [ ] **S27** A direct API call is rejected without the secret and accepted with the correct secret. → AC-14
- [ ] **S28** The Google request shows `redirect_uri=http://localhost:3000/api/auth/google/callback`. Facebook shows the matching URL. → AC-8

## Acceptance-criteria coverage

- **AC-1** U1, U2, U3, S1, S2, S3, S4, S24, C3
- **AC-2** U4, C3
- **AC-3** U4, U5, U6, U7, S2, S3, S4, S5, S6, S8, S26, C3, C14
- **AC-4** U8, U10, U11, S9, S10, S13, C3
- **AC-5** U8, U9, S12, S14, S15, S24, C3
- **AC-6** U26, S16, C3, C17, C18
- **AC-7** U12, C3
- **AC-8** U18, U19, U20, U21, U22, S18, S19, S20, S21, S22, S28
- **AC-9** U16, U17, S7, S17, S26, C3
- **AC-10** U14, U23, C3
- **AC-11** U13, U15, U21, S23
- **AC-12** U7, C10, C11, C12, C13, C14
- **AC-13** U24, U25, S25, C15, C20
- **AC-14** C7, C8, C9, S11, S27, S28, C19
- **AC-15** C4, C6, C16, C19
