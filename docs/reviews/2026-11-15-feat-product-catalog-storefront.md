# Review, feat/product-catalog-storefront, 2026-11-15

**Reviewed by**: GLM-5.3-Flash (author on a different model, fresh eyes)
**Scope**: 136 changed files vs merge base 7554420 (branch mode); binaries, lock output, and generated files skipped
**Verdict**: Blocked

## Summary

This branch delivers the complete read-only catalog: shared DTO/query contracts, domain rules, a batched Prisma repository, public Express routes, Cloudinary resolution, the `(storefront)` route group (home, shop, product detail, collections), JSON-LD, currency cookie handling, and a genuinely layered test suite (domain unit, use-case, router, repository integration against PostgreSQL, web lib/component tests, and a Playwright flow). Every finding from the 2026-11-14 review was verified fixed: the N+1 is now one window-function query, JSON-LD prices go through the rounding helper, the `/custom` CTA targets `/shop`, transient collection failures no longer noindex, `featured` survives the filter form, and the comparator/encoding nits are addressed. The one blocker is new and serious: the root layout now calls `getCatalogEnv()` at module scope, which makes `next build` fail on any clean checkout — the CI Build step and the Docker web image build are both broken today; the dev machine passes only because the gitignored `apps/web/.env.local` supplies the values.

## Blockers

### 🔴 Web build fails on a clean checkout — CI Build step and Docker web image are broken, `apps/web/src/app/layout.tsx:20`

**Problem**: The root layout evaluates `metadataBase: new URL(getCatalogEnv().webAppUrl)` at module scope. `getCatalogEnv()` (`apps/web/src/lib/catalog/env.ts:29-33`) throws when `API_INTERNAL_URL` or `WEB_APP_URL` are absent under `NODE_ENV=production`. Reproduced on this checkout with those variables unset: `next build` dies with `[cause]: Error: API_INTERNAL_URL must be an absolute http(s) URL. … Error: Failed to collect page data for /_not-found`. The variables are only present locally via the gitignored `apps/web/.env.local`, so every clean environment fails:

- CI: the **Build** step (`.github/workflows/ci.yml:75-76`) runs `npm run build` with a job env that has no `WEB_APP_URL`/`API_INTERNAL_URL` (those are exported only on the later E2E step, lines 91-98). The branch cannot pass CI.
- Docker: the `build-web` stage (`Dockerfile:52-59`) passes only `NEXT_PUBLIC_API_URL` as a build arg, and `.dockerignore` excludes `.env.*`. `docker compose up -d --build` — a primary documented command in AGENTS.md — cannot produce the web image.
- `docs/deployment.md` still describes both variables as "Read by the Next.js server on each auth request" (runtime only) and does not mention the new build-time requirement.

**Why it matters**: The project's own gates (CI on every PR, the documented self-host path) hard-fail. The change that verified `npm run build succeeds` (verify.md) was run on a machine where `.env.local` masked the gap, so the breakage is currently invisible to the author.

**Suggested fix**: Keep the fail-fast throw for the per-request catalog path, but resolve `metadataBase` with a non-throwing build-time fallback (e.g. a dedicated helper that returns a normalized `process.env.WEB_APP_URL ?? "http://localhost:3000"`), or pass `WEB_APP_URL`/`API_INTERNAL_URL` as Docker build args and CI job env and document the build-time requirement in `docs/deployment.md`. The first option is preferable: it keeps `docker compose build` working from a bare checkout, which the deployment portability rule expects.

## Minor

### 🟡 Absurd-but-numeric `page` values slip past the forgiving parser and get 400'd by the API, `apps/web/src/lib/catalog/search-params.ts:92`

