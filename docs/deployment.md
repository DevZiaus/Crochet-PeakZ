# Deployment

Crochet PeakZ is a decoupled app: a Next.js web server, an Express API, and
PostgreSQL. Nothing in the runtime depends on Vercel, Heroku, or any other
platform. Vercel and Heroku remain supported options, but Docker Compose is the
reference self-hosted deployment.

```
Browser ──► reverse proxy (optional) ──► web (Next.js, :3000)
                   │                         └──► /api/auth/* ──► api (Express, :4000)
                   └──► other /api/* ──────────────────────────► api (Express, :4000)

api ──► PostgreSQL
```

## Portability contract

These are the rules the code follows so a host only has to provide Node.js and
environment variables:

- The API reads `PORT` and `HOST` and listens on `0.0.0.0` by default.
- The web server is built with `output: "standalone"`. The Docker image copies
  the standalone server plus `.next/static` and `public`, so it runs without
  `next start` or the full monorepo.
- All shared code is compiled to JavaScript before the API starts. Production
  does not rely on transpiling TypeScript from a workspace at runtime.
- No filesystem persistence is assumed. Uploads go to Cloudinary.
- No provider SDK is used for hosting. TLS, proxying, and process supervision
  are deployment concerns.
- Every secret and URL comes from an environment variable.
- Health endpoints exist for container and load balancer probes.

## Quick start with Docker Compose

```bash
cp .env.docker.example .env
# edit POSTGRES_PASSWORD and any future application secrets

docker compose up -d --build
```

That starts:

| Service | Default URL           | Notes                                 |
| ------- | --------------------- | ------------------------------------- |
| web     | http://localhost:3000 | Next.js standalone server             |
| api     | http://localhost:4000 | Express API, `/api/health`            |
| db      | internal `db:5432`    | PostgreSQL 18, persisted in `db-data` |

Migrations run on API start because `RUN_MIGRATIONS=true` in the example env.
For several API replicas, set it to `false` and run migrations once per release:

```bash
docker compose run --rm api npm run db:deploy --workspace=@crochet-peakz/api
```

Check the running services:

```bash
curl http://localhost:4000/api/health
curl http://localhost:4000/api/health/ready
curl http://localhost:3000/health
```

Stop the stack with `docker compose down`. Add `-v` only when you intentionally
want to delete the database volume.

## One origin with a reverse proxy

Using one origin avoids CORS and keeps auth cookies first-party. Rebuild the web
image when `NEXT_PUBLIC_API_URL` changes because Next.js inlines it at build
time.

```bash
# .env
NEXT_PUBLIC_API_URL=/api
CORS_ORIGIN=https://shop.example.com
TRUST_PROXY=1
DOMAIN=shop.example.com

# Customer auth: the same secret on both services, and the public origin the
# browser uses. The web container reaches the API over the compose network.
API_INTERNAL_URL=http://api:4000/api
PROXY_SHARED_SECRET=<same value as the API>
WEB_APP_URL=https://shop.example.com

docker compose --profile proxy up -d --build
```

The optional Caddy service in `docker-compose.yml` terminates TLS, sends
`/api/auth/*` to the web server so the Next.js auth proxy can add the shared
secret, sends other `/api/*` requests to the API, and sends everything else to
the web server. `deploy/Caddyfile` is the configuration. For Nginx, start from
`deploy/nginx.conf.example`.

If the web and API are on different origins, set `NEXT_PUBLIC_API_URL` to the
absolute API URL and list the web origin in `CORS_ORIGIN`:

```bash
NEXT_PUBLIC_API_URL=https://api.example.com/api
CORS_ORIGIN=https://shop.example.com,https://preview.example.com
```

Wildcards are rejected because the API enables credentialed CORS.

## Managed platforms

### Vercel (frontend)

- Root Directory: repository root (not `apps/web`).
- Install Command: `npm ci`
- Build Command: `npm run build:shared && npm run build --workspace=@crochet-peakz/web`
- Output Directory: `apps/web/.next`
- Node.js: 24.x
- Environment: `NEXT_PUBLIC_API_URL=https://api.example.com/api`
- Vercel builds from the repository root, so the shared workspace package is available.

### Heroku (backend)

