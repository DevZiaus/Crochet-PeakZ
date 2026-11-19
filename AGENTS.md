# Crochet PeakZ

## Stack

- **Language / Runtime**: TypeScript, Node.js 24.20.0 (`.nvmrc` pins it; `engines` enforces `>=24.20.0`)
- **Frontend**: Next.js (App Router), React, Tailwind CSS, Radix UI / Shadcn UI, Zustand
- **Backend**: Express.js (TypeScript)
- **Database**: PostgreSQL, Prisma ORM
- **Auth**: JWT (HttpOnly cookies), OAuth 2.0 (Google, Facebook)
- **Storage**: Cloudinary (all uploads, product media, digital assets)
- **Email**: Resend or SendGrid
- **Payments**: Stripe, PayPal, SSLCommerz, Cash on Delivery
- **Package manager**: npm
- **Deployment**: Platform agnostic (any Node.js or Docker host; self-hosted via Docker Compose). Vercel (frontend) and Heroku (backend) are supported managed options. See `docs/deployment.md`.

_Stack sourced from `docs/scope/spec-reference.md` (the original project spec). These are the intended choices; `/architect stack & architecture` will validate and record the formal decision._

## Build approach

Tracer Bullet: prove the whole pipe works before building any part of it fully. Each feature is built end to end through every layer, real and shippable, just narrow in scope.

## Commands

```bash
# Install
npm install

# Dev server (hot reload api and web)
npm run dev

# Build (all workspaces)
npm run build

# Docker (self-hosted web + api + postgres)
docker compose up -d --build

# Typecheck
npm run typecheck

# Lint (ESLint across all workspaces)
npm run lint

# Format (Prettier, write mode)
npm run format

# Format check (CI, check mode)
npm run format:check

# Test
npm run test

# End to end tests (Playwright; starts its own servers and needs a seeded database)
npx playwright test
```

## Specs

Stored in `docs/specs/`. Format: `docs/specs/NNNN-title/index.md`.

Deployment guide: `docs/deployment.md` (Docker Compose, one-origin proxy, Vercel, Heroku, bare Node).

## Rules

### Architecture (Clean Architecture)

- Code is organized in four layers: `domain` (entities, value objects), `application` (use cases), `infrastructure` (DB, APIs, frameworks), `presentation` (UI, controllers).
- Dependency rule: outer layers depend on inner layers, never the reverse. Domain has zero external imports.
- Use cases are thin orchestrators. They call domain logic and infrastructure interfaces, never implement business rules themselves.
- Infrastructure implements interfaces defined in the domain or application layer (dependency inversion).
- No framework or ORM code (web framework, ORM, HTTP client, etc.) appears inside `domain/` or `application/`.
- Entities contain business rules and enforce their own invariants. They are plain objects with no ORM decorators.
- All cross boundary communication uses DTOs or plain objects. No domain entities leak into the presentation layer.
- Tests: domain and application layers are unit tested with no mocks of infrastructure. Infrastructure is integration tested against real systems.

### Type strictness

- Strict TypeScript everywhere: no `any`, exhaustive types, strict null checks (`strict: true` in tsconfig).

### Folder structure

- By Clean Architecture layer: `domain/`, `application/`, `infrastructure/`, `presentation/` (matches the architecture rules above).

### Code standards

- Document all public APIs with JSDoc/TSDoc on exported functions and types.
- Use a consistent error handling pattern: custom error classes with a centralized error handler middleware.
- Validate all environment variables at startup. Fail fast on missing config.
- Named exports only. No default exports.
- Naming: camelCase for functions and variables, PascalCase for types, interfaces, classes, and React components.
- Accessibility baseline on all UI: WCAG 2.1 AA.
- Conventional commit messages: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `style:`, `perf:`.

### Deployment portability

