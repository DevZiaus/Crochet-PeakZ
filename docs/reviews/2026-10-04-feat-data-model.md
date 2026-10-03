# Review, feat/data-model, 2026-10-04

**Reviewed by**: Gemini 3.8 Flash (author on Claude Opus 4.6)
**Scope**: 17 files, branch vs base
**Verdict**: Changes requested

## Summary

This change implements the full data model for Crochet PeakZ, adding 18 Prisma models and 9 enums with UUID v7 primary keys, snake case database mapping, and complete relational constraints. It also includes an idempotent database seed script, synchronized Zod schemas in the shared package, and a full unit test suite for all enums. The schema and seed logic are well crafted, but there are two major issues: an untyped and unlisted Prisma config file for database seeding, and missing foreign key indexes across PostgreSQL tables.

## Major

### 🟠 Invalid seed configuration in prisma.config.ts and missing package.json config, `apps/api/prisma.config.ts:4`

**Problem**: `apps/api/prisma.config.ts` imports `defineConfig` from `@prisma/config`, but `@prisma/config` is not listed in `apps/api/package.json` dependencies. In addition, `seed` is not a recognized property in the `PrismaConfig` type definition, causing TypeScript compilation errors when checked. Meanwhile, `apps/api/package.json` lacks the standard `"prisma": { "seed": "tsx prisma/seed.ts" }` configuration required by Prisma CLI and spec 0002 build plan item 3.
**Why it matters**: If `prisma.config.ts` is included in TypeScript checks, the build fails. Furthermore, relying on an invalid configuration format can break database seeding across fresh developer machines or CI environments.
**Suggested fix**: Add `"prisma": { "seed": "tsx prisma/seed.ts" }` to `apps/api/package.json`, and remove `apps/api/prisma.config.ts` until Prisma config files are officially typed and stable.

### 🟠 Missing indexes on foreign key columns, `apps/api/prisma/schema.prisma:53`

**Problem**: Across `apps/api/prisma/schema.prisma`, none of the child foreign key columns declare `@@index` annotations (such as `userId` on `addresses`, `orders`, and `reviews`, or `productId` on `order_items`, `product_images`, and `product_variants`). In PostgreSQL, foreign key constraints do not automatically generate indexes on child tables.
**Why it matters**: Whenever parent records are updated or deleted, PostgreSQL must perform sequential scans over child tables to verify foreign key integrity or perform cascade deletes. Standard queries looking up child records by parent identifier will also scan entire tables as data grows.
**Suggested fix**: Add `@@index` annotations to foreign key fields across models in `schema.prisma`, and generate a migration to create B tree indexes on those columns.

## Minor

### 🟡 Missing test script in root package.json, `package.json:10`

**Problem**: The root `package.json` includes `build`, `typecheck`, and `lint` workspace scripts, but does not provide a `test` script.
**Why it matters**: Running `npm test` from the repository root fails with a missing script error, disrupting standard developer workflows.
**Suggested fix**: Add `"test": "npm run test --workspaces --if-present"` to `package.json` scripts.

## Nits

- ⚪ `packages/shared/src/index.ts:22`, relative import paths omit `.js` extensions, which differs from the convention documented in `packages/shared/AGENTS.md` for Node16 module resolution.
- ⚪ `docs/scope/scope.md:85`, `apps/api/prisma/seed.ts` is listed twice in the feature 3 file list.

## Strengths

- Complete and accurate implementation of all 18 Prisma models and 9 enums matching the spec acceptance criteria with clean snake case column mapping and UUID v7 keys.
- Realistic seed script that sets up multiple product types, nested categories, and storefront settings while maintaining clean idempotency.
- Comprehensive unit test suite in `packages/shared` validating both accepted values and rejected inputs for all 9 Zod enum schemas.

## Test coverage

The shared workspace includes 18 unit tests in `packages/shared/src/schemas/index.test.ts` covering valid and invalid inputs for all 9 enum schemas, bringing the shared test suite to 32 passing tests. The Prisma schema migration and database seed script have been verified via local Prisma CLI runs. Automated database integration tests are not yet present, which is expected before dedicated integration test tooling is introduced.
