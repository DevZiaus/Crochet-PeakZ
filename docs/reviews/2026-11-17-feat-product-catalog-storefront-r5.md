# Review, feat/product-catalog-storefront, 2026-11-17

**Reviewed by**: GLM-5.3-Flash Free (author on deepseek-v4.1-flash-free, fresh review round 5)
**Scope**: 148 files, branch vs main
**Verdict**: Approve with nits

## Summary

This change ships the full product catalog storefront: shared DTOs and query schemas, a Clean Architecture read path (domain rules, use cases, Prisma repository, public Express routes), Cloudinary URL resolution, and a Next.js `(storefront)` route group with home, shop (filters, sort, pagination), product detail with variant selection, and collection pages. It matches spec 0006's acceptance criteria closely, is layered exactly per AGENTS.md, and has unusually thorough test coverage at every layer plus a Playwright flow. No blockers or majors found; the remaining issues are scale notes, one spec-text mismatch, and small cleanups.

## Minor

### 🟡 Cloudinary resolver deviates from the spec's pass-through rule — `apps/api/src/infrastructure/cloudinary/image-url-resolver.ts:27`

**Problem**: Spec 0006 says "A value starting with `http://` or `https://` is returned unchanged." The implementation instead returns an absolute URL only when it is `https` on `res.cloudinary.com`; every other absolute URL resolves to null and falls back to the placeholder.
**Why it matters**: The behavior is safer (it stops a tampered or mis-seeded database value from pointing customers at an arbitrary host), but the code and the spec now disagree. Anyone implementing against the spec text — or writing admin tooling that stores a full CDN URL — will get placeholders with no error and no documented reason.
**Suggested fix**: Keep the hardening, but update the spec's Cloudinary resolution section to describe the host allowlist, and add a one-line note to the resolver's docstring referencing the deliberate deviation.

### 🟡 ~3.4 MB of unreferenced brand assets remain committed — `apps/web/public/logo.png` (also `logo-square.png`, `logo.jpg`, `logo-square.jpg`, `logo.webp`, `logo-square.webp`)

**Problem**: Six logo binaries (1.5 MB + 1.3 MB PNGs plus JPG/WebP duplicates) are committed in `apps/web/public/`, but nothing in `src/`, `site.webmanifest`, or the root layout references any of them. The header renders a text wordmark; only the favicons and `android-chrome-*` icons are used.
**Why it matters**: They bloat the repo and the standalone build context forever, and any of them is publicly served if its URL is guessed. This has been flagged before and did not get resolved in this round.
**Suggested fix**: Delete the unreferenced files (keep one asset if an upcoming feature will use it), or reference them where they belong.

### 🟡 Subtree stats recomputed for every category on each uncached categories read — `apps/api/src/infrastructure/database/catalog.repository.ts:119`

**Problem**: `getCategoryStatsForSubtrees` joins every product row against all N subtrees in one raw query, and `listCategories` additionally runs `resolveCategorySubtreeIds` once per category (O(N²) in the application layer). The categories endpoint is hit on the home page, the shop page (twice per render: metadata + page), and every collection page.
**Why it matters**: Correct and fast at seed scale, but the work grows with categories × products and sits on the hottest public path. The 60-second web fetch cache bounds it today; nothing bounds it inside the API.
**Suggested fix**: Fine for now. If the catalog grows, either cache the categories response at the API (the spec already contemplates API cache headers as a follow-up) or maintain counts incrementally. Note it in the spec follow-ups so it is not rediscovered.

### 🟡 Product detail makes three sequential queries, one of which loads every category — `apps/api/src/application/catalog/get-product.ts:24`

**Problem**: `getProduct` calls `findProductBySlug`, then `listCategories()` (all rows) just to build one trail, then `listRelatedProducts` — sequentially.
**Why it matters**: Three round trips per product view with one query carrying every category row. At seed scale this is invisible; per-request latency on the most SEO-critical page grows with the category table.
**Suggested fix**: Fine now. A recursive CTE for the trail, or parallelizing the trail/related reads with `Promise.all`, removes the serialization without touching the ports.

