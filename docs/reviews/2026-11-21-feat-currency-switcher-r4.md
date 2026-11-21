# Review, feat/currency-switcher, 2026-11-21

**Reviewed by**: Nemotron 3.5 Super VL Free (author on DeepSeek V4.1 Flash)
**Scope**: 45 files, branch vs base (feat/currency-switcher vs main 6393998)
**Verdict**: Approve

## Summary

The change implements spec 0007 (currency switcher with a server-written cookie) end-to-end in the Next.js storefront. A `setCurrency` Server Action writes the `cp_currency` cookie (`Path=/`, `Max-Age=31536000`, `SameSite=Lax`, `HttpOnly`, `Secure` in production) with shared-Zod validation rejecting anything other than `BDT`/`USD` and never redirecting (AC-2, AC-6). Server components read the cookie once per request via `getActiveCurrency()` (React.cached, single server reader, AC-9) and pass it to a `CurrencyProvider`; client controls read it through `useCurrency()`/`useCurrencySwitch()`. The header dropdown (desktop, `sm`+) and mobile drawer radio group list both currencies with a check mark on the active one, show a spinner and `aria-busy="true"` while pending, and restore focus once re-enabled (AC-1, AC-7, AC-8). On success the server re-renders prices in the new currency and, on `/shop` only when `minPrice`/`maxPrice` are present, `router.replace` strips those params plus `page` (AC-5). `src/lib/catalog/currency.ts` is deleted and its helpers moved to `src/lib/currency/` with every importer repointed (no re-export shim, per spec). The currency control is absent from `(auth)` and `/admin` (AC-1).

Typecheck passes for both the app and test tsconfigs; 184 unit/component tests pass; the Playwright e2e spec covers AC-1/2/3/4/5/8/9 plus axe WCAG 2.1 AA. The uncommitted working-tree fixes address both prior-round minors (design.md now documents the `CheckIcon` indicator and `animateClose={false}`; focus is only restored once `isPending` is false, so nothing is focused while disabled) and add error-handling separation (thrown vs `ok:false`) plus a `router.replace` guard, with no regressions.

No blockers or majors found.

## Strengths

- Every acceptance criterion in spec 0007 has corresponding test coverage: unit tests for `setCurrency` validation/cookie attributes (AC-2, AC-6), `parseCurrency`/`getActiveCurrency` fallback-to-BDT (AC-3), `withoutPriceFilters` (AC-5), labels/copy (AC-1, AC-7, AC-8), and React Testing Library tests for the switcher, radio, provider, header placement, and drawer (AC-1, AC-3, AC-5, AC-7, AC-8).
- The e2e Playwright spec drives the real browser across desktop and mobile projects and verifies prices switch without reload, JSON-LD `priceCurrency`, cookie attributes, persistence across browser sessions and sign in/out, default-to-BDT with no request, price-filter URL reset with replace navigation, keyboard/focus behavior, and axe WCAG 2.1 AA — including the admin and auth screens showing no currency control (AC-1, AC-4).
- Failure handling is sound: on a thrown network error or `ok:false`, the old currency and prices stay, a Sonner error toast shows, the error is logged, and no announcement is made (AC-7). `router.replace` failures are logged but do not surface a false currency failure toast.
- Clean Architecture respected: no framework/ORM code in domain/application layers (web-only feature), `server-only` imported only in the server reader, HttpOnly cookie keeps the value out of client scripts, and `setCurrency` is the sole writer / `getActiveCurrency()` the sole server reader / `useCurrency()` the sole client reader (key invariant).
- The uncommitted fixes correctly address the prior r3 minors without regressing anything.

## Test coverage

All new/changed logic is covered:

- `apps/web/src/lib/currency/actions.ts` — `actions.test.ts` (valid/invalid inputs, cookie attributes, secure-in-production, no redirect, error propagation).
- `apps/web/src/lib/currency/cookie.ts` + `server.ts` — `currency.test.ts` (parse fallback, BDT/USD/absent/unknown reads).
- `apps/web/src/lib/currency/labels.ts` — `labels.test.ts` (options order, exact copy, drawer legend, toast message).
- `apps/web/src/lib/catalog/search-params.ts` — `search-params.test.ts` (`withoutPriceFilters` null/strip/preserve cases, AC-5).
- `apps/web/src/components/currency/` — `currency-switcher.test.tsx` (provider hooks, switcher, radio, focus, announcements, pending/disabled, failure, URL cleanup).
- Placement — `header.test.tsx`, `(storefront)/layout.test.tsx`, `(auth)/layout.test.tsx`, `admin/layout.test.tsx`, `auth-menu.test.tsx` (control present only inside `CurrencyProvider`/storefront, absent on auth and admin).
- Filter-form remount on currency change — `filter-form.test.tsx`, `filter-sidebar.test.tsx`, `mobile-filter-drawer.test.tsx` (AC-5 price inputs empty).
- E2E — `e2e/currency.spec.ts` (AC-1, 2, 3, 4, 5, 8, 9 + axe).

No new logic is left untested. No Playwright run was needed here; the e2e spec is present and exercises the real flows.