- The app runs on any Node.js or Docker host, including self-hosted. No hosting-specific APIs, filesystem persistence, or platform SDKs in application code.
- All runtime configuration comes from environment variables, validated at startup. Document new variables in the `.env*.example` files and `docs/deployment.md`.
- The API binds to `HOST`/`PORT` and exposes `/api/health` (liveness) and `/api/health/ready` (database readiness). The web server exposes `/health`.
- Containers run as non-root and stay stateless; uploads go to Cloudinary.
- `NEXT_PUBLIC_*` values are inlined at build time; changing one requires rebuilding the web app.
- Shared workspace code must compile to JavaScript before the API runs in production.

## Tooling

_Choices recorded here. `/develop tooling` installs them._

- **Linter**: ESLint (with TypeScript rules)
- **Formatter**: Prettier
- **Pre commit**: Husky + lint-staged (lint + format + typecheck on every commit)
- **Testing**: Vitest (unit/integration), React Testing Library (components), Playwright (E2E)
- **Auth test isolation**: never call live Google, Facebook, or Resend from tests. OAuth tests use the local mock provider in `apps/api/src/test-support/mock-oauth-provider.ts`; email tests assert the envelope handed to the Resend transport. Manual steps are in `README.md` and `docs/deployment.md`.
- **CI**: GitHub Actions (lint, typecheck, test, and Playwright E2E against PostgreSQL on pull requests)

## Git

- integration: on
- branch prefix: feat/
- commit: per-milestone

## Personal notes

- `personalNotes.txt` is the repository owner's own file for tracking what to do next and for other notes. It is deliberately tracked in git. Never edit, overwrite, truncate, move, or delete it; only the owner changes that file. Treat it as read only input when you need context.

## Agent skills

- [scope](.agents/skills/scope/): workflow skill, turns ideas into living scope in `docs/scope/`
- [architect](.agents/skills/architect/): workflow skill, designs features and writes specs to `docs/specs/`
- [audit](.agents/skills/audit/): workflow skill, bootstraps project AI context (`AGENTS.md` files)
- [develop](.agents/skills/develop/): workflow skill, builds features from specs
- [check](.agents/skills/check/): workflow skill, verifies and reviews changes
- [debug](.agents/skills/debug/): workflow skill, finds and fixes bugs
- [test](.agents/skills/test/): workflow skill, writes test suites
- [document](.agents/skills/document/): workflow skill, writes human facing prose
- [sync](.agents/skills/sync/): workflow skill, keeps durable knowledge current

Installed for customer auth (spec 0005):

- [auth-implementation-patterns](.agents/skills/auth-implementation-patterns/): JWT, session, OAuth2, and role based access patterns
- [resend](.agents/skills/resend/): Resend SDK and API conventions for transactional email
- [email-best-practices](.agents/skills/email-best-practices/): email deliverability, SPF/DKIM/DMARC, and template guidance
- [react-email](.agents/skills/react-email/): React components for HTML email templates
- [resend-cli](.agents/skills/resend-cli/): terminal commands for the Resend platform
- [agent-email-inbox](.agents/skills/agent-email-inbox/): safe handling for inbound email that triggers actions

MCP servers: resend (`https://mcp.resend.com/mcp`, OAuth sign in required; used to inspect verification and reset mail in development)

Declined: Vitest · React Testing Library · Radix UI · Sonner (offered 2026-10-24, no Agent Skill installed)

Declined for customer auth (spec 0005): jose · passport · Playwright (offered 2026-11-08, no Agent Skill installed)

## Context files

- [apps/api/AGENTS.md](apps/api/AGENTS.md): Express.js backend, Clean Architecture layers, Prisma, env and error handling conventions
- [apps/web/AGENTS.md](apps/web/AGENTS.md): Next.js 16 frontend, App Router, Tailwind CSS, design system (`design.md`), storefront and catalog, components and layout
- [packages/shared/AGENTS.md](packages/shared/AGENTS.md): shared types, Zod schemas, constants consumed by both api and web
- [docs/deployment.md](docs/deployment.md): platform-agnostic deployment guide (Docker, Compose, reverse proxy, managed hosts)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