### 🟡 Price inputs accept values the forgiving parser will silently drop — `apps/web/src/components/catalog/filter-form.tsx:109`

**Problem**: The min/max inputs are `type="number"` with `step="0.01"` but no `pattern`/`max` enforcement of the API's two-decimal rule. A visitor who types `1000.500` (or an exponent form a number input can emit) submits, the parser drops the value silently, and the grid updates with no price filter and no explanation.
**Why it matters**: Consistent with AC-6 ("the web silently drops invalid values"), so it is correct per spec — but it is the one drop path a user can trigger with pure typing, and the result looks like a broken filter.
**Suggested fix**: Constrain the input (`step`, `max` decimals via a controlled handler) or show a hint when the parsed state diverges from the submitted form. Lowest-cost option: a `title`/hint on the field stating the two-decimal rule.

## Nits

- ⚪ `apps/web/src/components/product-image.tsx:37`, if the committed placeholder itself ever failed while a remote `src` also fails, `onError` alternates the rendered source between the two and refetches indefinitely; a terminal "give up" state would be safer.
- ⚪ `apps/web/src/components/catalog/purchase-panel.tsx:113`, the swatch lookup takes the first variant matching a colour name; if that variant has `colorHex: null` while another same-colour variant has a hex, the swatch is lost.
- ⚪ `packages/shared/src/catalog/pricing.ts:4`, the docstring says "handled in integer minor units" but the implementation is float math with a rounding guard; at realistic magnitudes it is exact, but the comment overpromises.
- ⚪ `apps/web/src/app/(storefront)/collections/[slug]/page.tsx:39`, `buildCollectionHref` duplicates `buildShopHref`'s parameter assembly; a shared builder would keep the two URL schemes from drifting.
- ⚪ `apps/web/src/app/(storefront)/shop/page.tsx:123`, `apps/web/src/app/(storefront)/collections/[slug]/page.tsx:181`, `apps/web/src/components/collection-card.tsx:20`, the "1 piece"/"X pieces" pluralization is written out three times; one helper would do.
- ⚪ `apps/api/src/presentation/catalog/catalog.routes.ts:37`, the `typeof request.params.slug === "string" ? ... : ""` guards are dead defensiveness; Express always supplies the route param.

## Strengths

- The Clean Architecture discipline is real, not cosmetic: the domain layer is pure functions with a visited-set cycle guard for parent cycles, ports live in `domain/ports`, use cases are thin orchestrators, and the one raw SQL query is fully parameterized via Prisma's tagged template.
- The forgiving-web/strict-API pairing (invariant 7) is implemented exactly and tested from both ends: the web parser drops stale slugs, bad types, bad prices, and oversized pages; the shared Zod schema rejects them with 400 and an issues array, including the safe-integer page guard.
- The `DetailLookup` caching pattern in `apps/web/src/lib/catalog/api.ts` is a genuinely good catch: it stores 404s as values inside `unstable_cache` so a soft-deleted product stops being served from a stale 200 payload after revalidation, and it is directly unit tested.
- Coverage breadth matches the spec's test matrix: domain unit tests, use case tests against in-memory fakes, repository integration tests against real PostgreSQL, HTTP router tests, web lib/component tests, and a desktop + mobile Playwright flow asserting real seed values.
- The uncommitted refinement round shows good review response: locale-independent id ordering in the fakes, the safe-integer page guard with a new test, and remount keys on the product page client components with a regression test for the state-reset bug.

## Test coverage

Coverage is strong for essentially all new branching logic: visibility, availability and stock rules, price composition in both currencies, image ordering and primary fallback, category subtree expansion (including the cycle case), page clamping (including zero totals and safe-integer overflow), variant grouping/availability/reset rules, canonical URL rules, JSON-LD shape, the Cloudinary resolver (including the host allowlist), the web env guard, and the API client's error and caching behavior. The Prisma repository integration tests and the HTTP router suite cover the envelopes, DTO whitelisting, and 404 codes; the repository suite skips without `DATABASE_URL`, which CI supplies. The only soft spots are the untested-by-nature edges noted above (placeholder-failure image loop, multi-primary-image ambiguity), none of which carry branching production risk.
