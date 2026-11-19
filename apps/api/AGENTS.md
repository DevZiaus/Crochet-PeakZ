# apps/api

## Overview

Express.js backend for Crochet PeakZ, written in TypeScript. Serves a REST API for the Next.js frontend. Uses Prisma ORM with PostgreSQL for persistence and follows Clean Architecture with four layers.

The API is deployment agnostic: it reads `HOST` and `PORT` from the environment, exposes liveness/readiness health endpoints, and shuts down gracefully on SIGTERM/SIGINT. See `docs/deployment.md`.

## Stack

- **Runtime**: Node.js 24.20.0, TypeScript (strict mode, extends `tsconfig.base.json`)
- **Framework**: Express.js
- **ORM**: Prisma 7 (`prisma/schema.prisma`, client generated into `src/generated/prisma`, `@prisma/adapter-pg` driver)
- **Validation**: Zod (shared schemas from `@crochet-peakz/shared`)
- **Dev server**: tsx (`tsx watch`, native ESM support with hot reload)

## Commands

```bash
# Dev server (hot reload)
npm run dev --workspace=@crochet-peakz/api

# Test (Vitest; integration tests need a running PostgreSQL)
npm run test --workspace=@crochet-peakz/api

# Local OAuth mock provider for a manual browser run
npm run dev:mock-oauth --workspace=@crochet-peakz/api

# Build (builds shared first; prisma generate + compile to dist/index.js)
npm run build:shared && npm run build --workspace=@crochet-peakz/api

# Typecheck (builds shared first; includes prisma/seed.ts)
npm run build:shared && npm run typecheck --workspace=@crochet-peakz/api

# Start (production, runs dist/index.js)
npm run start --workspace=@crochet-peakz/api

# Database
npm run db:generate --workspace=@crochet-peakz/api   # regenerate src/generated/prisma
npm run db:migrate --workspace=@crochet-peakz/api    # dev migration + client regen
npm run db:deploy --workspace=@crochet-peakz/api     # production migrations
npm run db:seed --workspace=@crochet-peakz/api       # local seed data
npm run db:status --workspace=@crochet-peakz/api
npm run db:studio --workspace=@crochet-peakz/api
```

## Key files

