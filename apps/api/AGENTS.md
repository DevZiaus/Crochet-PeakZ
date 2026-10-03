# apps/api

## Overview

Express.js backend for Crochet PeakZ, written in TypeScript. Serves a REST API for the Next.js frontend. Uses Prisma ORM with PostgreSQL for persistence and follows Clean Architecture with four layers.

## Stack

- **Runtime**: Node.js 24.20.0, TypeScript (strict mode, extends `tsconfig.base.json`)
- **Framework**: Express.js
- **ORM**: Prisma (`prisma/schema.prisma`)
- **Validation**: Zod (shared schemas from `@crochet-peakz/shared`)
- **Dev server**: tsx (`tsx watch`, native ESM support with hot reload)

## Commands

```bash
# Dev server (hot reload)
npm run dev --workspace=apps/api

# Build
npm run build --workspace=apps/api

# Typecheck
npm run typecheck --workspace=apps/api

# Start (production)
npm run start --workspace=apps/api
```

## Key files

| File                                          | Owns                                                                              |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| `src/index.ts`                                | Server entry point: env validation, Express setup, Prisma connect, route mounting |
| `prisma/schema.prisma`                        | Database schema (PostgreSQL, 18 models and 9 enums for complete store model)      |
| `prisma/seed.ts`                              | Seed script for realistic local data (users, categories, products, settings)      |
| `src/presentation/routes/health.routes.ts`    | `/api/health` endpoint proving the server is alive                                |
| `src/presentation/middleware/errorHandler.ts` | Centralized error handler and `AppError` class                                    |
| `.env` / `.env.example`                       | Backend environment variables (DATABASE_URL, JWT, OAuth, Cloudinary, payments)    |

## Conventions

- **Clean Architecture layers**: `domain/` → `application/` → `infrastructure/` → `presentation/`. Dependencies flow inward. Domain has zero external imports.
- **Error handling**: throw `AppError(statusCode, message)` for expected errors; the centralized `errorHandler` middleware catches all and returns consistent JSON.
- **Env validation**: `validateEnv()` runs at startup. Add any new required variable to the `required` array in `src/index.ts`.
- **Route mounting**: all routers mount under `/api` (e.g. `app.use("/api", healthRouter)`).
- **Module system**: ESNext (`"module": "ESNext"`, `"moduleResolution": "Bundler"` in tsconfig). `"type": "module"` in package.json. `tsx` transpiles at dev time; `tsc` compiles to `dist/` for production.
- **Prisma model naming**: models use PascalCase, table names use `@@map("snake_case")`, column aliases via `@map("snake_case")`.

## Gotchas

- The server starts even if the database connection fails (warns instead of crashing), so the health check may return OK while DB queries fail.
- `tsconfig.json` extends the root `tsconfig.base.json` and overrides `rootDir`, `outDir`, `target` (ES2024), `module` (ESNext), and `moduleResolution` (Bundler). The shared package uses Node16 module resolution, so imports from `@crochet-peakz/shared` use `.js` extensions in their source.

## Related specs

- [0001 Stack and architecture](../../docs/specs/0001-stack-and-architecture/index.md)
- [0002 Data model](../../docs/specs/0002-data-model/index.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
