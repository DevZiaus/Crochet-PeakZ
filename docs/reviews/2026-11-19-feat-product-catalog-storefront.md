# Review, feat/product-catalog-storefront, 2026-11-19

**Reviewed by**: Big Pickle (fresh review, no authorship of this branch)
**Scope**: 157 files, branch vs main (merge base `7554420d59a7a369fcd116b547fffe92ed92b7ef`)
**Verdict**: Approve with nits

## Summary

This branch delivers the complete public catalog read path: shared DTOs and Zod schemas, Clean Architecture domain rules and category-tree logic, thin use cases, a parameterized Prisma repository, public Express routes, and an App Router storefront with URL-driven filters, variant selection, canonical/JSON-LD metadata, and a desktop plus mobile Playwright flow. I re-derived the verdict from the actual diff rather than trusting the prior review: correctness, security, error handling, and spec adherence are strong, and the work is thoroughly tested at every layer. All five round-6 minors are genuinely resolved (footer test committed, Cloudinary allowlist documented in spec and docstring, brand retention documented as intentional, product detail queries parallelized, two-decimal price hint added), and five of its seven nits are resolved as well (placeholder error loop guarded, docstring and URL builder corrected, pluralization centralized). The four items below are optional cleanups; none affects behavior or merge safety.

## Nits

- ⚪ `apps/web/src/components/catalog/purchase-panel.tsx:113`, colour swatch lookup takes the first variant matching the colour name; if that variant has a null hex while a later variant with the same colour has one, the swatch is dropped. Prefer the first non-null hex among matching variants.
- ⚪ `apps/api/src/presentation/catalog/catalog.routes.ts:37` and `:55`, the `typeof request.params.slug === "string" ? … : ""` guards are dead defensiveness — Express always supplies a route param string. Consider using `request.params.slug` directly.
- ⚪ `apps/api/src/application/catalog/catalog.test.ts:1`, the multi-use-case suite is generically named; `catalog-use-cases.test.ts` would describe its intent better. This is a carry-over from the prior review, not a correctness issue.
- ⚪ `apps/web/next.config.ts:5-8`, `experimental.agentUpgrade: "security"` is the installed Next.js default and only controls upgrade reminders during `next dev`/`next build`; the comment ("Applies the security-relevant upgrade guidance") overstates it. Consider dropping the unrelated config from a catalog feature diff.

## Strengths

- Clean Architecture is real, not decorative: `domain/` has zero external imports, ports live in `domain/ports`, use cases are thin orchestrators, DTO mappers whitelist fields, and the single raw SQL query is fully parameterized through Prisma's tagged template — no string-built SQL anywhere.
- The forgiving-web / strict-API contract is implemented symmetrically and tested from both sides: the web parser drops stale categories, invalid types, bad prices and oversized pages; the shared Zod schema rejects the same inputs with 400 and a structured issues array, including the safe-integer page guard.
- `DetailLookup` in `apps/web/src/lib/catalog/api.ts` is a genuine fix for a subtle caching bug: 404s are stored as values inside `unstable_cache` so a soft-deleted product stops serving a stale 200 payload after revalidation. The arguments are part of the cache key (verified against Next 16.4.6), so per-slug isolation is correct.
- Variant selection matches spec rule AC-8 exactly — visible-dimension grouping, Standard for nulls, in-stock option disabling, later-dimension reset, sold-out fallback, and first-in-stock preselection — and the "disabled combos can appear unreachable" behaviour is explicitly specified and tested, not an accident.
- Prior-round carry-overs were truly resolved rather than waved through: the subtree-stats scalability concern is now recorded in the spec Follow-up section, and both the Cloudinary host allowlist and the intentional brand-asset retention are documented where future maintainers will find them.
- The public catalog routes are wired correctly in production (`index.ts`), the new required `CLOUDINARY_CLOUD_NAME` is validated at startup and covered in all `.env*.example` files, CI, and `docs/deployment.md`, and the 404 mapping (`CatalogError` → `AppError` → centralized handler) is covered by an HTTP-level test.

## Test coverage

Test signal is `configured`, and coverage is strong for all new branching logic. Domain rules (visibility, availability, price composition, image/variant ordering, page clamping, subtree expansion with cycle guard), application use cases, the Prisma repository integration suite (including `getCategoryStatsForSubtrees` against a real PostgreSQL), and the HTTP router suite (envelope shape, DTO whitelisting, 400 validation, 404 codes) are all present. On the web side, every new catalog component has a test file, and the library tests cover the URL parser, canonical rules, JSON-LD shape/escaping, variant selection, currency parsing, env guard, and API client success/error/caching paths including status 0 and non-JSON bodies. The Playwright flow covers browse/filter/open on desktop and mobile, price sorting, pagination clamping, inverted and invalid price ranges, collection URLs, cookie-driven currency, both styled 404s, and variant selection. No meaningful new branch is untested; the remaining findings are style/preference only.

I separately ran the repository integration suite (`apps/api`, Vitest) and confirmed all 9 tests pass against the configured database, including the subtree-stats query, so the raw SQL is exercised rather than merely typechecked. The earlier note about an untracked `footer.test.tsx` is resolved: the file is now tracked and included in the diff.
