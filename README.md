# Crochet PeakZ

Handmade crochet e-commerce platform for domestic (Bangladesh) and
international customers. Next.js storefront, Express.js API, PostgreSQL, all
TypeScript in one npm workspaces monorepo.

## Workspaces

| Package           | Purpose                                   |
| ----------------- | ----------------------------------------- |
| `apps/web`        | Next.js 16 storefront and admin UI        |
| `apps/api`        | Express.js REST API and Prisma data layer |
| `packages/shared` | Shared types, Zod schemas, and constants  |

## Local development

```bash
npm install
cp .env.example .env            # fill in DATABASE_URL and other values
npm run dev                      # shared watch build + API + web
```

- Web: http://localhost:3000
- API: http://localhost:4000 (`/api/health`)
- PostgreSQL 18 must be running locally, or start only the database with
  `docker compose up -d db` and point `DATABASE_URL` at it.

Run migrations and seed data the first time:

```bash
npm run db:migrate --workspace=@crochet-peakz/api
npm run db:seed --workspace=@crochet-peakz/api
```

## Checks

```bash
npm run build      # shared -> api -> web
npm run typecheck
npm run lint
npm run test
```

Auth tests never call live Google, Facebook, or Resend:

- The API OAuth integration suite runs the real Passport, router, PostgreSQL,
  JWT, and cookie layers against a local mock provider
  (`apps/api/src/presentation/auth/oauth.integration.test.ts`). No provider
  login page, CAPTCHA, or account is involved.
- The email tests assert the exact envelope handed to the Resend transport,
  including the `EMAIL_FROM` sender, without sending anything.
- For a manual browser run, start the mock provider, copy the six URLs it
  prints, and start the dev stack with them:

  ```bash
  npm run dev:mock-oauth --workspace=@crochet-peakz/api
  GOOGLE_AUTH_URL=... GOOGLE_TOKEN_URL=... GOOGLE_USERINFO_URL=... \
    FACEBOOK_AUTH_URL=... FACEBOOK_TOKEN_URL=... FACEBOOK_PROFILE_URL=... \
    npm run dev
  ```

  The mock provider addresses are documented in
  [docs/deployment.md](docs/deployment.md).

### End to end (Playwright)

The browser suite in `e2e/` drives a real browser against the real web app and
the real API, through the Next.js proxy. It needs PostgreSQL, the seeded
accounts, and both servers running (`npm run dev`). `webServer` reuses servers
that are already up.

```bash
npx playwright test                    # both projects
npx playwright test --project=desktop  # one project
```

Three things worth knowing before you add a test:

- **Every test gets its own client IP.** AC-12 throttles sign in at ten requests
  per fifteen minutes and register at five per hour, per client IP. A shared
  address would spend its budget partway through the suite and then fail on
  limits it never meant to test. The `clientIp` fixture sets a random
  `X-Forwarded-For` per test, so the suite does not need a fresh API process
  between runs. The limits themselves are asserted in
  `apps/api/src/presentation/auth/routes.integration.test.ts`, which passes an
  address explicitly.
- **The home page mounts no site header.** It is still the scaffold, so the
  account menu and the signed out header can only be observed on `/verify-email`
  or `/admin`. Assertions that expect a header on `/` cannot pass.
- Playwright artifacts land in `/tmp/crochet-peakz-playwright`, outside the
  repository on purpose: the dev servers watch the repo root, so a trace written
  inside it triggers a rebuild that reloads the page under test.

`e2e/tsconfig.json` puts the harness under `npm run typecheck` and `npm run lint`
alongside the workspaces. It is a separate project because the harness sits
outside every workspace; without it Playwright's esbuild transform strips types
without checking them, so a type error would reach CI only as a runtime failure.
`npm run typecheck:e2e` and `npm run lint:e2e` run just this part.

## Deployment

The app is platform agnostic and runs on any Node.js or Docker host, including
self-hosted. Vercel and Heroku remain supported managed options.

```bash
cp .env.docker.example .env
docker compose up -d --build
```

See [docs/deployment.md](docs/deployment.md) for Docker Compose, one-origin
reverse proxy, Vercel, Heroku, bare Node, migrations, health checks, and
troubleshooting.

## Documentation

- [AGENTS.md](AGENTS.md): project conventions and architecture rules
- [docs/scope/](docs/scope/): product scope and the original spec reference
- [docs/specs/](docs/specs/): accepted design decisions
- [docs/deployment.md](docs/deployment.md): deployment runbook
