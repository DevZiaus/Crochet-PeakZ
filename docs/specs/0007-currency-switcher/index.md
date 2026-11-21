# 0007. Currency switcher with a server written cookie

**Date**: 2026-11-20
**Status**: In Progress

## Summary

You get a currency menu in the storefront header (and a Currency row in the mobile menu) that switches every price between BDT (৳) and USD ($). The choice is saved in the `cp_currency` cookie for one year by a Next.js Server Action (a server function the page calls directly), so the server renders the right prices on every page and checkout can read the same value later. There is no database change and no exchange rate: prices keep coming from the hand set BDT and USD columns. First visits always start in BDT.

## Requirements

**User stories**:

- As a shopper abroad, I want to switch prices to US dollars so that I understand what a piece costs without converting in my head.
- As a shopper in Bangladesh, I want prices in taka by default so that I never have to change anything.
- As a returning shopper, I want my currency remembered so that I do not pick it again on every visit.
- As a keyboard or screen reader user, I want the switch to be operable and announced so that I know prices changed.

**Acceptance criteria**:

- **AC-1**: On storefront pages, the header shows a currency menu at the `sm` breakpoint and wider. Its visible text is the active currency (`৳ BDT` or `$ USD`) and its accessible name is `Currency: ৳ BDT` (or `Currency: $ USD`). Opening it lists `৳ BDT, Bangladeshi taka` and `$ USD, US dollars` as radio items with a check mark on the active one. The mobile menu drawer (shown at every width where it opens, like Theme) has a Currency row next to Theme with the same two choices. Sign in pages (`(auth)` layout) and `/admin` show no currency control. The disabled "coming soon" placeholder is removed.
- **AC-2**: Choosing the other currency calls the `setCurrency` Server Action, which sets the `cp_currency` cookie (value `BDT` or `USD`, `Path=/`, `Max-Age=31536000`, `SameSite=Lax`, `HttpOnly`, `Secure` in production). The current page then re-renders without a full browser reload, and every price on it shows in the new currency: product cards, product detail base price, the selected variant price, price filter labels, and the Product JSON-LD offer currency.
- **AC-3**: With no `cp_currency` cookie, or a cookie holding anything other than `BDT` or `USD`, the storefront renders in BDT (unchanged from spec 0006 AC-14). Choosing the currency that is already active closes the menu and makes no request.
- **AC-4**: The choice persists per browser: after closing and reopening the browser (within a year), every storefront page renders in the chosen currency. Signing in or out does not change it.
- **AC-5**: On `/shop`, when the URL holds `minPrice` or `maxPrice` (even empty), switching currency replaces (not pushes) the URL with the same `/shop` URL minus `minPrice`, `maxPrice`, and `page`; every other filter and the sort stay, and the filter form's price inputs show empty. When neither price param is present, or on any other page, the URL is unchanged.
- **AC-6**: `setCurrency` rejects any currency other than `BDT` or `USD` (including a missing or non string value) and leaves the cookie unchanged, returning `{ ok: false, error: "INVALID_CURRENCY" }`. It never redirects.
- **AC-7**: While the switch is in flight, the control is disabled, shows a small spinner, and sets `aria-busy="true"`. If the action fails (invalid result or network error), the active currency and all prices stay as they were, a Sonner error toast says "Could not change currency, please try again", and the error is logged.
- **AC-8**: After a successful switch, a polite live region announces "Prices now shown in US dollars" or "Prices now shown in Bangladeshi taka", and focus returns to the currency control (the header trigger, or the chosen option in the drawer) once it is enabled again. The drawer stays open after a switch, and the announcement is heard while it is open. Both controls are fully keyboard operable, have visible focus, 44px minimum targets, and meet WCAG 2.1 AA.
- **AC-9**: The `(storefront)` layout reads the cookie once through the shared server helper and passes the value to a `CurrencyProvider`. The switcher controls, and any new client component that needs the currency (such as the future cart), read it with `useCurrency()`. Existing components that already receive the currency as a prop from a server page (`PurchasePanel`, `MobileFilterDrawer`, the filter form) keep that prop. `getActiveCurrency()` in `src/lib/currency/` is the only code that reads `cp_currency` on the server, and every existing catalog page uses it.

