# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Platform-agnostic deployment: multi-stage `Dockerfile` with `api` and `web` targets, `docker-compose.yml` with PostgreSQL, container health checks, optional Caddy/Nginx one-origin proxy examples, and `docs/deployment.md`
- API readiness endpoint `GET /api/health/ready` (checks PostgreSQL) and web liveness endpoint `GET /health`
- Added Husky pre-commit hooks and lint-staged to run ESLint and Prettier on staged files before every commit
- Bumped `engines.node` requirement to `>=24.20.0` to match the pinned Node.js version

### Changed

- Deployment is now platform agnostic; Vercel (frontend) and Heroku (backend) are supported options instead of requirements
- Shared workspace package compiles to ESM in `packages/shared/dist`, and the API builds to `apps/api/dist/index.js` so `npm start` runs the real production output
- API networking is environment driven (`HOST`, `PORT`, comma separated `CORS_ORIGIN`, `TRUST_PROXY`) with graceful SIGTERM/SIGINT shutdown
- Prisma uses a single `DATABASE_URL`; the separate `DIRECT_URL` variable is no longer required
- Node.js runtime pinned at 24.20.0; workspaces use ESM (`"type": "module"`) with NodeNext resolution so compiled output runs under Node without a bundler
- Added a strict ESLint flat config across the monorepo (strict type checked rules, no-default-exports, naming conventions) with workspace specific overrides for the Next.js frontend and Express.js backend
- Added Prettier with consistent formatting (2 space indent, double quotes, semicolons, trailing commas) and a `.prettierignore` covering build outputs and lock files
