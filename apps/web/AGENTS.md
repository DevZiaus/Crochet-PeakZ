# apps/web

## Overview

Next.js 15 (App Router, React 19) frontend for Crochet PeakZ. Serves the customer facing storefront, admin dashboard, and all UI. Styled with Tailwind CSS v4 and will use Shadcn UI components.

## Stack

- **Framework**: Next.js 16.3 (App Router), React 19
- **Styling**: Tailwind CSS v4 (PostCSS plugin), Geist + Geist Mono fonts
- **Validation**: Zod (shared schemas from `@crochet-peakz/shared`)
- **Path alias**: `@/*` maps to `./src/*`

## Commands

```bash
# Dev server (port 3000)
npm run dev --workspace=apps/web

# Build
npm run build --workspace=apps/web

# Typecheck
npm run typecheck --workspace=apps/web

# Lint
npm run lint --workspace=apps/web
```

## Key files

| File | Owns |
|---|---|
| `src/app/layout.tsx` | Root layout: HTML shell, fonts, metadata |
| `src/app/page.tsx` | Home page (scaffold placeholder, imports from shared to verify workspace link) |
| `src/app/globals.css` | Global CSS, Tailwind imports |
| `next.config.ts` | Next.js configuration (currently empty) |
| `eslint.config.mjs` | ESLint config (Next.js preset) |

## Conventions

- **App Router**: all pages live under `src/app/` using file system routing. Layouts, pages, loading, and error boundaries follow Next.js conventions.
- **No default exports** (project rule), except where Next.js requires them: `layout.tsx`, `page.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, and `next.config.ts` must use default exports.
- **TypeScript**: standalone tsconfig (does not extend `tsconfig.base.json`), uses bundler module resolution, `strict: true`, `noUncheckedIndexedAccess: true`.
- **Shared package**: import types, schemas, and constants from `@crochet-peakz/shared`. The workspace link resolves at dev time with no build step.

## Related specs

- [0001 Stack and architecture](../../docs/specs/0001-stack-and-architecture/index.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