## Decision

**Chosen option**: Option 1: Server Action writes an HttpOnly cookie, server renders prices, a React context exposes the value to client components.

The `cp_currency` cookie stays the single source of truth; a Server Action is the only writer, `getActiveCurrency()` the only server reader, and `useCurrency()` the only client reader.

**Implementation skills**: `nextjs-app-router` (`.agents/skills/nextjs-app-router/`), for Server Actions, `cookies()`, and `redirect()` in a Server Action.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:

No database change. The only stored state is the browser cookie:

| Name          | Values       | Attributes                                                                       | Written by                  | Read by                                  |
| ------------- | ------------ | -------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------- |
| `cp_currency` | `BDT`, `USD` | `Path=/`, `Max-Age=31536000`, `SameSite=Lax`, `HttpOnly`, `Secure` in production | `setCurrency` Server Action | `getActiveCurrency()` on the server only |

Prices keep coming from `Product.priceBdt` / `priceUsd` and `ProductVariant.additionalPriceBdt` / `additionalPriceUsd` (spec 0002), selected by the active currency exactly as spec 0006 does.

**State transitions**: none (a two value preference, any value may follow any other).

**Code layout** (web app only; the Express API is untouched):

| Path                                                     | Contents                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/currency/cookie.ts`                    | `CURRENCY_COOKIE`, `CURRENCY_COOKIE_MAX_AGE`, `parseCurrency()` (moved from `src/lib/catalog/currency.ts`)                                                                                                                                                                                    |
| `apps/web/src/lib/currency/server.ts`                    | `getActiveCurrency()` (moved; `server-only` import)                                                                                                                                                                                                                                           |
| `apps/web/src/lib/currency/actions.ts`                   | `"use server"` `setCurrency()`                                                                                                                                                                                                                                                                |
| `apps/web/src/lib/currency/labels.ts`                    | per currency: short label (`৳ BDT` / `$ USD`), option label (`৳ BDT, Bangladeshi taka` / `$ USD, US dollars`), trigger accessible name (`Currency: ৳ BDT` / `Currency: $ USD`), drawer legend `Currency`, announcement text, failure toast text                                               |
| `apps/web/src/components/currency/currency-provider.tsx` | `"use client"` `CurrencyProvider`, `useCurrency()`, `useOptionalCurrency()` (returns `null` outside a provider)                                                                                                                                                                               |
| `apps/web/src/components/currency/currency-switcher.tsx` | header dropdown on the existing `ui/dropdown-menu`, using `DropdownMenuRadioGroup` and `DropdownMenuRadioItem` with a `CheckIcon` indicator (not the default `CircleIcon`) and `min-h-11` items; `Loader2` spinner while pending                                                              |
| `apps/web/src/components/currency/currency-radio.tsx`    | drawer row: a native `<fieldset>` with legend `Currency` and two `<input type="radio">` options, stacked, each label `min-h-11`; `Loader2` spinner while pending; its own polite live region (the drawer is modal, so the page region is hidden from screen readers while it is open)         |
| `apps/web/src/lib/catalog/search-params.ts`              | add `withoutPriceFilters(pathname: string, searchParams: URLSearchParams): string \| null`: returns `null` unless `pathname === "/shop"` and `searchParams.has("minPrice") \|\| searchParams.has("maxPrice")`; otherwise returns `/shop` plus the params minus `minPrice`, `maxPrice`, `page` |
| `apps/web/src/components/catalog/filter-form.tsx`        | key `CatalogFilterForm` by the serialized filter state plus the active currency, so its uncontrolled price inputs remount with fresh values                                                                                                                                                   |

`src/lib/catalog/currency.ts` is deleted and its importers repointed (no re export shim).

**API surface**:

| Endpoint                           | Method                       | Key inputs                          | Key outputs                 | Auth   | Key errors                                 |
| ---------------------------------- | ---------------------------- | ----------------------------------- | --------------------------- | ------ | ------------------------------------------ |
| `setCurrency` (Next Server Action) | POST (Next action transport) | `input: { currency: string }` (req) | sets cookie; `{ ok: true }` | public | `{ ok: false, error: "INVALID_CURRENCY" }` |

Signature: `setCurrency(input: { currency: string }): Promise<{ ok: true } | { ok: false; error: "INVALID_CURRENCY" }>`.

Behaviour of `setCurrency`:

1. Parse `input?.currency` with the shared `currencySchema` from `@crochet-peakz/shared` (no direct `zod` import, so the web app gains no dependency). Failure, including a missing or non string value, returns `INVALID_CURRENCY` with no cookie write.
2. `(await cookies()).set(CURRENCY_COOKIE, currency, { path: "/", maxAge: CURRENCY_COOKIE_MAX_AGE, sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" })`. Next re-renders the current route because a cookie was set.
3. Return `{ ok: true }`. The action never calls `redirect()` (a redirect rejects the action promise with `NEXT_REDIRECT`, which would trip the failure path and can remount the layout).

No Express endpoint and no Next route handler are added.

**Client flow** (header and drawer share one hook, `useCurrencySwitch()`, inside `currency-provider.tsx`):

1. If the chosen currency equals the active one, close and stop (AC-3).
2. Inside the click handler, compute `cleaned = withoutPriceFilters(window.location.pathname, new URLSearchParams(window.location.search))`. Read `window.location` rather than `useSearchParams()`, so the header needs no Suspense boundary.
3. `startTransition(async () => { ... })`: await `setCurrency({ currency })`; on `{ ok: true }` and a non null `cleaned`, call `router.replace(cleaned)` in the same transition (AC-5). `isPending` drives disabled, spinner, and `aria-busy` for the whole sequence (AC-7). A brief intermediate render of the old price filter in the new currency may happen behind the pending state; accepted.
4. On `{ ok: false }` or a thrown error: `toast.error("Could not change currency, please try again")`, `console.error` with the cause, keep the old value (AC-7).
5. On success: the server re-render delivers the new cookie value to the provider through the layout. The provider sets the announcement text on the live region; the drawer radio writes the same text into its own live region while the drawer is open (AC-8).
6. Focus restore runs in a `useEffect` that fires when `isPending` turns back to `false` after a switch, because the control is still disabled while the transition runs and `.focus()` on a disabled element does nothing (AC-8).

**Value sourcing**:

| Action                        | Value produced / displayed                    | Source                                                                                                              |
| ----------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Any storefront render         | Active currency                               | `cp_currency` cookie via `getActiveCurrency()`; BDT when missing or invalid (spec 0006 AC-14)                       |
| Header and drawer controls    | Current label (`৳ BDT` / `$ USD`), check mark | `useCurrency()` value; label text from `labels.ts`                                                                  |
| Product card, detail, variant | Price amount                                  | `priceBdt`/`priceUsd` plus `additionalPriceBdt`/`additionalPriceUsd`, selected by active currency (spec 0006)       |
| Price filter labels, JSON-LD  | Currency code and symbol                      | Active currency (spec 0006)                                                                                         |
| `setCurrency`                 | Cookie value                                  | `currency` input, validated against shared `Currency`                                                               |
| `setCurrency`                 | Cookie lifetime                               | `CURRENCY_COOKIE_MAX_AGE` constant, 31536000 seconds (decided here)                                                 |
| Client switch hook            | Cleaned `/shop` URL after a switch            | `withoutPriceFilters()` over `window.location.pathname` and `window.location.search`, applied with `router.replace` |
| Header trigger, drawer legend | Accessible names                              | `labels.ts` (`Currency: ৳ BDT` / `Currency: $ USD`, legend `Currency`)                                              |
| Live region                   | Announcement text                             | `labels.ts`: "Prices now shown in US dollars" / "Prices now shown in Bangladeshi taka"                              |
| Failure toast                 | Message                                       | Fixed string "Could not change currency, please try again"                                                          |
| Future checkout (feature 9)   | Order currency and amounts                    | `getActiveCurrency()` at order placement, then that currency's price columns (contract below)                       |

**Downstream contract (cart and checkout)**:

- The cart (feature 8) stores product and variant ids and quantities, never prices or a currency; it renders amounts from `useCurrency()` and the current prices.
- Checkout (feature 9) reads `getActiveCurrency()` on the server when the order is placed, sets `Order.currency` to it, and snapshots `OrderItem.unitPrice` / `totalPrice` from that currency's columns. Gateway availability by currency or shipping country is decided in features 9, 12, and 13, not here.

**Key invariants**:

- `cp_currency` only ever holds `BDT` or `USD` when written by the app; any other value reads as BDT.
- `setCurrency` is the only writer of `cp_currency`; `getActiveCurrency()` is the only server reader; no client code reads `document.cookie`.
- The server render and the client context always agree, because the provider value comes from the same request's cookie read.
- No currency conversion happens anywhere; a price shown is always a stored column value (plus a stored variant addition).
- Other open tabs keep their rendered currency until a full reload; client side `<Link>` navigation there may reuse the cached layout, so the header can stay stale until then. No cross tab sync. Checkout is unaffected because it reads the cookie on the server.

**Security model**:

- Public, no authentication: the action only changes the caller's own preference cookie and touches no shared state, so no rate limit is added (there is nothing to exhaust or abuse).
- Next.js Server Actions compare the request `Origin` with the host, which blocks cross site invocation; `SameSite=Lax` adds a second layer.
- Input is validated with the shared Zod `currencySchema`. The action takes no URL input and never redirects, so there is no open redirect surface; the price filter cleanup is a client side `router.replace` to a URL built from the current location.
- `HttpOnly` keeps the cookie out of reach of page scripts. The value is not sensitive and holds no personal data, so it needs no consent banner category beyond strictly necessary (relevant to feature 29).

**Configuration required**: none. No new environment variables.

**Critical test scenarios**:

- Happy path (Playwright): open `/shop` in BDT, choose USD in the header menu, every card shows `$`; open a product, base and variant prices show `$`; JSON-LD offer currency is `USD`. Verifies **AC-1**, **AC-2**, **AC-9**.
- Persistence (Playwright): choose USD, save the storage state, open a new browser context with it, `/` renders in USD; sign in and out, still USD. Verifies **AC-4**.
- Default (Playwright): no cookie, then `cp_currency=EUR`, both render BDT; choosing BDT while in BDT sends no action request. Verifies **AC-3**.
- Price filter reset (Playwright): `/shop?category=bags&minPrice=500&maxPrice=2000&page=2&sort=price-asc`, switch to USD, URL becomes `/shop?category=bags&sort=price-asc`, the price inputs are empty, and Back does not return to the filtered URL. Verifies **AC-5**.
- Filter helper (Vitest): `withoutPriceFilters` returns `null` for `/collections/x?minPrice=1` and for `/shop?sort=newest`; strips `minPrice=` (empty), `maxPrice`, and `page` on `/shop`. Verifies **AC-5**.
- Validation (Vitest): `setCurrency({ currency: "EUR" })`, `setCurrency({} as never)`, and a non string value each return `INVALID_CURRENCY` and set no cookie; a valid value sets the cookie with the listed attributes and returns `{ ok: true }`. Verifies **AC-6**.
- Failure (React Testing Library): mock the action to reject; control shows pending then re-enables, label stays `৳ BDT`, toast text appears, no failure toast on a successful switch that also cleans the URL. Verifies **AC-7**.
- Accessibility (React Testing Library plus axe in Playwright): menu opens with Enter and arrow keys, live region text after success, focus back on the enabled trigger; drawer radio group operable by arrows, drawer stays open, its own live region announces; no axe violations. Verifies **AC-8**.
- Placement (React Testing Library): header with provider shows the control; header without provider (auth, admin layouts) shows none; drawer shows the Currency row. Verifies **AC-1**.

## Build plan

Tracer Bullet: the first task proves the whole loop (click, cookie, server render) on real pages before any polish.

1. Thin thread: create `src/lib/currency/` (`cookie.ts`, `server.ts`, `labels.ts`), move the existing helpers there and repoint every catalog importer; add the `setCurrency` Server Action with Zod validation and the cookie attributes; replace the header placeholder with a minimal currency dropdown that calls the action. Confirm on `/`, `/shop`, and a product page that prices switch and survive a reload. Satisfies **AC-2**, **AC-3**, **AC-4**, **AC-9**.
2. Context and placement: add `CurrencyProvider`, `useCurrency()`, and `useOptionalCurrency()`; the `(storefront)` layout reads `getActiveCurrency()` and wraps its children; the header renders the switcher only when a provider is present; add the drawer `CurrencyRadio` row next to Theme. Satisfies **AC-1**, **AC-9**.
3. Price filter reset: add `withoutPriceFilters()`; in the client hook, `router.replace(cleaned)` after a successful action inside the same transition; key `CatalogFilterForm` so its price inputs remount empty. Satisfies **AC-5**, **AC-6**.
4. States and accessibility: `useTransition` pending state with spinner and `aria-busy`, failure toast and logging, no request when choosing the active currency, polite live regions (provider and drawer), focus restore in an effect after pending ends, 44px targets. Satisfies **AC-3**, **AC-7**, **AC-8**.
5. Tests: Vitest units for the action and `withoutPriceFilters`; React Testing Library for switcher, radio, provider, and header placement; update existing tests that import `@/lib/catalog/currency`, plus `(storefront)/layout.test.tsx` (the layout becomes async and wraps `CurrencyProvider`) and `header.test.tsx` (placeholder removed, provider present or absent); Playwright flows for switch, persistence, defaults, and filter reset, plus axe. Satisfies **AC-1** through **AC-9**.

## Consequences

**Positive**:

- One source of truth: server rendered HTML is right on first paint, with no flash of the wrong currency and no hydration mismatch.
- No new dependency, no schema change, no new env var; nothing to operate.
- Checkout and the cart get a ready, documented read path.

**Negative / tradeoffs**:

- Every storefront route reads cookies, so it renders per request (already true since spec 0006). Static caching of storefront HTML stays off the table.
- A switch costs one server round trip before prices change; there is no instant client side swap.
- The preference does not follow a customer to another device; adding that later means a `User` column and an endpoint.
- Other tabs show the old currency until a full reload.
- The `(storefront)` layout becomes async (it awaits `cookies()`), so any `(storefront)` `loading.tsx` no longer covers the layout itself, only the pages below it.
- A switch that also cleans the `/shop` URL renders twice (refresh, then replace); the first render can briefly apply the old price numbers to the new currency behind the pending state.
- The header dropdown needs JavaScript to open; with JavaScript off, shoppers stay in the default BDT.

**Neutral**:

- `src/lib/catalog/currency.ts` moves to `src/lib/currency/`; imports across catalog pages and tests change.
- Search engines crawl without the cookie, so indexed prices and JSON-LD are in BDT.

## Follow-up

- [ ] The `nextjs-app-router` skill is installed in `.agents/skills/` but not listed in root `AGENTS.md` `## Agent skills`; its conventions apply to all of `apps/web`, so it belongs in `apps/web/AGENTS.md` (with a pointer from root).
- [ ] Feature 8 (cart) and feature 9 (checkout) specs should cite the downstream contract above.
- [ ] Feature 20 (store settings) lists a "currency exchange rate setting"; with hand set dual prices this feature needs none, so confirm whether that setting is still wanted when feature 20 is designed.
- [ ] `apps/web/AGENTS.md` line about the currency cookie should point to `src/lib/currency/` and the Server Action once built (/sync).
