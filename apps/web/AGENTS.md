# apps/web

## Overview

Next.js 16 (App Router, React 19) frontend for Crochet PeakZ. Serves the customer facing storefront, admin dashboard, and all UI. Styled with Tailwind CSS v4 and Shadcn UI components, themed by the design system in `design.md`.

The web app builds with `output: "standalone"` so it runs on any Node.js host or container. Vercel remains a supported managed option. See `docs/deployment.md`.

## Stack

- **Framework**: Next.js 16.3 (App Router), React 19
- **Styling**: Tailwind CSS v4 (PostCSS plugin), DM Sans + Playfair Display fonts
- **Validation**: Zod (shared schemas from `@crochet-peakz/shared`)
- **Path alias**: `@/*` maps to `./src/*`

## Commands

```bash
# Dev server (port 3000)
npm run dev --workspace=@crochet-peakz/web

# Build (builds shared first, emits .next/standalone server)
npm run build:shared && npm run build --workspace=@crochet-peakz/web

# Start (production, from a full checkout; Docker uses the standalone server)
npm run start --workspace=@crochet-peakz/web

# Typecheck
npm run typecheck --workspace=@crochet-peakz/web

# Lint
npm run lint --workspace=@crochet-peakz/web

# Test
npm run test --workspace=@crochet-peakz/web
```

## Key files

| File                                | Owns                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `src/app/layout.tsx`                | Root layout: HTML shell, fonts, metadata                                       |
| `src/app/page.tsx`                  | Home page (scaffold placeholder, imports from shared to verify workspace link) |
| `src/app/health/route.ts`           | `/health` liveness probe for containers and reverse proxies                    |
| `src/app/globals.css`               | Design tokens (light + `[data-theme="dark"]`), Tailwind imports                |
| `design.md`                         | Design system reference: tokens, type scale, component APIs, a11y rules        |
| `src/components/ui/`                | Shadcn UI primitives (Button, Input, Dialog, and the rest)                     |
| `src/components/`                   | Composed components built on the primitives                                    |
| `next.config.ts`                    | Standalone output, monorepo tracing root, image allowlist                      |
| `eslint.config.mjs`                 | ESLint config (Next.js preset)                                                 |
| `.env.local` / `.env.local.example` | Build-time `NEXT_PUBLIC_*` variables                                           |

## Conventions

- **App Router**: all pages live under `src/app/` using file system routing. Layouts, pages, loading, and error boundaries follow Next.js conventions.
- **No default exports** (project rule), except where Next.js requires them: `layout.tsx`, `page.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `route.ts` handlers use named exports, and `next.config.ts` must use a default export.
- **TypeScript**: standalone tsconfig (does not extend `tsconfig.base.json`), uses bundler module resolution, `strict: true`, `noUncheckedIndexedAccess: true`. Tests typecheck through a separate `tsconfig.test.json`; `npm run typecheck` runs both.
- **Shared package**: import types, schemas, and constants from `@crochet-peakz/shared`. It resolves to compiled JavaScript in `packages/shared/dist`; root scripts build it first.
- **Design system**: build all UI to `design.md` (tokens, type scale, component APIs, accessibility rules); token values live in CSS (`src/app/globals.css`). Primitives live in `src/components/ui/`, composed components in `src/components/`; a composed component imports from `ui/`, never the reverse. Every color resolves to a token, never a raw hex or Tailwind default.
- **Radix imports**: import primitives from the umbrella `radix-ui` package (`import { Dialog } from "radix-ui"`), never from individual `@radix-ui/react-*` packages. The umbrella is the only Radix runtime dependency.
- **Environment**: `NEXT_PUBLIC_*` values are inlined at build time. Changing `NEXT_PUBLIC_API_URL` requires a rebuild, not only a restart.
- **Deployment**: the root `Dockerfile` `web` target runs the standalone server on `PORT`/`HOSTNAME`. One-origin reverse proxy deployments use `NEXT_PUBLIC_API_URL=/api`.

## Agent skills

- [nextjs-app-router](.agents/skills/nextjs-app-router/): App Router routing, route handlers, data fetching, and caching conventions for work in this workspace

## Related specs

- [0001 Stack and architecture](../../docs/specs/0001-stack-and-architecture/index.md)
- [0003 Design system and UI foundation](../../docs/specs/0003-design-system/index.md)
- [0004 Platform-agnostic deployment](../../docs/specs/0004-platform-agnostic-deployment/index.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
