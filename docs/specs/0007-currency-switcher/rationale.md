# 0007. Currency switcher: rationale

## Context

Crochet PeakZ sells to shoppers in Bangladesh and abroad, and the store owner sets every price by hand in both BDT and USD (spec 0002). Spec 0006 already renders the catalog from a `cp_currency` cookie read on the server, defaulting to BDT, but nothing writes that cookie yet; the header shows a disabled placeholder. Feature 7 must give shoppers a way to choose, remember the choice across visits, and hand checkout a currency it can trust.

Forces at play (workspace: `apps/web`, a Next.js 16 App Router app; the Express API is not involved):

- Prices render in server components, so whatever holds the choice must be readable on the server during the request, or the first paint shows the wrong currency.
- Client components (the purchase panel today, the cart soon) also need the value.
- The project rule is platform agnostic hosting: no host specific headers or SDKs.
- The `/shop` price filter numbers are interpreted in the active currency, so a switch changes their meaning.
- Zustand is listed in the intended stack but is not installed yet.
- Checkout must charge in the currency the shopper saw, without a conversion step, because there is no exchange rate and the owner prices by hand.

Not deciding leaves the storefront stuck in BDT for international shoppers and leaves the cart and checkout without a defined currency source.

## Options considered

### Option 1: Server Action writes an HttpOnly cookie, React context for client reads (chosen)

A Next.js Server Action validates the choice and sets the cookie; Next re-renders the route, server components read the cookie as they do today, and the storefront layout feeds the same value into a small React context for client components.

**Pros**: one source of truth; correct first paint; validation on the server; no new dependency; checkout reads the same cookie.
**Cons**: one round trip per switch; every storefront route renders per request.

### Option 2: Client writes the cookie with `document.cookie`, then `router.refresh()`

The browser writes the cookie and asks Next to refresh the server components.

**Pros**: no server code for the write; simple.
**Cons**: cookie cannot be HttpOnly; validation lives only in the browser, so any value can be written; still a round trip for the refresh.

### Option 3: Zustand store persisted in localStorage, client side price selection

A Zustand store holds the currency in localStorage, and client components pick the price column.

**Pros**: instant switch without a server trip; matches the original spec's mention of Zustand.
**Cons**: the server cannot see localStorage, so server rendered prices show BDT first and then flip (a visible flash and a hydration mismatch risk); checkout would trust a client value; adds a dependency for one value.

### Option 4: Account level preference stored on `User`, plus the cookie

Add a `preferredCurrency` column and an endpoint so the choice follows a signed in customer across devices.

**Pros**: works across devices for signed in shoppers.
**Cons**: schema change and new API for a small benefit; two sources to reconcile on sign in; guests still need the cookie.

## Rationale

Server rendering of prices is the deciding force: only a cookie is visible to the server on the first request, so Option 3 cannot give a correct first paint and was ruled out. Between the two cookie writers, the Server Action wins because it keeps the cookie HttpOnly and validated, which matters once checkout trusts that value to pick the price columns to charge; the extra code is a few lines. The context (rather than Zustand) carries the value to client components because it is one read only value that the server already owns, and it avoids adding a package before the cart decides whether it needs one.

You chose BDT for every first visit over geo detection: host country headers break the portability rule, a self hosted GeoIP database adds a file to keep current, and Accept-Language is a weak signal. Cookie only persistence (Option 4 deferred) covers "persists across sessions" with no schema change. Dropping the price filter on a switch, rather than keeping the numbers or converting them, avoids showing results filtered by a wrong amount and needs no exchange rate. Clearing `page` with it avoids landing past the end of a now larger result set.

The filter reset is a client `router.replace` after the action succeeds, not a `redirect()` inside the action. A redirect in a Server Action rejects the action promise with `NEXT_REDIRECT` (which would fire the failure toast), can remount the storefront layout (closing the drawer and losing focus), and pushes history instead of replacing it. The cost is a possible brief intermediate render behind the pending state, which is acceptable; the gain is no URL input to the action, so no open redirect surface. (This was changed after the cross check on 2026-11-20.)

Existing components that already receive the currency as a server prop keep it rather than moving to `useCurrency()`: the value is identical, and switching them would churn working code and tests for no behaviour change.

In the mobile drawer, a two option radio group replaces the dropdown because nesting a menu inside the dialog makes focus handling awkward, and two always visible choices are clearer on a phone.