The Node.js buildpack path works without Docker:

- `heroku-postbuild` builds the shared package and the API.
- `Procfile` declares the release migration and the web process.
- Config vars: `DATABASE_URL`, `CORS_ORIGIN`, `NODE_ENV=production`,
  `TRUST_PROXY=1` (Heroku terminates TLS at its router), plus future secrets.

Docker hosts can use the `api` target instead:

```bash
docker build --target api -t crochet-api .
```

Heroku Container Registry builds the final stage of a Dockerfile rather than a
selected target, so use the Node.js buildpack above or build and push the `api`
target from CI.

Any host that can run a Docker image or a Node process works the same way:
Render, Fly.io, Railway, a VPS, or Kubernetes. Point the platform at the `api`
or `web` target and provide the environment variables below.

### Bare-metal Node.js

```bash
npm ci
npm run build
DATABASE_URL=postgresql://... npm run db:deploy --workspace=@crochet-peakz/api
npm run start:api   # or run both under systemd/PM2
npm run start:web
```

`npm run start:web` runs `next start` from a full checkout. If you deploy only
the standalone artifact, copy `apps/web/.next/static` and `apps/web/public` into
`apps/web/.next/standalone/apps/web/` (as the Dockerfile does), then run
`node apps/web/.next/standalone/apps/web/server.js`.

Run the web and API as separate processes behind Nginx, Caddy, or another
reverse proxy. The proxy should send `/api/auth/*` to port 3000, other `/api/*`
requests to port 4000, and everything else to port 3000.

## Environment variables

### Runtime

| Variable         | Required | Default                 | Purpose                                         |
| ---------------- | -------- | ----------------------- | ----------------------------------------------- |
| `DATABASE_URL`   | yes      | —                       | PostgreSQL connection string used by Prisma     |
| `PORT`           | no       | `4000` (API), `3000`    | HTTP listen port                                |
| `HOST`           | no       | `0.0.0.0`               | Interface to bind                               |
| `NODE_ENV`       | no       | `development`           | `development`, `test`, or `production`          |
| `CORS_ORIGIN`    | no       | `http://localhost:3000` | Comma separated allowed origins; no `*`         |
| `TRUST_PROXY`    | no       | `false`                 | Express `trust proxy`; use `1` behind one proxy |
| `RUN_MIGRATIONS` | no       | `false`                 | Docker entrypoint runs `prisma migrate deploy`  |

### Customer auth (API, required)

These are validated at startup; the API refuses to start when one is missing,
shorter than its minimum, or still looks like a sample value.

| Variable               | Purpose                                                                  |
| ---------------------- | ------------------------------------------------------------------------ |
| `JWT_SECRET`           | HS256 access token and OAuth state secret, at least 32 characters        |
| `JWT_REFRESH_SECRET`   | Refresh token hash key, at least 32 characters, different from the above |
| `PROXY_SHARED_SECRET`  | Shared secret the web proxy must send on every auth request, 16+ chars   |
| `WEB_APP_URL`          | Public web origin used in email links, OAuth callbacks, and redirects    |
| `GOOGLE_CLIENT_ID`     | Google OAuth 2.0 client id                                               |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret                                           |
| `FACEBOOK_APP_ID`      | Facebook app id                                                          |
| `FACEBOOK_APP_SECRET`  | Facebook app secret                                                      |
| `RESEND_API_KEY`       | Resend API key for verification and reset mail                           |
| `EMAIL_FROM`           | Verified sender, for example `Crochet PeakZ <hello@example.com>`         |

Other feature secrets (Cloudinary, payment gateways, monitoring) are documented
in `apps/api/.env.example`.

### Build time (web)

| Variable              | Purpose                                                          |
| --------------------- | ---------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | Browser-facing API base URL, e.g. `/api` or `https://api.../api` |

`NEXT_PUBLIC_*` values are baked into the client bundle. Changing one requires a
new web build; it is not a runtime setting.

### Auth proxy (web runtime)

Read by the Next.js server on each auth request, never sent to the browser.

