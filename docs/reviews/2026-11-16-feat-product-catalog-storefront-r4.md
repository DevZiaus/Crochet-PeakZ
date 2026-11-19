# Review, feat/product-catalog-storefront, 2026-11-16

**Reviewed by**: gpt-6-luna, a different model family from the author model (deepseek-v4.1-flash-free)
**Scope**: 144 files, `feat/product-catalog-storefront` vs `main` at merge base `7554420d59a7a369fcd116b547fffe92ed92b7ef` (139 tracked diff files plus 5 untracked files)
**Verdict**: Approve with nits

## Summary

The branch delivers a broad catalog storefront across the shared contracts, API, persistence, and Next.js UI, with substantial automated coverage and coherent Clean Architecture boundaries. The actionable r3 page-overflow finding is fixed, as is the earlier JSON-LD low-price issue; no blockers or majors were found. One low-impact inconsistency remains on collection URLs with unsupported query filters: those parameters remain shareable-looking URL state but do not affect the collection results.

## Nits

- ⚪ `apps/web/src/app/(storefront)/collections/[slug]/page.tsx:134-147`, the forgiving parser accepts type and price filters on collection URLs, but the product request ignores them and the collection href builder drops them on pagination. Either reject/normalize those unsupported params or implement their behavior so the URL does not imply a filtered view that is not shown.

**Resolution (2026-11-16)**: Fixed in `apps/web/src/app/(storefront)/collections/[slug]/page.tsx` with `hasUnsupportedCollectionParams` in `apps/web/src/lib/catalog/search-params.ts`. A collection URL that carries `category`, `type`, `minPrice`, `maxPrice`, or `featured` now redirects to the normalized collection URL, which keeps only `sort` and `page`. Covered by unit tests and a Playwright redirect flow. Web suite 379 tests, typecheck, lint, and Prettier pass; the focused Playwright flow passed on desktop and mobile.

## Strengths

- The previously reported oversized-page parsing bug is resolved: 400-digit page strings cap to `Number.MAX_SAFE_INTEGER`, and the strict API receives a valid integer that it can clamp.
- The earlier JSON-LD aggregate-price range issue is fixed by using variant totals only when variants exist.
- The API repository applies product visibility constraints consistently, maps explicit DTOs, and the branch has extensive domain, API, component, and desktop/mobile E2E coverage.

## Test coverage

The branch adds broad unit, integration, component, and Playwright coverage across AC-1–AC-19. The relevant regression tests for the oversized page and JSON-LD price range are present. No tests, typechecks, or builds were run for this review, so the verification checklist and prior review notes are not independent execution evidence. Clean Architecture boundaries were inspected across the API domain, application, infrastructure, and presentation layers; no actionable violation was found.