**Problem**: `parseCatalogSearchParams` accepts any all-digit page string, so `?page=99999999999999999999` parses to `Number` `1e20`. `fetchCatalogProducts` then serializes it with `String(page)` as `"1e+20"` (`apps/web/src/lib/catalog/api.ts:97-99`), which fails the API's `^[1-9]\d*$` schema and returns 400 `INVALID_QUERY`. The shop page renders the retryable error state for a URL that should simply clamp to the last page.
**Why it matters**: It breaches the spec's invariant 7 ("Invalid URL values are dropped by the web and never reach the API") and AC-5's clamp guarantee, turning a shareable-but-silly URL into an apparent outage. The blast radius is one pathological query shape, hence Minor.
**Suggested fix**: Cap the parsed page in the parser (e.g. reject values above a sane ceiling like 10,000 and fall back to 1, or serialize pages with `String(Math.trunc(page))` after clamping in `buildShopHref`), and/or have `toCatalogListParams` clamp before sending. A unit test pinning a 20-digit page would lock the behavior.

## Nits

- ⚪ `apps/api/src/test-support/catalog-fakes.ts:151`, the in-memory fake still tie-breaks ids with `localeCompare(right.id, "en")` (also line 190). The domain comparator was deliberately aligned to PostgreSQL byte order in this branch, but the fake wasn't; ICU collation can order punctuation-bearing ids differently than the database, so the test oracle can diverge from production ordering.
- ⚪ `apps/web/src/components/header.tsx:34`, the nav still links `/patterns` and `/blog`, which have no routes. Pre-existing (out of this diff's blast radius), but this diff fixed the identical broken-`/custom` link two lines above, which makes these stand out.
- ⚪ `apps/web/src/components/product-card.tsx:51`, the card badge says `Pre-order` while the shared label and detail page say `Pre order` — two spellings for the same concept across surfaces.
- ⚪ `.env.docker.example:53`, `CLOUDINARY_CLOUD_NAME=crochet-peakz` is a concrete-looking example where sibling secrets use `...`. Copied verbatim it silently serves images from a cloud the operator may not own (the placeholder fallback masks it). An obviously-fake value would fail the placeholder validation more honestly.

## Strengths

- The category stats fan-out was rebuilt properly: `getCategoryStatsForSubtrees` does the whole job in one parameterized window-function query (jsonb input, lateral primary-image pick, `count` + rank-1 cover), with an integration test covering parent/child/empty subtrees and a use-case test asserting a single batched call.
- The 404-as-cached-value pattern in `apps/web/src/lib/catalog/api.ts` is kept and now unit tested from both directions (found/not-found cached, non-404 rethrown), which is the subtlest correctness risk in the caching design.
- The strict-API/forgiving-web contract is honored and pinned from both ends: shared Zod 400s with issue details, web silent-drop/swap parsing, plus an e2e test that types garbage into the URL and asserts the shop still renders.
- Accessibility is consistently real, not decorative: fieldset/legend grouping with sr-only radios and focus rings, `aria-live` result counts and price/stock updates, 44px targets (`min-h-11`, `size-11`), `aria-pressed` gallery thumbnails, `motion-reduce` guards, and `aria-current` pagination.
- All six findings from the 2026-11-14 review are genuinely resolved (five in code with added tests, one — the unreferenced logo binaries — by the recorded keep-for-now decision), and the fixes are verified against the current code, not taken on faith.

## Test coverage

Coverage is broad, behavioral, and layered: domain rules (visibility, stock bands, ordering with a locale-independence test, clamping, cycle-safe tree walks), use cases against in-memory fakes, router integration over HTTP, Prisma repository integration against real PostgreSQL (including the raw stats query and empty-subtree edge), shared schema/label/price tests, web lib tests (parser, API client with mocked `unstable_cache`, JSON-LD rounding, currency), component tests (filter form incl. the `featured` fix, purchase panel variant flows, pagination gaps, gallery, error/retry states), and a Playwright suite covering desktop and mobile, currency cookie, clamping, and both not-found paths. Gaps: nothing pins the clean-checkout build (the blocker — CI would have caught it had it run green; the local `.env.local` masked it from `npm run build` verification), no test covers the multi-digit `page` serialization path (tied to the minor), and the in-memory fake's id tie-break divergence means test ordering and DB ordering are only accidentally equal for simple fixture ids.