| Variable              | Purpose                                                            |
| --------------------- | ------------------------------------------------------------------ |
| `API_INTERNAL_URL`    | API base URL including `/api`, reached from the web server         |
| `PROXY_SHARED_SECRET` | Must equal the API value; the API rejects auth calls without it    |
| `WEB_APP_URL`         | Public origin of this web app, used for the proxy's `Origin` check |

`NEXT_PUBLIC_API_URL` is only for browser calls to non-auth endpoints. The auth
screens always talk to the web origin (`/api/auth/*`), and the web server
forwards them to `API_INTERNAL_URL` with the shared secret.

## Health checks

| Endpoint                | Meaning                                      |
| ----------------------- | -------------------------------------------- |
| `GET /api/health`       | API process is alive (used by Docker/Heroku) |
| `GET /api/health/ready` | API can reach PostgreSQL (503 until it can)  |
| `GET /health`           | Next.js web server is alive                  |

Use `/api/health` for liveness and `/api/health/ready` for readiness when your
orchestrator supports both.

## Database and migrations

- Any PostgreSQL 18 server works: Compose, a VPS, Supabase, Neon, RDS, or
  Heroku Postgres.
- `DATABASE_URL` is the only database variable. Prisma migrations and the
  runtime read it. If a provider offers a pooled URL and a direct URL, use the
  direct/session URL because the API is a long-lived process.
- Prisma 7 reads the CLI datasource URL, schema path, migration path, and seed
  command from `apps/api/prisma.config.ts`.
- Prisma Client is generated with the `prisma-client` provider into
  `apps/api/src/generated/prisma` (gitignored). `dev`, `build`, `typecheck`,
  `lint`, and `db:seed` generate it automatically; run
  `npm run db:generate --workspace=@crochet-peakz/api` after changing the schema.
- At runtime the API connects through `@prisma/adapter-pg` (the `pg` driver).
  Connection and idle timeouts are tuned to the Prisma 6 defaults. TLS follows
  the `sslmode`/`sslcert` parameters in `DATABASE_URL`; when a provider uses a
  private CA, set `NODE_EXTRA_CA_CERTS` instead of disabling validation.
- The API image copies `prisma.config.ts`, so `RUN_MIGRATIONS=true` applies
  migrations against the same `DATABASE_URL` the server uses.
- Dev migrations: `npm run db:migrate --workspace=@crochet-peakz/api`
- Production migrations: `npm run db:deploy --workspace=@crochet-peakz/api`
- Seed data is for local development only. Start the Compose database and run
  `npm run db:seed --workspace=@crochet-peakz/api` from a checkout with dev
  dependencies installed.

Always take a database backup before a production migration.

## Reverse proxy and cookies

When TLS terminates at a proxy, set `TRUST_PROXY=1` so Express reads
`X-Forwarded-Proto` and `X-Forwarded-For`. Otherwise secure-cookie and rate
limit decisions can be wrong.

For future authentication:

- Same origin (recommended): cookies are first-party, `SameSite=Lax` works.
- Separate origins: cookies need `SameSite=None; Secure`, and both origins need
  HTTPS. The API's `CORS_ORIGIN` must list the exact web origin.

## Troubleshooting

| Symptom                                   | Likely cause                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| API container exits immediately           | `DATABASE_URL` missing or migrations failed                                                     |
| `/api/health` works, `/ready` returns 503 | Database not reachable; check `DATABASE_URL` and network access                                 |
| Browser calls the wrong API host          | `NEXT_PUBLIC_API_URL` was changed without rebuilding the web image                              |
| CORS error                                | Origin missing from `CORS_ORIGIN`, or a wildcard was configured                                 |
| Cookies not set behind a proxy            | `TRUST_PROXY` not set, or proxy does not send `X-Forwarded-Proto`                               |
| `npm start` runs old code                 | Rebuild first: `npm run build`; API output is `apps/api/dist/index.js`                          |
| Prisma engine error on a non-Docker host  | Install OpenSSL and run `npm run db:generate --workspace=@crochet-peakz/api` on that host       |
| `Cannot find module .../generated/prisma` | Run `npm run db:generate --workspace=@crochet-peakz/api`; the folder is gitignored              |
| Prisma TLS/certificate error after v7     | `pg` validates certificates; add `sslmode`/`sslcert` to `DATABASE_URL` or `NODE_EXTRA_CA_CERTS` |