| File                                                  | Owns                                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/index.ts`                                        | Composition root: env + database setup, Express app, listen, graceful shutdown       |
| `src/app.ts`                                          | Express app factory shared by `index.ts` and integration tests                       |
| `src/domain/entities/`                                | `User` and `Session` entities with the auth invariants                               |
| `src/application/use-cases/`                          | Auth use cases: register, login, refresh, verify, reset, OAuth, me, and logout       |
| `src/infrastructure/auth/`                            | bcrypt password hasher and `jose` access token service                               |
| `src/infrastructure/email/`                           | Resend sender and the auth email templates                                           |
| `src/infrastructure/oauth/`                           | Passport Google and Facebook strategies                                              |
| `src/presentation/auth/`                              | Auth routes, middleware, cookies, proxy guard, and throttling                        |
| `src/domain/catalog/`                                 | Catalog visibility, stock, pricing, image, variant, and category tree rules          |
| `src/application/catalog/`                            | Catalog list/detail use cases and DTO mappers                                        |
| `src/infrastructure/database/catalog.repository.ts`   | Prisma catalog reads with visibility and subtree counts                              |
| `src/infrastructure/cloudinary/image-url-resolver.ts` | Cloudinary public id to delivery URL resolver                                        |
| `src/presentation/catalog/`                           | Public catalog routes and strict query validation                                    |
| `src/config/env.ts`                                   | Environment parsing and validation (runtime, auth, OAuth, email, and proxy settings) |
| `src/infrastructure/database/prisma.ts`               | Prisma client + `@prisma/adapter-pg` factory, health check, disconnect helper        |
| `src/generated/prisma/`                               | Generated Prisma Client (gitignored; recreated by `prisma generate`)                 |
| `prisma/schema.prisma`                                | Database schema (PostgreSQL, single `DATABASE_URL`)                                  |
| `prisma.config.ts`                                    | Prisma CLI config: datasource URL, schema path, migrations path, and seed command    |
| `prisma/seed.ts`                                      | Seed script for realistic local data (users, categories, products, settings)         |
| `src/presentation/routes/health.routes.ts`            | `/api/health` (liveness) and `/api/health/ready` (PostgreSQL readiness)              |
| `src/presentation/middleware/errorHandler.ts`         | Centralized error handler and `AppError` class                                       |
| `src/presentation/auth/oauth.integration.test.ts`     | Full OAuth round trip against the local mock provider                                |
| `src/test-support/mock-oauth-provider.ts`             | In-process authorize, token, and profile provider for tests                          |
| `scripts/mock-oauth-provider.ts`                      | Manual mock provider started by `npm run dev:mock-oauth`                             |
| `tsconfig.json`                                       | Typecheck config: `src` + `scripts` + `prisma`, no emit                              |
| `tsconfig.build.json`                                 | Build config: emits `src` to `dist/` only                                            |
| `.env` / `.env.example`                               | Backend environment variables (DATABASE_URL, JWT, OAuth, Cloudinary, payments)       |

## Conventions

- **Clean Architecture layers**: `domain/` → `application/` → `infrastructure/` → `presentation/`. Dependencies flow inward. Domain has zero external imports.
- **Error handling**: throw `AppError(statusCode, message)` for expected errors; the centralized `errorHandler` middleware catches all and returns consistent JSON.
- **Env validation**: `loadEnv()` in `src/config/env.ts` runs at startup and throws on invalid values. Add new variables there and document them in `.env.example` and `docs/deployment.md`.
- **Auth boundary**: all auth routes mount under `/api/auth`, require the proxy shared secret, and reject state changing requests whose `Origin` does not match `WEB_APP_URL`. Auth logic stays in the Clean Architecture layers; presentation only translates HTTP.
- **Public catalog boundary**: `/api/products`, `/api/products/:slug`, `/api/categories`, and `/api/categories/:slug` are public GET routes with no session or proxy secret. The list query is validated with the shared Zod schema (400 `INVALID_QUERY`); missing or invisible slugs return 404. Category slugs expand to subtrees in the application layer, and the repository applies visibility on every read.
- **Route mounting**: all routers mount under `/api` (e.g. `app.use("/api", createHealthRouter(...))`).
- **Health probes**: keep `/api/health` dependency-free (liveness) and back `/api/health/ready` with a real dependency check.
- **Module system**: ESM (`"type": "module"`, `module: NodeNext`, `moduleResolution: NodeNext`). `tsx` runs TypeScript in dev; `tsc -p tsconfig.build.json` emits `dist/index.js` for production.
- **Prisma client**: generated by the `prisma-client` provider into `src/generated/prisma`. Import from `client.js` (or `enums.js` for enum values) and always create the client with a `PrismaPg` adapter.
- **Prisma model naming**: models use PascalCase, table names use `@@map("snake_case")`, column aliases via `@map("snake_case")`.
- **Deployment**: containers run the `api` target from the root `Dockerfile`. The image includes `prisma.config.ts`; `RUN_MIGRATIONS=true` applies `prisma migrate deploy` before start (single instance only).

## Gotchas

- The server starts even if the database connection fails, so `/api/health` can return OK while database queries fail. Use `/api/health/ready` to gate traffic.
- `npm start` requires a prior build. Without `dist/index.js`, the process exits immediately.
- Prisma 7 generates the client into `src/generated/prisma` (gitignored). `dev`, `build`, `typecheck`, `lint`, and `db:seed` run `prisma generate` first; run `db:generate` manually after changing the schema.
- Prisma 7 uses `@prisma/adapter-pg`, so connection pooling and TLS follow `pg` defaults. The adapter sets a 5s connection timeout and 300s idle timeout to match Prisma 6 behaviour. If your provider uses a private CA, pass `sslmode`/`sslcert` in `DATABASE_URL` or set `NODE_EXTRA_CA_CERTS` instead of disabling certificate validation.
- The build emits only `src/`; `prisma/seed.ts` is typechecked but not compiled. Use `tsx` for seeding locally.
- `@crochet-peakz/shared` resolves to compiled JavaScript in `packages/shared/dist`. Build it first (`npm run build:shared` at the repo root) or run commands through the root scripts, which do it automatically.
- `CORS_ORIGIN` accepts a comma separated list and rejects `*` because credentials are enabled.
- Behind a reverse proxy or a PaaS router, set `TRUST_PROXY=1` so Express reads `X-Forwarded-Proto` and `X-Forwarded-For`.
- The six `GOOGLE_*` / `FACEBOOK_*` endpoint URLs are test-only overrides for the local mock provider. `loadEnv()` rejects them when `NODE_ENV=production`. The OAuth integration suite starts its own mock; `npm run dev:mock-oauth` prints the values for a manual browser run.

## Related specs

- [0001 Stack and architecture](../../docs/specs/0001-stack-and-architecture/index.md)
- [0002 Data model](../../docs/specs/0002-data-model/index.md)
- [0004 Platform-agnostic deployment](../../docs/specs/0004-platform-agnostic-deployment/index.md)
- [0006 Product catalog storefront](../../docs/specs/0006-product-catalog-storefront/index.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
