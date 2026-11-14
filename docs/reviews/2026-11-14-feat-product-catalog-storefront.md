# Review, feat/product-catalog-storefront, 2026-11-14

**Reviewed by**: glm-5-3-flash (author on a different model, fresh eyes)
**Scope**: 124 changed files vs merge base 7554420 (branch mode); ~45 reviewed line by line (binaries and generated output skipped)
**Verdict**: Approve with nits

## Summary

This branch delivers the full read-only catalog: shared DTO/query contracts, catalog domain rules, Prisma repository, public Express routes, Cloudinary URL resolution, the `(storefront)` route group (home, shop with filters/sort/pagination, product detail, collections), JSON-LD, currency cookie handling, and an unusually complete test suite (domain unit, use-case, router, repository integration, web lib/component tests, and a Playwright flow). Quality is high: the Clean Architecture layering is respected, visibility rules are applied consistently on every read, the strict-API/forgiving-web split is implemented exactly as specced, and the caching-not-found-as-a-value trick in `api.ts` is well reasoned. No blockers or majors found; the findings below are real but non-urgent.

## Minor

### 🟡 Category stats are an N+1 on the hottest public endpoint, `apps/api/src/application/catalog/list-categories.ts:17`

**Problem**: `listCategories` runs `getCategoryStats` (a `count` + a `findFirst` with images — 2 queries) once per category, and `getCategory` does the same per child. A catalog with 30 categories means ~62 queries per `/api/categories` call, and the shop page plus home page call it on every request window.
**Why it matters**: The web's 60 s revalidate blunts it, but the API itself has no cache, so every cold cache window across all visitors hits the database with this fan-out. It grows linearly with the catalog.
**Suggested fix**: Aggregate in the repository: one grouped count query (`groupBy categoryId` over the union of subtree ids) and one query for the newest product per subtree (or fetch newest-per-category in a single window-function/raw query). Keep the domain/use-case shape unchanged.

### 🟡 JSON-LD prices skip the minor-unit rounding helper, `apps/web/src/lib/catalog/json-ld.ts:30`

**Problem**: `lowPrice`/`highPrice` are computed as raw `basePrice + extra` floats, while the displayed price goes through `calculateVariantPrice` (rounds to 2 dp). Two 2-decimal values can sum to something like `1800.0899999999999`.
**Why it matters**: Search engines can read a price that differs from the rendered price, and the raw float can appear verbatim in the structured data.
**Suggested fix**: Map each price through `calculateVariantPrice` (already exported from `@crochet-peakz/shared`) before `Math.min`/`Math.max`.

### 🟡 Unreferenced multi-MB brand binaries committed to `apps/web/public/`

