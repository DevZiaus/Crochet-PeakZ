# Review, feat/product-catalog-storefront, 2026-11-16

**Reviewed by**: GLM-5.3-Flash (author on a different model, per `/check review`)
**Scope**: 136 files, branch vs merge base `7554420d` (7 commits + uncommitted `apps/web/src/lib/catalog/env.ts` / `env.test.ts` changes)
**Verdict**: Changes requested

## Summary

The catalog tracer bullet is genuinely end to end: shared Zod contracts, a pure and well tested domain layer, a Prisma repository with one batched raw-SQL stats query, a public read-only router, and a storefront whose filter/sort/page state lives entirely in the URL. The forgiving-web/strict-API split, the not-found-as-value cache pattern, and the DTO whitelisting are all implemented exactly as spec 0006 describes, and I confirmed the full suites pass locally (shared 78, web 363, api 262 against real PostgreSQL; typecheck and lint clean). Two issues keep this from a clean approve: the storefront has no skip-to-content link (a WCAG 2.1 AA / AC-17 gap, with the `main-content` anchor already dangling there waiting for one), and the AC-13 canonical-URL branch — the one piece of genuinely branching SEO logic — has no automated coverage anywhere.

## Major

### 🟠 No skip-to-content link — WCAG 2.4.1 (Level A) / AC-17 gap, `apps/web/src/app/(storefront)/layout.tsx:19`

**Problem**: The storefront layout gives `main` the id `main-content`, but nothing links to it. Every catalog page repeats the header (logo, six nav links, currency/search/cart controls, mobile menu) before the content, and there is no keyboard mechanism to bypass it. Grep across `apps/web/src` finds no skip link anywhere.
**Why it matters**: AC-17 commits every catalog screen to WCAG 2.1 AA, and Bypass Blocks (2.4.1) is a Level A criterion inside that. Any accessibility audit of the storefront will flag it; the dangling `main-content` id shows the mechanism was intended but never finished. Keyboard users on mobile-adjacent flows must tab through the whole header on every page navigation.
**Suggested fix**: Add a visually-hidden-until-focused "Skip to content" link as the first focusable element in the storefront layout (or the root layout) targeting `#main-content`, styled with existing focus tokens per design.md. Add a small component test asserting the link exists and targets the main landmark.

### 🟠 AC-13 canonical rule is untested branching logic, `apps/web/src/app/(storefront)/shop/page.tsx:55-65`

**Problem**: The single most conditional SEO rule in the feature — canonicalise to `/collections/[slug]` only when exactly one category, page 1, default sort, and no type/price/featured filter — lives inline in `generateMetadata`. Nothing automated reads the rendered `<link rel="canonical">`: no component test (the storefront pages have none) and no assertion in `e2e/catalog.spec.ts` (grep for "canonical" finds only unrelated matches). The same page's JSON-LD `<script>` embedding is likewise never asserted (the builder itself is unit tested, the page wiring is not).
**Why it matters**: A regression here silently corrupts SEO canonicalisation — filtered shop pages could collapse onto a collection canonical, or single-category pages could stop canonicalising — and no test would catch it. The verify doc marks AC-13 as manually checked only; a manual pass is not a regression net.
**Suggested fix**: Extract the decision into a pure helper in `apps/web/src/lib/catalog/search-params.ts` (e.g. `buildShopCanonical(state, webAppUrl)`) next to `hasCatalogFilters`, unit test the branch matrix (single category page 1 default sort → collection; +sort/+type/+price/+page → self), and have `generateMetadata` call it. Optionally add one e2e assertion on the canonical href for both cases.

## Minor

### 🟡 BDT prices with decimals display rounded, `apps/web/src/components/price-display.tsx:36-37` (via `apps/web/src/components/catalog/purchase-panel.tsx:80`)

`formatPrice` formats BDT with 0 fraction digits, so a variant-adjusted price of 1900.50 renders "৳1,901". `additional_price_bdt` is `Decimal(12,2)` and the shared `calculateVariantPrice` contract is "at most two decimals", so the data model allows decimal BDT prices that AC-8 says must display exactly. The formatter predates this branch, but the catalog now routes variant prices through it. Either format BDT with up to 2 decimals or record that BDT prices are whole-number-only by policy.

