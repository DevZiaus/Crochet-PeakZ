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