**Problem**: `logo.png` (1.5 MB), `logo-square.png` (1.3 MB), `logo-sqaure.webp` (92 KB, typo'd name), plus jpg/webp duplicates of both logos (~600 KB more) are committed. Nothing in `src/` or `site.webmanifest` references any of them.
**Why it matters**: `public/` ships verbatim into the standalone output and every deployment artifact; ~3.5 MB of dead weight, and the typo filename invites the wrong file being picked up later.
**Decision**: Keep all logo binaries for now; the client has not decided which logo to use. Do not delete or move these assets before that decision. Revisit optimization and cleanup once the client selects a logo.

### 🟡 Home page primary CTA links to a nonexistent route, `apps/web/src/app/(storefront)/page.tsx:206`

**Problem**: "Start a custom order" (and the header/footer "Custom Orders" link) point at `/custom`, which has no page — visitors get the styled 404.
**Why it matters**: The spec's closing call to action is a primary conversion path on the new home page; landing on a 404 is a broken experience even if the target feature is out of scope.
**Suggested fix**: Point it at `/shop` (or a contact/mailto) until the custom order flow exists, or add a placeholder page now.

### 🟡 Transient API failures mark valid collections `noindex`, `apps/web/src/app/(storefront)/collections/[slug]/page.tsx:92`

**Problem**: `generateMetadata` catches every error from `fetchCatalogCategory` and returns `robots: { index: false }`. Only a 404 should noindex; a timeout or 5xx during a crawl gets a valid collection de-indexed. The product page already distinguishes these via `isCatalogNotFound` — this page doesn't.
**Why it matters**: SEO damage from a transient outage is silent and persistent (recrawl required).
**Suggested fix**: Use `isCatalogNotFound(error)` to decide between the noindex metadata and a normal fallback title.

### 🟡 `featured=true` is silently dropped when filters are applied, `apps/web/src/components/catalog/filter-form.tsx:34`

**Problem**: The GET form preserves `sort` as a hidden field but has no hidden input for `featured`, so submitting Apply from `/shop?featured=true` removes it.
**Why it matters**: Currently no UI sets `featured`, so impact is latent, but the parser/API support it and the filter state contract says the form replaces the URL with the active state.
**Suggested fix**: Either render a hidden `featured` input when `state.featured === true` (same pattern as `sort`), or drop `featured` from `CatalogSearchState` until something uses it.

## Nits

- ⚪ `apps/api/src/domain/catalog/rules.ts:145`, `orderVariants`/`compareImages` tie-break with `localeCompare`, while the Prisma repository orders by plain `id asc` (byte order). For lowercase cuid-style ids they agree, but the two comparators can diverge; use a plain `<`/`>` comparison to match the DB.
- ⚪ `apps/api/src/infrastructure/cloudinary/image-url-resolver.ts:30`, the public ID is interpolated into the URL path without `encodeURIComponent`. Harmless for well-formed IDs, but a stray `?` or space in the DB would produce a malformed delivery URL.
- ⚪ `apps/web/src/lib/catalog/variant-selection.ts:131`, `isOptionAvailable` locks only dimensions _before_ the changed one, a deliberate deviation from the spec's "every other chosen dimension" wording (documented in the JSDoc and it avoids mutually-disabling dead ends). Confirm the spec owner is fine with the interpretation.
- ⚪ `apps/web/src/app/(storefront)/shop/page.tsx:55`, the single-collection canonical check re-implements `hasCatalogFilters` inline; reuse the helper plus explicit `page`/`sort` checks.
- ⚪ `apps/web/src/app/(storefront)/shop/[slug]/page.tsx:75`, the non-404 metadata fallback silently swallows the error without even a `console.error`.
- ⚪ `apps/web/src/lib/catalog/api.ts:8`, `unstable_cache` is still flagged unstable in Next 16; fine today, but worth a comment tying it to the deprecation status so it is revisited on upgrade.

## Strengths

- The 404-as-cached-value pattern in `apps/web/src/lib/catalog/api.ts` (`DetailLookup` + `unstable_cache`) solves a subtle stale-payload-after-hidden-product bug, and the comment explains _why_ — exactly the kind of reasoning worth documenting.
- Strict-API/forgiving-web contract is implemented faithfully and tested from both ends: Zod 400s with issue details on the API, silent-drop/swap parsing on the web, with dedicated tests for each.
- Clean Architecture holds under pressure: domain has zero external imports, repositories map to domain records, DTO mappers whitelist fields (`isActive`/`deletedAt` never leave the API), and the ports/dependency injection make the use-case tests mock-free against in-memory fakes.
- Test suite is genuinely behavioral, not implementation-mirroring: repository integration tests cover visibility, subtree filtering, clamping, and image/variant ordering against real PostgreSQL; the Playwright suite covers desktop and mobile, currency cookie, clamping, and both not-found paths.

## Test coverage

Coverage is broad and mostly asserts real behavior. All 19 ACs have at least indirect coverage; AC-19's required unit/integration/component/E2E layers all exist. Gaps worth noting (none blocking): no test pins the JSON-LD numeric rounding path (tied to the minor above); the `Pagination` gap-ellipsis window logic for `totalPages > 7` is only partially exercised (seed has few pages); and there is no test asserting `/custom` resolves — which is how the broken CTA slipped through.
