# 0004. Platform-agnostic deployment

**Date**: 2026-10-19
**Status**: Accepted

## Summary

The application must run on any host that can run Node.js or Docker, including
a self-hosted VPS, while still allowing the frontend on Vercel and the backend
on Heroku. The application code stays unchanged in shape: Next.js web, Express
API, PostgreSQL. What changes is the deployment contract around it: standalone
web output, a compiled API, environment-driven networking, health probes,
graceful shutdown, container images, and documentation that treats managed
platforms as optional.

This spec amends the hosting portions of [0001](../0001-stack-and-architecture/index.md)
and is implemented in the same change.

## Context

The stack spec chose Vercel for the frontend and Heroku for the backend and
database. That choice leaked into decisions and documentation:

- The API production build emitted `dist/src/index.js` while `start` pointed at
  `dist/index.js`, so `npm start` ran stale or missing code.
- The shared workspace package pointed at TypeScript source, which a compiled
  Node process cannot import at runtime.
- CORS accepted one hardcoded default origin, with no way to run web and API on
  several hosts or behind a proxy.
- There was no container image, reverse proxy example, health/readiness
  endpoint, or graceful shutdown.
- Prisma required a `DIRECT_URL` in addition to `DATABASE_URL`, a provider
  detail that self-hosted PostgreSQL does not need.
- Docs described Vercel and Heroku as the deployment targets rather than
  examples.

Portability is a product requirement, not a hosting preference: the store must
be able to move between a managed platform and a self-hosted server without a
code rewrite.

## Decision

**Chosen option**: A portable Node.js/Docker runtime contract with optional
managed-platform integrations.

1. **Web** builds with Next.js `output: "standalone"` and traces files from the
   monorepo root. A container runs `node apps/web/server.js`. Vercel can still
   build the same app through its Next.js preset.
2. **API** compiles to `apps/api/dist/index.js` with a build-only tsconfig. The
   shared package compiles to JavaScript and provides its `dist` entry points.
   Production never executes TypeScript from a workspace.
3. **Networking** is environment driven: `PORT`, `HOST`, `CORS_ORIGIN` (list),
   `TRUST_PROXY`, and `NODE_ENV`. The API validates them at startup and binds to
   `0.0.0.0` by default.
4. **Database** uses a single `DATABASE_URL`. Prisma migrations use the same
   connection, so self-hosted PostgreSQL needs no extra variable. Providers
   that separate pooled and migration connections use the direct/session URL.
5. **Operations**: `/api/health` (liveness), `/api/health/ready` (DB readiness),
   `/health` (web liveness), SIGTERM/SIGINT graceful shutdown, non-root
   containers, and Docker health checks.
6. **Delivery**: one multi-stage `Dockerfile` with `api` and `web` targets,
   `docker-compose.yml` for web + API + PostgreSQL, and optional Caddy/Nginx
   examples for one-origin deployment. `Procfile` and `heroku-postbuild` keep
   the Heroku Node buildpack path working.
7. **Docs** describe Docker/Compose as the reference self-hosted path and treat
   Vercel and Heroku as supported examples.

## Acceptance criteria

- **AC-1**: `npm run build` produces `apps/api/dist/index.js` and
  `apps/web/.next/standalone/apps/web/server.js`; the API `start` script runs
  the emitted file.
- **AC-2**: `@crochet-peakz/shared` builds to ESM in `dist/`, with types and
  runtime entry points that Node can import. Dev, build, and typecheck scripts
  build it before consumers.
- **AC-3**: The API starts with only `DATABASE_URL` supplied, binds to
  `0.0.0.0:4000` by default, accepts `PORT`/`HOST` overrides, and fails fast on
  invalid values.
- **AC-4**: `CORS_ORIGIN` accepts a comma separated list of exact origins,
  rejects `*`, and defaults to `http://localhost:3000` when absent.
- **AC-5**: `TRUST_PROXY` configures Express `trust proxy` only when set; the
  default is `false`.
- **AC-6**: `GET /api/health` returns 200 while the process is alive.
  `GET /api/health/ready` returns 200 when PostgreSQL responds and 503
  otherwise.
