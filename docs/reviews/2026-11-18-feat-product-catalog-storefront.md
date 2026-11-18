# Review, feat/product-catalog-storefront, 2026-11-18

**Reviewed by**: MiniMax-M2.7 (fresh review, no authorship of this branch)
**Scope**: 154 files, branch vs main
**Verdict**: Approve with nits

## Summary

This change ships the full product catalog read path through the Clean Architecture stack: shared Zod schemas, domain rules and category tree logic with zero framework imports, thin use cases, a Prisma repository with raw SQL for subtree stats, public Express routes, a Next.js App Router storefront with server components and client components, and a desktop plus mobile Playwright flow. The implementation matches spec 0006 closely, the layering is correct throughout, and test coverage is thorough at every layer. No blockers or majors were found. The remaining findings are carry-overs from round 5, a test file in an unexpected location, and small cleanups.

## Minor

### 🟡 Untracked footer test file has not been committed — `apps/web/src/components/footer.test.tsx`

**Problem**: A regression test for React duplicate keys in the footer has been written but exists only as an untracked file. All other tests in this branch are committed. The file is not included in the git diff and is invisible to CI.
**Why it matters**: A test that does not run is not a regression test. If this file is meant to live here it belongs in the commit; if it was written in preparation for an upcoming change it should say so in a comment or be tracked separately.
**Suggested fix**: Either commit `footer.test.tsx` with a clear commit message explaining its purpose, or remove it if the duplicate key fix in `footer.tsx` renders it redundant.

### 🟡 Cloudinary resolver passes through only HTTPS on the allowlisted host, not all HTTPS URLs — `apps/api/src/infrastructure/cloudinary/image-url-resolver.ts:27`

**Problem**: Spec 0006 says "A value starting with `http://` or `https://` is returned unchanged." The implementation returns null for every `https://` URL not on `res.cloudinary.com` and for all `http://` URLs unconditionally. The code comment calls this deliberate hardening, but the spec text was not updated to match.
**Why it matters**: Admin tooling or a mis-seed that stores a full CDN URL pointing at an arbitrary `https://` host will silently return null and show the placeholder, with no error and no documented reason. This is safer than the spec text implies, but it contradicts it.
**Suggested fix**: Update the spec's Cloudinary resolution section to describe the host allowlist, and add a one-line note in the resolver docstring referencing the deliberate deviation. Keep the hardening.

### 🟡 Unreferenced brand assets remain committed — `apps/web/public/` (logo.png, logo-square.png, logo.jpg, logo-square.jpg, logo.webp, logo-square.webp)

**Problem**: Six logo binaries totalling roughly 3.4 MB are committed in `apps/web/public/`. The header renders a text wordmark. Only favicons, `android-chrome-*` icons, and `og-default.webp` are actually referenced from the codebase or the root layout.
**Why it matters**: These files bloat the standalone build context, are publicly served if their URLs are guessed, and have now been flagged in two consecutive review rounds without resolution.
**Suggested fix**: Delete the six unreferenced files. Keep `logo-square.webp` only if an upcoming feature will reference it.

### 🟡 Subtree stats run O(N²) category expansion per categories read — `apps/api/src/infrastructure/database/catalog.repository.ts:119`, `apps/api/src/application/catalog/list-categories.ts:20`

**Problem**: `getCategoryStatsForSubtrees` joins every product row against all N subtrees in one raw query, and `listCategories` additionally runs `resolveCategorySubtreeIds` once per category in the application layer, making the combined read O(categories × products). The categories endpoint is hit on the home page, the shop page twice per render, and every collection page.
**Why it matters**: Correct at seed scale. The work grows with the product and category tables and sits on one of the hottest public paths. The 60-second web fetch cache limits exposure today, but nothing limits it inside the API.
**Suggested fix**: Fine now. If the catalog grows, cache the categories response at the API layer or maintain counts incrementally with a trigger. Flag this in the spec's follow-up section so it is not rediscovered.

### 🟡 Product detail serializes three queries, one loading every category row — `apps/api/src/application/catalog/get-product.ts:24`

**Problem**: `getProduct` calls `findProductBySlug`, then `listCategories()` (all rows) just to build one trail, then `listRelatedProducts` — sequentially. Three round trips per product view with one query carrying every category row.
**Why it matters**: Correct at seed scale. Per-request latency on the most SEO-critical page grows with the category table.
**Suggested fix**: Fine now. A recursive CTE for the trail, or parallelizing the trail and related reads with `Promise.all`, removes the serialization without touching the ports.

