# 0008. Shopping cart: rationale

Decision record for [index.md](index.md). `/develop` does not need this file.

## Context

Slice 1 needs a cart between the catalog (spec 0006) and checkout (feature 9). The product page already has a disabled `Add to cart` button and the header has a cart icon placeholder.

Forces:

- **Accounts are mandatory only at checkout** (spec 0005). Browsing and adding must work signed out, yet every order belongs to a user.
- **Prices are dual and hand set** (`priceBdt`, `priceUsd`, plus variant additions). Spec 0007 fixes the contract: the cart keeps ids and quantities only and renders amounts from the active currency.
- **Stock is small and real.** Many pieces are handmade, some one of a kind. Stock can change between add and checkout, and there is no reservation mechanism.
- **Customers shop across devices** (browse on a phone, buy on a laptop). The owner wants a signed in cart to follow the account.
- **Clean Architecture and portability** (root `AGENTS.md`): business rules in the domain, no hosting specific state, and the browser never calls Express directly; all browser calls go through same origin web routes.
- **No job runner exists**, so any cleanup has to happen on demand.

Not deciding leaves checkout with nothing to read and the storefront unable to sell.

## Options considered

### Option 1: Browser only cart (Zustand persisted to localStorage)

Every shopper's cart lives in localStorage; a public quote endpoint checks lines against live data.

**Pros**: smallest build (no migration, one endpoint); matches the original scope wording and spec 0001.
**Cons**: the cart does not follow a customer to another device; checkout must ship the cart from the browser.

### Option 2: Browser cart for visitors, server cart for accounts, merged on sign in (chosen)

Visitors use localStorage; signed in customers use `Cart`/`CartItem` tables; the browser cart merges in on sign in.

**Pros**: cross device carts for customers; checkout (which requires sign in) always reads a server cart; visitors keep a zero friction cart.
**Cons**: two modes, a merge with idempotency, a second web proxy, and more tests.

### Option 3: Server cart for everyone, keyed by an anonymous cookie

An HttpOnly cart cookie identifies an anonymous server cart, linked to the user on sign in.

**Pros**: one storage mode; the header count can render on the server.
**Cons**: database rows for every anonymous visitor (bots included) and a cleanup job the project does not have; a write endpoint open to anonymous traffic needs stronger abuse controls now.

## Rationale

I recommended Option 1 for the smallest path to a working checkout. You chose Option 2 because a customer's cart should belong to their account and follow them across devices. That is a sound product call, and it fits the forces well: checkout already requires sign in, so feature 9 reads a server cart and never has to trust a browser payload. The cost is real but contained. Both modes share one set of domain rules (the quote and the account endpoints call the same `resolveLine`), the merge is idempotent through `lastMergedGuestCartId`, and lazy expiry avoids needing a job runner. Option 3 was rejected because anonymous server rows and cleanup add infrastructure ahead of any measured need.

Supporting calls made with the design:

- **Zustand with `persist` (`skipHydration: true`)** over hand written context storage: already chosen in spec 0001, handles versioning and storage rehydration cleanly, and avoids Next.js SSR hydration mismatches. Runner up: React context plus `useSyncExternalStore`.
- **Same origin `/api/cart` proxy sharing the auth proxy's helper** over Server Actions: keeps the one browser to web to API pattern and reuses the proven refresh and replay logic. Runner up: Server Actions.
- **Batch quote endpoint** over per product detail calls: one request for up to 20 lines, and the browser cart needs no slugs.
- **Wait for the server in both modes, no optimistic writes**: product pages cache catalog reads for 60 seconds and stock limits are enforced on the server, so awaiting `quote` (visitor) or `/api/cart/items` (account) prevents phantom adds on the last piece.
- **Persist lowered quantities immediately while keeping `LOWERED` flags in session memory**: lowering saved quantities right away guarantees a later restock never silently charges the customer for a higher old quantity, while session memory keeps `Only N left, quantity lowered` visible across drawer opens and `/cart` views.
- **Integer minor unit subtotal** in a shared helper over a decimal library: two currencies with 2 decimals; integers avoid float drift with no new dependency.
- **Shared client `SessionProvider` over `/api/auth/me`** rather than server `getSessionUser()` in `(storefront)/layout.tsx`: `proxy.ts` skips storefront routes, so server `getSessionUser()` would not refresh expired 15 minute access tokens and would fire `/auth/me` on every render with a currency cookie. Sharing the client session with `AuthMenu` refreshes tokens once, deduplicates `/api/auth/me`, and switches modes immediately on client sign out. Runner up: expanding `proxy.ts` to every storefront route.
- **Upsert before `SELECT ... FOR UPDATE` in cart transactions** over optimistic retries: `INSERT ... ON CONFLICT DO NOTHING` prevents first cart creation races (`P2002`), and row locking closes the two tab limit race cleanly.
- **No stock reservation**: reservations need expiry and release machinery; feature 9 owns the authoritative check and decrement at order placement.