- **AC-7**: SIGTERM and SIGINT stop the HTTP server, disconnect Prisma, and exit
  within a bounded timeout.
- **AC-8**: `docker build --target api .` and `docker build --target web .`
  produce runnable, non-root images with health checks.
- **AC-9**: `docker compose up -d --build` starts PostgreSQL, the API, and the
  web server; `RUN_MIGRATIONS=true` applies Prisma migrations once before the
  API starts.
- **AC-10**: `DATABASE_URL` is the only database variable required by the
  Prisma schema; no `DIRECT_URL` is required.
- **AC-11**: `.env.example`, `apps/api/.env.example`,
  `apps/web/.env.local.example`, and `.env.docker.example` document runtime
  versus build-time variables.
- **AC-12**: `docs/deployment.md` covers Compose, one-origin reverse proxying,
  Vercel, Heroku, bare Node, migrations, health checks, and troubleshooting.
- **AC-13**: `npm run typecheck`, `npm run lint`, `npm run test`, and
  `npm run build` pass from a clean install.

## Runtime contract

| Concern        | Contract                                                   |
| -------------- | ---------------------------------------------------------- |
| API listen     | `HOST` (default `0.0.0.0`) and `PORT` (default `4000`)     |
| Web listen     | `HOSTNAME` (default `0.0.0.0`) and `PORT` (default `3000`) |
| Database       | `DATABASE_URL` (PostgreSQL 18)                             |
| Browser origin | `CORS_ORIGIN` comma separated, no wildcard                 |
| Proxy          | `TRUST_PROXY=false` by default; `1` behind one proxy       |
| Web API URL    | `NEXT_PUBLIC_API_URL`, baked at build time                 |
| Migrations     | `npm run db:deploy --workspace=@crochet-peakz/api`         |
| Liveness       | `GET /api/health`, `GET /health`                           |
| Readiness      | `GET /api/health/ready`                                    |
| Shutdown       | SIGTERM/SIGINT, 10 second maximum                          |

## Implementation map

| Area            | Files                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| Shared build    | `packages/shared/package.json`, `packages/shared/tsconfig*.json`, `packages/shared/src/**`              |
| API build       | `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/tsconfig.build.json`                       |
| API runtime     | `apps/api/src/index.ts`, `apps/api/src/config/env.ts`, `apps/api/src/infrastructure/database/prisma.ts` |
| Health          | `apps/api/src/presentation/routes/health.routes.ts`, `apps/web/src/app/health/route.ts`                 |
| Database        | `apps/api/prisma/schema.prisma`                                                                         |
| Web build       | `apps/web/next.config.ts`                                                                               |
| Containers      | `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `deploy/`                                          |
| Managed hosts   | `Procfile`, root `package.json` (`heroku-postbuild`)                                                    |
| Docs and config | `docs/deployment.md`, `.env*.example`, `AGENTS.md`, spec 0001                                           |

## Consequences

**Positive**:

- The same build artifacts run on a VPS, Docker host, PaaS, or Vercel/Heroku.
- One origin through a reverse proxy removes CORS and future cookie problems.
- Health/readiness probes and graceful shutdown make container restarts safe.
- A single database URL lowers self-hosting friction.
- Compiling the shared package fixes a production-only runtime failure.

**Negative**:

- Self-hosting transfers TLS, backups, monitoring, and patching to the operator.
- The Docker images add a build step and require rebuilds when
  `NEXT_PUBLIC_API_URL` changes.
- Running migrations automatically is only safe for one replica; larger
  deployments need a release job.
- Next.js standalone output ties deployment to a Node server; a future move to
  static export would be a separate decision.

## Verification

- `npm run build` from the repository root.
- Start the API against PostgreSQL and check `/api/health` and
  `/api/health/ready`.
- Start the standalone web server and check `/health`.
- `docker compose up -d --build` and repeat the checks.
- `NEXT_PUBLIC_API_URL=/api docker compose --profile proxy up -d --build` and
  verify the browser reaches the API through one origin.
- Run `npm run typecheck`, `npm run lint`, and `npm run test`.