### 🟡 Price filter input accepts values the forgiving parser silently drops — `apps/web/src/components/catalog/filter-form.tsx:109`

**Problem**: The min and max inputs are `type="number"` with `step="0.01"` but no constraint enforcing the API's two-decimal rule. A visitor who types `1000.500` or any value the parser rejects submits the form, the parser silently drops the invalid value, and the grid updates without the price filter and without explanation.
**Why it matters**: Consistent with AC-6 ("the web silently drops invalid values"), so it is correct per spec. It is the one drop path a user can trigger by pure typing, and the result looks like a broken filter.
**Suggested fix**: A `title` or hint attribute on each field stating the two-decimal rule is the lowest-cost improvement. The form already has an `aria-describedby` hint; extend it.

## Nits

- ⚪ `apps/web/src/components/product-image.tsx:37`, if the committed placeholder itself fails while a remote `src` also fails, `onError` alternates the rendered source between the two and refetches indefinitely. A terminal give-up state would be safer.
- ⚪ `apps/web/src/components/catalog/purchase-panel.tsx:113`, the swatch lookup finds the first variant matching a colour name; if that variant has `colorHex: null` while another variant with the same colour has a hex, the swatch is lost.
- ⚪ `packages/shared/src/catalog/pricing.ts:4`, the docstring says "handled in integer minor units" but the implementation is float math with a rounding guard. At realistic magnitudes it is exact, but the comment overpromises.
- ⚪ `apps/web/src/app/(storefront)/collections/[slug]/page.tsx:39`, `buildCollectionHref` duplicates `buildShopHref`'s parameter assembly. A shared builder would keep the two URL schemes from drifting.
- ⚪ `apps/web/src/app/(storefront)/shop/page.tsx:123`, `apps/web/src/app/(storefront)/collections/[slug]/page.tsx:181`, and `apps/web/src/components/collection-card.tsx:20`, the "1 piece"/"X pieces" pluralization is written out three times. One shared helper would do.
- ⚪ `apps/api/src/presentation/catalog/catalog.routes.ts:37`, the `typeof request.params.slug === "string" ? ... : ""` guards are dead defensiveness. Express always supplies the route param as a string.
- ⚪ `apps/api/src/application/catalog/catalog.test.ts:1`, the use case integration tests are named `catalog.test.ts` and live in `application/catalog/`. The AGENTS.md convention is `*.test.ts` beside source, which this satisfies, but a name like `list-products.test.ts` or `catalog-use-cases.test.ts` would make the suite intent clearer.

## Strengths

- The Clean Architecture discipline is real and consistent: the domain layer has zero framework imports, ports live in `domain/ports`, use cases are thin orchestrators, and the one raw SQL query in the repository is fully parameterized via Prisma's tagged template with no string interpolation.
- The forgiving-web/strict-API contract is implemented exactly and tested from both ends: the web parser drops stale categories, invalid types, bad prices, and oversized pages; the shared Zod schema rejects them with 400 and an issues array, including the safe-integer page guard.
- The `DetailLookup` caching pattern in `apps/web/src/lib/catalog/api.ts` is a genuine and well-tested solution to a real problem: it stores 404s as values inside `unstable_cache` so a soft-deleted product stops serving stale 200 payload after revalidation starts returning not found.
- Variant selection logic is correct and well tested: it handles null dimensions as Standard, hides dimensions that are entirely null, disables options with no in-stock match, resets later dimensions to the first matching variant, and falls back to a sold-out variant so the panel can still show its state.
- The Playwright flow covers the full happy path, price sorting, pagination clamping, currency cookie switching, variant selection, and both styled 404 pages on desktop and mobile, directly asserting against seed data slugs.

## Test coverage

Coverage is strong for essentially all new branching logic: visibility and availability rules in the domain, price composition in both currencies, image ordering and primary fallback, category subtree expansion including the cycle guard case, page clamping including zero totals and safe-integer overflow, variant grouping and availability and reset rules, canonical URL rules, JSON-LD shape and serialization, the Cloudinary host allowlist, the web env guard, and the API client's error handling and caching behaviour. The Prisma repository integration tests and HTTP router suite cover the response envelopes, DTO whitelisting, and 404 codes; the repository suite skips without `DATABASE_URL`, which CI supplies. The one untested edge is the untracked `footer.test.tsx`.
