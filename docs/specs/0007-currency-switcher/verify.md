# Verify: currency switcher · spec 0007 · updated 2026-11-20

_Steps derived from spec 0007 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [x] On storefront pages at `sm` and wider, the header shows a currency menu button whose text is `৳ BDT` (or `$ USD`) and accessible name is `Currency: ৳ BDT` (or `Currency: $ USD`). Opening it lists `৳ BDT, Bangladeshi taka` and `$ USD, US dollars` as radio items with a check mark on the active one. The old disabled placeholder is gone. → AC-1
- [x] Open the mobile navigation drawer. A Currency row with a `Currency` legend and two radio options sits next to Theme at every width where the drawer opens. → AC-1
- [x] Open `/login`, `/register`, and `/admin`. None of them render a currency control in the header or mobile drawer. → AC-1
- [x] Switch from BDT to USD in the header menu on `/shop`, then visit `/` and `/shop/[slug]`. The page updates without a full reload, and every price updates to USD: product cards, product detail base price, variant price on change, price filter labels, and Product JSON-LD `priceCurrency`. The `cp_currency` cookie is set to `USD` with `Path=/`, `Max-Age=31536000`, `SameSite=Lax`, and `HttpOnly`. → AC-2, AC-9
- [x] Clear cookies or set `cp_currency=EUR`, then reload `/shop`. Prices and the switcher fall back to BDT. Open the menu and click the already active currency; the menu closes and no network request is sent. → AC-3
- [x] Switch to USD, close and reopen the browser context keeping cookies, and load `/`. Prices render in USD on first paint. Sign in and sign out; the currency stays USD. → AC-4
- [x] Visit `/shop?category=bags&minPrice=500&maxPrice=2000&page=2&sort=price-asc` and switch currency. The URL is replaced (not pushed) with `/shop?category=bags&sort=price-asc`, the price inputs are empty, and browser Back does not return to the filtered `/shop` URL. Switching currency on `/shop?category=bags&sort=price-asc` or on `/collections` leaves the URL unchanged. → AC-5
- [x] While a switch is in flight, the trigger or drawer radio group is disabled, shows a spinner, and carries `aria-busy="true"`. When the action fails or returns `{ ok: false }`, the label and prices stay on the previous currency and a Sonner error toast reads "Could not change currency, please try again". → AC-7
- [x] After a switch from the header with the keyboard, a polite live region announces "Prices now shown in US dollars" (or "Prices now shown in Bangladeshi taka") and focus returns to the enabled header trigger. After a switch from the mobile drawer, the drawer stays open, its own polite live region announces the change, and focus returns to the chosen radio option. Every interactive item has at least a 44px target and visible focus. → AC-8

## Commands

- [x] `npm run typecheck` returns clean across all workspaces → AC-6, AC-9
- [x] `npm run lint` returns clean → AC-8, AC-9
- [x] `npm run test` passes unit and component tests for `setCurrency`, `withoutPriceFilters`, `CurrencyProvider`, `CurrencySwitcher`, `CurrencyRadio`, `Header`, and `StorefrontLayout` → AC-1 to AC-9
- [x] `npx playwright test` passes currency switcher flows on desktop and mobile, including axe checks (78 passed across `auth.spec.ts`, `catalog.spec.ts`, and `currency.spec.ts`, 6 in `currency.spec.ts`; live `axe-core` WCAG 2.1 AA checks passed with 0 violations in Playwright across closed desktop `/shop`, open desktop dropdown, and open mobile drawer, while permanent `axe-core` assertions inside `e2e/currency.spec.ts` remain for `/test`) → AC-1 to AC-9
- [x] `npm run build` succeeds for all workspaces → AC-9

## Value sourcing edges

- [x] Call `setCurrency({ currency: "EUR" })`, `setCurrency({} as never)`, and `setCurrency({ currency: 123 as never })`. Each returns `{ ok: false, error: "INVALID_CURRENCY" }` and writes no cookie. → AC-6
- [x] Call `withoutPriceFilters("/shop", new URLSearchParams("minPrice=&sort=newest"))`. It strips `minPrice` and `page` even when `minPrice` is empty. On `/collections/amigurumi?minPrice=10` or `/shop?sort=newest`, it returns `null`. → AC-5
- [x] Confirm `src/lib/catalog/currency.ts` is removed and `getActiveCurrency()` in `src/lib/currency/server.ts` is the only server reader of `cp_currency`. → AC-9

## Acceptance-criteria coverage

- AC-1 covered by header, drawer, and auth/admin placement steps · AC-2 by switch and cookie inspection step · AC-3 by missing/invalid cookie and same currency no-op step · AC-4 by browser reopen and sign in/out step · AC-5 by `/shop` price filter reset and `withoutPriceFilters` edge step · AC-6 by invalid input edge step and unit tests · AC-7 by pending spinner and failure toast step · AC-8 by keyboard, live region, focus restore, and 44px step · AC-9 by single reader check, typecheck, and build commands.
