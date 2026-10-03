# packages/shared

## Overview

Shared TypeScript package consumed by both `apps/api` and `apps/web`. Contains types, Zod validation schemas, and constants that must stay in sync across the frontend and backend. No runtime dependencies beyond Zod.

## Stack

- **Language**: TypeScript (strict mode, extends `tsconfig.base.json`)
- **Validation**: Zod
- **Entry point**: `src/index.ts` (no build step; consumers import source directly via `"main": "./src/index.ts"`)

## Commands

```bash
# Typecheck
npm run typecheck --workspace=packages/shared

# Test
npm test --workspace=packages/shared
```

## Key files

| File                     | Owns                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| `src/index.ts`           | Barrel export: re-exports all public types, schemas, and constants                             |
| `src/types/index.ts`     | Domain types and enums mirroring the Prisma data model (Currency, UserRole, ProductType, etc.) |
| `src/schemas/index.ts`   | Zod validation schemas for enums and domain entities                                           |
| `src/constants/index.ts` | Shared constants (`CURRENCIES`, `ORDER_STATUSES`, `PRODUCT_TYPES`) and display metadata        |

## Conventions

- **Named exports only.** The barrel `src/index.ts` re-exports everything; consumers import from `@crochet-peakz/shared` directly.
- **No build step.** Both workspaces resolve source TypeScript at dev time. The `"main"` and `"types"` fields point at `./src/index.ts`.
- **Import paths use `.js` extensions** in source (e.g. `from "../types/index.js"`), matching Node16 module resolution from `tsconfig.base.json`.
- **Add new exports to the barrel.** Any new type, schema, or constant must be re-exported from `src/index.ts` to be available to consumers.

## Related specs

- [0002 Data model](../../docs/specs/0002-data-model/index.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
