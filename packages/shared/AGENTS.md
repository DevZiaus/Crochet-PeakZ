# packages/shared

## Overview

Shared TypeScript package consumed by both `apps/api` and `apps/web`. Contains types, Zod validation schemas, and constants that must stay in sync across the frontend and backend. No runtime dependencies beyond Zod.

It compiles to ESM JavaScript in `dist/` so the API can import it from a compiled Node process, and so the web build resolves a stable package entry point.

## Stack

- **Language**: TypeScript (strict mode, extends `tsconfig.base.json`)
- **Validation**: Zod
- **Module system**: ESM (`"type": "module"`, NodeNext resolution)
- **Entry points**: `main` and `types` point at `dist/index.js` and `dist/index.d.ts`

## Commands

```bash
# Build (emits dist/)
npm run build --workspace=@crochet-peakz/shared

# Watch build (used by root `npm run dev`)
npm run dev --workspace=@crochet-peakz/shared

# Typecheck (includes tests)
npm run typecheck --workspace=@crochet-peakz/shared

# Test
npm test --workspace=@crochet-peakz/shared
```

Root scripts (`npm run dev`, `npm run build`, `npm run typecheck`, `npm run lint`, `npm run test`) build this package first, so workspace commands normally just work.

## Key files

| File                      | Owns                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/index.ts`            | Barrel export: re-exports all public types, schemas, and constants                             |
| `src/types/index.ts`      | Domain types and enums mirroring the Prisma data model (Currency, UserRole, ProductType, etc.) |
| `src/schemas/index.ts`    | Zod validation schemas for enums and domain entities                                           |
| `src/schemas/auth.ts`     | Auth request schemas and the `AuthUser` DTO schema                                             |
| `src/auth/next-path.ts`   | Relative post sign in redirect validator shared by the web app and tests                       |
| `src/constants/index.ts`  | Shared constants (`CURRENCIES`, `ORDER_STATUSES`, `PRODUCT_TYPES`) and display metadata        |
| `tsconfig.json`           | Base config: typecheck only (`noEmit`)                                                         |
| `tsconfig.build.json`     | Emits `src` to `dist/`, excluding tests                                                        |
| `tsconfig.typecheck.json` | Typechecks `src` including tests                                                               |

## Conventions

- **Named exports only.** The barrel `src/index.ts` re-exports everything; consumers import from `@crochet-peakz/shared` directly.
- **Relative imports use `.js` extensions** (e.g. `from "../types/index.js"`), required by Node ESM output.
- **Add new exports to the barrel.** Any new type, schema, or constant must be re-exported from `src/index.ts` to be available to consumers.
- **Auth contracts**: auth schemas and the `AuthUser` DTO live in `src/schemas/auth.ts`; both workspaces import them from the barrel.
- **Rebuild after changing source** when running a consumer that uses the compiled output (`npm run build:shared` at the repo root). The root dev script watches and rebuilds automatically.

## Related specs

- [0002 Data model](../../docs/specs/0002-data-model/index.md)
- [0004 Platform-agnostic deployment](../../docs/specs/0004-platform-agnostic-deployment/index.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