### 🟡 No timeout on server-side catalog fetches, `apps/web/src/lib/catalog/api.ts:239-244`

The catalog client passes no `AbortSignal` to `fetch`. If the Express API or its database hangs, every storefront request hangs indefinitely with no path to the retryable error state the feature carefully built. Wrap the fetches with `AbortSignal.timeout(…)` (a modest value, e.g. 10s) and map the abort to `CatalogApiError` status 0 so the existing retry UI handles it.

### 🟡 Inline error states render an `h2` with no `h1`, `apps/web/src/components/catalog/catalog-error-state.tsx:23`

When the shop or collections fetch fails, the page renders only `CatalogErrorState` — an `h2` with no `h1` on the page (the normal `PageHeader`/`h1` is skipped). Skipped heading levels hurt screen-reader navigation on exactly the screens built for AC-16/AC-17. Let `CatalogErrorState` take a `headingLevel` prop (or default to `h1`) for the page-level error branches.

## Nits

- ⚪ `apps/web/src/app/layout.tsx:41`, `viewport.themeColor: "#ffffff"` is a raw hex (project rule: every color resolves to a token) and stays white in dark mode; the array form supports a `prefers-color-scheme: dark` variant.
- ⚪ `apps/web/public/site.webmanifest:2`, brand name spelled "CrocheT PeakZ" (capital T) unlike every other surface, and uses `-` where the layout title uses an em dash.
- ⚪ `apps/web/src/components/catalog/filter-form.tsx:115`, `step="0.01"` makes the browser block submit on a 3-decimal input with a stepMismatch message, while the feature's stated philosophy (AC-6) is to silently drop invalid values; `step="any"` would let the forgiving parser do the normalizing.
- ⚪ `apps/web/src/app/(storefront)/collections/page.tsx:43`, the dynamic-rendering comment cites "(AC-15, AC-16)"; currency is AC-14.
- ⚪ `apps/web/src/app/(storefront)/page.tsx:206` and `header.tsx`/`footer.tsx`, the "custom order" CTAs point at `/shop` until feature 15 exists — fine for now, but worth a revisit ticket so the placeholder doesn't outlive this branch.

## Strengths

- Clean Architecture held under pressure: the domain rules are pure functions with zero external imports and exhaustive unit tests, the application layer orchestrates through ports (in-memory fakes, not framework mocks, exactly as the spec's test plan prescribes), Prisma stays in infrastructure, and the DTO whitelist is proven by a router test asserting `isActive`/`deletedAt` never appear in a response.
- The not-found-as-value pattern in `apps/web/src/lib/catalog/api.ts:114-165` — wrapping `unstable_cache` lookups so a 404 replaces a stale cached 200 — is a subtle Next.js cache trap handled correctly and locked by a test that inspects the registered loader.
- The batched subtree-stats query (`catalog.repository.ts:119-171`) is parameterized, resolves cover images with the exact primary-image rule, returns aligned results in one round trip, and is integration tested against real PostgreSQL including the empty-subtree case.
- The forgiving-web/strict-API contract is implemented symmetrically and tested on both sides: 400s with an `issues` detail array in the shared schema tests, silent drops and the min/max swap in `search-params.test.ts`, plus an e2e case asserting invalid values never reach the rendered state.
- I ran the gates locally: shared 78, web 363, api 262 tests all pass (api integration suites against the running PostgreSQL), `npm run typecheck` and `npm run lint` are clean, and the uncommitted build-phase guard in `lib/catalog/env.ts` fixes a real `next build` failure with four targeted tests.

## Test coverage

Coverage is unusually strong for a feature this size: domain rules, category tree (including the parent-cycle guard), shared schemas (defaults, dedup, every 400 case), variant selection (reset rule, disabled combinations, Standard options, initial preselection), the web API client (404 sentinel caching, error bodies, network failure), and component tests for the filter form/sidebar/drawer, pagination, gallery, purchase panel, cards, empty/error states, and image fallback. The Prisma repository has real-database integration tests covering visibility, subtree filters, sorts, clamping, and stats, and `e2e/catalog.spec.ts` walks home → shop → filter → sort → clamp → collections → currency cookie → product → not-found on desktop and mobile. The gaps are the two Majors above: the AC-13 canonical branch (branching logic, zero automated coverage) and the page-level JSON-LD embedding. Everything else I looked for was covered.
