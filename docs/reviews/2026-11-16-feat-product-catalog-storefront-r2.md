# Review, feat/product-catalog-storefront, 2026-11-16

**Reviewed by**: fresh-eyes review subagent (GLM-5.3-Flash Free)
**Scope**: 139 tracked files + 1 untracked test file, branch vs merge base `7554420`
**Verdict**: Approve with nits

## Summary

This branch delivers the full product catalog storefront per spec 0006: shared DTOs and the strict list query schema in `packages/shared`, a catalog domain (visibility, stock, price, image ordering, category subtree resolution with cycle guards), an application layer of thin use cases, a Prisma repository (including a single raw-SQL subtree-stats query), a public read-only Express router, and the Next.js `(storefront)` route group with shop filtering/sorting/pagination, product detail with variant selection, collections, metadata/JSON-LD, and Playwright coverage. The code is clean, the Clean Architecture layering is respected, and the test pyramid is genuinely deep. The two majors raised by the earlier review are genuinely resolved: the storefront layout now has a tested skip link (`apps/web/src/app/(storefront)/layout.tsx` + untracked `layout.test.tsx`), and the AC-13 canonical rule is unit tested through `buildShopCanonical` (`apps/web/src/lib/catalog/search-params.test.ts:115-159`). No blockers or majors remain; only small SEO and process items.

## Blockers

None.

## Major

None.

## Minor

### 🟡 Product JSON-LD `lowPrice` can advertise a price below every purchasable combination — `apps/web/src/lib/catalog/json-ld.ts:32-37`

**Problem**: `prices` starts with the bare `basePrice` and then adds each variant total (`calculateVariantPrice(basePrice, extra)`). When variants exist and every variant carries a positive additional price, `lowPrice` equals the base price even though no variant combination sells at that price. Spec 0006 says `lowPrice`/`highPrice` are "computed from the base plus every variant additional price", i.e. the set of variant totals.
**Why it matters**: Search engines may surface a cheaper price than any real variant for the product, which is a customer trust/SEO accuracy issue. It only shows when all additional prices are positive, so it is easy to miss with the seed data.
**Suggested fix**: When `product.variants.length > 0`, compute `lowPrice`/`highPrice` from the variant totals only (the base price is already folded into each total); keep the single `Offer` at the base price for variant-less products.

**Resolution (2026-11-16)**: Fixed in `apps/web/src/lib/catalog/json-ld.ts`. The range now uses variant totals whenever variants exist, and one existing rounding test was updated because it asserted the base price as a floor for a product whose only variant sells higher. A regression test covers base 1800 with `+100` and `+200` variants, expecting `lowPrice` 1900 and `highPrice` 2000. Verified with the web suite (375 tests), root typecheck, web lint, and Prettier.

### 🟡 Branch deletes the owner-tracked `nextStep.txt` and introduces `personalNotes.txt` — `nextStep.txt` (deleted), `personalNotes.txt` (new)

**Problem**: AGENTS.md declares both files the owner's own tracked notes and forbids agents from editing, truncating, or deleting them. The branch diff removes `nextStep.txt` (containing "check verify customer auth") and adds `personalNotes.txt` with new owner-style notes.
**Why it matters**: If this deletion/rename was performed by an agent, it violates the project rule and destroys the owner's tracker. If the owner did it themselves between sessions, the diff is fine — but the review cannot distinguish, and the rule says only the owner changes these files.
**Suggested fix**: Confirm with the repository owner that they personally made this rename. If it was agent-driven, restore `nextStep.txt` and move the notes back before merge.

**Resolution (2026-11-16)**: The repository owner confirmed they made the rename themselves. Closed, no action needed.

## Nits

- ⚪ `apps/web/next.config.ts:13-19`, the image allowlist only covers `res.cloudinary.com` while `ImageUrlResolver` passes arbitrary `http(s)://` database values through unchanged; a stored URL on another host would fail Next image optimization and silently degrade to the placeholder. Fine until another host is actually used.
- ⚪ `apps/web/src/app/(storefront)/collections/[slug]/page.tsx:134-137`, stale `type`/`minPrice`/`maxPrice` params on a collection URL are parsed but ignored by the fetch, and `buildSortHref` keeps them in the URL on sort changes; they are dead state that could confuse a shared link.
- ⚪ `apps/api/src/test-support/catalog-fakes.ts:151`, the in-memory list uses `localeCompare` for the id tie-break while the Prisma repository and `rules.compareIds` use code-point ordering; harmless for UUIDs but the fake diverges slightly from real semantics.
- ⚪ `apps/web/src/lib/catalog/json-ld.ts:83`, `serializeJsonLd` escapes only `<`; escaping U+2028/U+2029 as well would be belt-and-braces for script embedding.
- ⚪ Copy deck deviations (home title "Crochet PeakZ — Feel The Handmade Love", shop title "Shop Your Love") are allowed by the spec's "the engineer may edit it during review", noting only so the drift from spec 0006's copy deck is intentional.

## Strengths

- The web API client caches a not-found detail lookup as a _value_ inside `unstable_cache` (`apps/web/src/lib/catalog/api.ts:128-149`) with a comment and tests (`api.test.ts:102-125`) explaining exactly why a bare 404 throw would pin stale payloads forever — a subtle failure mode handled deliberately.
- `getCategoryStatsForSubtrees` computes all subtree counts and covers in one parameterized raw-SQL query with a lateral primary-image join, and the in-memory fake mirrors the real ordering semantics, so application tests stay meaningful.
- The test suite covers every AC that can be automated: domain rules, use cases against fakes, HTTP route behavior (including 400/404 envelopes and field whitelisting), Prisma repository integration, forgiving parser/canonical/sort/variant-selection unit tests, component tests down to focus return in the mobile drawer, and an E2E flow for desktop and mobile. The two previously flagged majors were fixed with tests, not just edits.

## Test coverage

All 714 unit tests pass across api (262), web (374), and shared (78), plus `npm run typecheck` and `npm run lint` clean. New logic is broadly covered; the notable gaps are acceptable: (1) the shop `generateMetadata` canonical wiring is exercised only via `buildShopCanonical` unit tests, not at the HTML level in E2E; (2) the Prisma repository integration tests skip when `DATABASE_URL` is absent — CI runs them against PostgreSQL, so local-only runs under-report coverage; (3) accessibility is asserted structurally in component tests but there is no automated axe run (manual pass recorded in the spec). None of these rise above a note for this merge.
