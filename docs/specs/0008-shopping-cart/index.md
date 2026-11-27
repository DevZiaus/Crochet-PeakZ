# 0008. Shopping cart with a browser cart for visitors and a server cart for accounts

**Date**: 2026-11-27
**Status**: In Progress

## Summary

Anyone can fill a cart. Visitors keep theirs in the browser (a Zustand store saved to localStorage, a small storage area inside the browser). Signed in customers keep theirs on the server, so it follows them across devices. When a visitor signs in, the two carts merge. The cart stores only product ids, variant ids, and quantities, never prices. Every view checks the lines against live stock and prices, so totals in the active currency are always correct. Checkout stays disabled until feature 9.

## Requirements

**User stories**:

- As a shopper (signed in or not), I want to add crochet pieces to a cart so that I can buy several at once.
- As a shopper, I want the cart to show correct prices in my chosen currency and warn me when stock runs out so that I am never surprised at checkout.
- As a signed in customer, I want my cart on every device and kept when I sign out so that I do not lose what I picked.
- As a visitor who signs in, I want my browser cart folded into my account cart so that nothing I picked disappears.

**Acceptance criteria**:

- **AC-1**: On a product page for a `STANDARD` or `ONE_OF_A_KIND` product whose selected variant is in stock, `Add to cart` is enabled for signed in and signed out shoppers (with the coming soon note removed). Clicking it waits for live validation (`POST /api/cart/quote` for visitors, `POST /api/cart/items` for signed in customers) while showing `Adding...` and disabling the button, then adds 1 of the selected variant (an existing line grows by 1), opens the cart drawer, and announces `Added <title> to your cart` in a polite live region inside the drawer.
- **AC-2**: For `DIGITAL`, `PRE_ORDER`, and `CUSTOM` products, `Add to cart` stays disabled with the type note from the value sourcing table. When the selected variant is out of stock, the button is disabled and reads `Out of stock`.
- **AC-3**: The header cart icon on every storefront page (desktop and mobile) shows a badge with the total item count (the sum of line quantities): hidden at 0, `1` to `99`, then `99+`. Its accessible name is `Shopping cart, empty` at 0, `Shopping cart, 1 item` at 1, and `Shopping cart, N items` above 1. Activating it opens the drawer. Outside `CartProvider` (such as on `(auth)` screens), the header omits the cart icon, matching `CurrencySwitcher`.
- **AC-4**: The drawer (dialog title `Shopping cart`, close label `Close shopping cart`) and the `/cart` page (`<h1>` `Your cart`, metadata title `Shopping cart`) list lines newest first (by when the line was first added; quantity changes do not reorder). Each line shows the primary image, the title linking to the product page, the variant label, the unit price, a quantity stepper (none for `ONE_OF_A_KIND`, which shows `Qty 1`), the line total, and `Remove` (using the fallback display rules when fields are `null`). The summary shows the subtotal in the active currency and the note `Shipping and any discounts are calculated at checkout`. A disabled `Checkout` button carries `Checkout is coming soon`. An empty cart shows `Your cart is empty` and a `Continue shopping` link to `/shop`. The drawer links to `/cart` (`View cart`) and closes on route navigation.
- **AC-5**: A line's quantity is at least 1 and at most the smaller of the variant's live stock and 10. `ONE_OF_A_KIND` lines are always exactly 1. The increase control is disabled at the maximum. A cart holds at most 20 distinct lines; adding a new variant to a full cart adds nothing and shows a toast `Your cart is full (20 items max). Remove something to add this.`
- **AC-6**: Clicking `Add to cart` when that line is already at its maximum (`maxQuantity >= 1`) leaves the line unchanged, opens the drawer, and shows the inline note `You already have the most we can sell of this item (N)` on that line. Adding a variant whose live check reports zero stock or unavailable adds nothing to storage and shows the toast `This item is no longer available`.
- **AC-7**: Each drawer open, each `/cart` render, and each add checks every line against live data. Stock below the quantity (but above 0) lowers the saved quantity to the stock (without updating visitor `updatedAt`) and flags `Only N left, quantity lowered` (kept visible in `CartProvider` session memory across reads until the shopper changes, removes, or clears that line). Stock 0 flags `Out of stock`. An inactive or soft deleted product, a missing variant, a mismatched `productId`, or an unsupported product type flags `No longer available`. Flagged out of stock and unavailable lines are left out of the subtotal, keep their `Remove` control, and show `Remove unavailable items to continue` above `Checkout is coming soon`.
- **AC-8**: All amounts render in the active currency from `useCurrency()`. Switching currency updates every amount without a refetch. No cart storage (browser or server) holds a price or a currency (spec 0007 downstream contract).
- **AC-9**: A visitor's cart hydrates after mount (avoiding SSR mismatch), survives reloads and browser restarts, shows the same contents across open tabs via the `storage` event, and expires (resets to empty with a new `guestCartId`) after 30 days with no write. A corrupt or unknown version saved cart resets to empty without an error. When localStorage is unavailable, the cart works in memory for that page session.
- **AC-10**: A signed in customer's cart is stored on the server and shows the same contents on every device and tab (other tabs update via `BroadcastChannel` after writes, or when they regain focus). Lazy expiry empties it when read or written after 30 days with no write.
- **AC-11**: When a shopper with a browser cart that is not empty becomes signed in, the browser lines merge into the account cart (after lazy expiry): existing account lines keep their slots first, then visitor lines fold in newest first (`addedAt` descending), summing matching variants and applying the AC-5 limits while dropping zero stock (`OUT_OF_STOCK`), invalid (`UNAVAILABLE`), or >20 overflow (`DROPPED_CART_FULL`) new visitor lines. When `adjustments` is not empty, the drawer opens automatically and both the drawer and `/cart` show a dismissible banner `Some items in your cart changed when you signed in` listing each item with its reason. The browser cart is cleared (with a fresh `guestCartId`) only after the merge succeeds; a failed merge keeps it and retries on the next load. Sending the same `guestCartId` again changes nothing.
- **AC-12**: Storefront session state comes from a shared client `SessionProvider` (over `/api/auth/me`, shared with `AuthMenu`). After sign out, `CartProvider` leaves account mode right away and the device shows the empty browser cart; items added next go into that fresh browser cart with a new `guestCartId`, while the account cart stays intact on the server for the next sign in.
- **AC-13**: In both modes, add, quantity change, remove, and clear wait for the server when a network call is needed: the active control shows a pending state and stays disabled until the answer arrives. On failure the toast `Could not update your cart, please try again` appears and nothing changes.
- **AC-14**: During the initial signed in load, the drawer and `/cart` render line skeletons. When the live check fails (visitor `quote` failure or initial signed in `GET /api/cart` failure), the visitor badge still shows the saved count, and the drawer and `/cart` show `We couldn't load your cart right now` with a `Try again` button; no line is removed or changed.
- **AC-15**: `/cart` offers `Clear cart` behind a confirm dialog (`Remove all items from your cart?`, buttons `Clear cart` and `Keep items`). Confirming empties the cart (rotating `guestCartId` in visitor mode) and announces `Your cart is now empty`.
- **AC-16**: Every signed in cart endpoint acts only on the session user's cart and answers 401 without a valid session. All `/api/cart` routes require `x-proxy-secret` (401 when missing, via `createProxyGuard`). Writes require the `WEB_APP_URL` origin (403 on mismatch). Bodies and UUID params are validated with shared Zod schemas (400 `INVALID_CART`). Rate limits: quote 60/min per client IP, `GET /api/cart` 120/min per user, and all cart writes 120/min per user (one shared bucket); excess calls get 429 with `Retry-After`. `ADMIN` accounts can use the cart like customers.
- **AC-17**: The drawer is a modal dialog: focus moves into it, stays trapped, `Escape` and the close button close it, and focus returns to the control that opened it. Steppers and remove buttons carry item names (`Decrease quantity of <title>`, `Increase quantity of <title>`, `Remove <title> from cart`). Quantity changes, flags, and clear are announced politely (inside the drawer when open, and on the page when closed). Touch targets are at least 44 px. `/cart` sets `robots: { index: false }`. axe finds no WCAG 2.1 AA violations on `/cart` and on a page with the drawer open, in light and dark themes.
- **AC-18**: Tests cover the domain rules and shared helpers (unit), the cart API against PostgreSQL including concurrent writes (integration), the store, drawer, page, header, and purchase panel (component), and a Playwright run: visitor adds, reloads, signs in and sees the merge, changes quantity, removes, and clears, with axe checks.

## Decision

**Chosen option**: Option 2: Browser cart for visitors plus a server cart for signed in customers, merged on sign in.

Visitors use a Zustand store saved to localStorage (`cp_cart`) and checked via `POST /api/cart/quote`. Signed in customers use new `Cart` and `CartItem` tables behind a session scoped `/api/cart` API, reached through a same origin web proxy, with mode driven by a client `SessionProvider` shared with `AuthMenu`. Both modes resolve lines through the same server rules, so stock, limits, and prices always match.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch** (target, one migration):

| Entity     | Field                   | Type                 | Null | Notes                                                             |
| ---------- | ----------------------- | -------------------- | ---- | ----------------------------------------------------------------- |
| `Cart`     | `id`                    | String `uuid(7)`     | no   | PK                                                                |
|            | `userId`                | String               | no   | FK `User.id`, **unique** (one cart per user), `onDelete: Cascade` |
|            | `lastMergedGuestCartId` | String `VarChar(36)` | yes  | Last merged browser cart id; a repeat merge is skipped            |
|            | `createdAt`             | DateTime             | no   | `now()`                                                           |
|            | `updatedAt`             | DateTime             | no   | `@updatedAt`; touched explicitly on every item write (expiry)     |
| `CartItem` | `id`                    | String `uuid(7)`     | no   | PK                                                                |
|            | `cartId`                | String               | no   | FK `Cart.id`, `onDelete: Cascade`                                 |
|            | `productId`             | String               | no   | FK `Product.id`, `onDelete: Cascade`                              |
|            | `variantId`             | String               | no   | FK `ProductVariant.id`, `onDelete: Cascade` (nullable later, 14)  |
|            | `quantity`              | Int                  | no   | `CHECK (quantity BETWEEN 1 AND 10)` added in the migration SQL    |
|            | `createdAt`             | DateTime             | no   | `now()` (or clamped visitor `addedAt` on merge); line order key   |
|            | `updatedAt`             | DateTime             | no   | `@updatedAt`                                                      |

- Tables `carts` and `cart_items` (`@@map`), snake case columns (`@map`), per the API conventions.
- Constraints and indexes: `@@unique([cartId, variantId])`, `@@index([cartId, createdAt])`, `@@index([productId])`, `@@index([variantId])`.
- Relations: `User 1 : 0..1 Cart`, `Cart 1 : N CartItem`, `Product 1 : N CartItem`, `ProductVariant 1 : N CartItem`. Add the back relations (`User.cart`, `Product.cartItems`, `ProductVariant.cartItems`).
- Browser cart (localStorage key `cp_cart`, Zustand `persist` with `version: 1` and `skipHydration: true`): `{ guestCartId: string (crypto.randomUUID()), updatedAt: ISO string, lines: { productId, variantId, quantity, addedAt: ISO string }[] }`. Clearing or expiring the browser cart rotates `guestCartId` to a fresh UUID. No titles, prices, or currency.

**State transitions**: none on the entity. Line flags (`OK`, `LOWERED`, `OUT_OF_STOCK`, `UNAVAILABLE`) are computed on every read, never stored.

**API surface** (Express, all under `/api/cart`, all require `x-proxy-secret`; the browser only calls the web route `/api/cart/[[...path]]`):

| Endpoint                     | Method | Key inputs                                                                                            | Key outputs                              | Auth                                       | Key errors                                                    |
| ---------------------------- | ------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| `/api/cart/quote`            | POST   | `lines: { productId: uuid, variantId: uuid, quantity: int 1..10 }[]` (req, 0..20, unique `variantId`) | `data.lines: CartLineDto[]`              | public; 60/min per IP                      | 400 `INVALID_CART`, 401 (no secret), 429                      |
| `/api/cart`                  | GET    | none                                                                                                  | `data: CartDto`                          | session; 120/min per user                  | 401, 429                                                      |
| `/api/cart/items`            | POST   | `productId: uuid` (req), `variantId: uuid` (req)                                                      | `data: CartDto`, `outcome: AddOutcome`   | session, origin; 120/min per user (shared) | 400, 401, 403, 429                                            |
| `/api/cart/items/:variantId` | PATCH  | `:variantId: uuid`, `quantity: int 1..10` (req)                                                       | `data: CartDto`                          | session, origin; 120/min per user (shared) | 400, 401, 403, 404 `NOT_IN_CART`, 409 `ITEM_UNAVAILABLE`, 429 |
| `/api/cart/items/:variantId` | DELETE | `:variantId: uuid`                                                                                    | `data: CartDto` (200 even if absent)     | session, origin; 120/min per user (shared) | 400, 401, 403, 429                                            |
| `/api/cart`                  | DELETE | none                                                                                                  | `data: CartDto` (empty)                  | session, origin; 120/min per user (shared) | 401, 403, 429                                                 |
| `/api/cart/merge`            | POST   | `guestCartId: uuid` (req), `lines` (same shape as quote, 0..20)                                       | `data: CartDto` with merge `adjustments` | session, origin; 120/min per user (shared) | 400, 401, 403, 429                                            |

Shared contracts (`packages/shared/src/cart/`): `CART_MAX_LINES = 20`, `CART_MAX_LINE_QUANTITY = 10`, `CART_EXPIRY_DAYS = 30`; Zod schemas for every body and `:variantId`; and these types:

- `CartLineDto`: `productId`, `variantId`, `slug | null`, `title | null`, `imageUrl | null`, `imageAlt | null`, `variantLabel | null`, `productType | null`, `unitPriceBdt | null`, `unitPriceUsd | null`, `quantity` (after lowering), `maxQuantity`, `status: "OK" | "LOWERED" | "OUT_OF_STOCK" | "UNAVAILABLE"`, `addedAt`. Product fields are `null` when the `Product` row is missing; `variantLabel` and unit prices are also `null` whenever `status === "UNAVAILABLE"` due to a missing or mismatched variant.
- `CartAdjustmentDto`: `{ variantId: string, title: string | null, kind: "LOWERED" | "CAPPED" | "OUT_OF_STOCK" | "UNAVAILABLE" | "DROPPED_CART_FULL", quantity: number }` (`quantity` is the kept clamped count for `LOWERED`/`CAPPED`, and `0` for dropped items).
- `CartDto`: `lines: CartLineDto[]` (newest first by `addedAt`), `adjustments: CartAdjustmentDto[]` (empty unless this call lowered, capped, or dropped something).
- `AddOutcome`: `"ADDED" | "AT_LIMIT" | "CART_FULL" | "UNAVAILABLE"` (always HTTP 200 on valid input, evaluated in order: `UNAVAILABLE` when product or variant is missing, mismatched, inactive, soft deleted, unsupported type, or has 0 stock; `CART_FULL` when variant is not in the cart and line count is 20; `AT_LIMIT` when existing `quantity >= maxQuantity`; else `ADDED`).
- `PATCH /api/cart/items/:variantId` rules: when `maxQuantity === 0`, leave the row unchanged and return 409 `ITEM_UNAVAILABLE` with fresh `data: CartDto`; when `1 <= maxQuantity < quantity`, clamp to `maxQuantity`, persist, and return 200 with `LOWERED` in `adjustments`.
- `calculateCartSubtotal(lines, currency)`: sums `OK` and `LOWERED` lines with non null `unitPrice` in integer minor units (poisha or cents), then returns a 2 decimal number.

Web proxy (`apps/web/src/app/api/cart/[[...path]]/route.ts`): exports `GET`, `POST`, `PATCH`, `DELETE`. Allow list: `GET ""`, `DELETE ""`, `POST quote`, `POST items`, `PATCH items/<uuid>`, `DELETE items/<uuid>`, `POST merge`; anything else gets 404. Parameterize `apps/web/src/lib/api-proxy/` over `isWrite` (`POST`, `PATCH`, `DELETE`, skipping body reading when empty), `maxBodyBytes` (1 MB for auth, 16 KB for cart), optional catch all `params.path ?? []`, pattern allow list, and upstream error text (`"The cart service did not answer. Try again."`). Responses are `no-store`.

**Value sourcing**:

| Action                        | Value produced / displayed              | Source                                                                                                                                                                                                                                                                                                 |
| ----------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Add (both modes)              | `productId`, `variantId`                | Purchase panel's selected variant (`ProductDetailDto.id`, `ProductVariantDto.id`)                                                                                                                                                                                                                      |
| Add (both modes)              | Whether the type is cartable            | `ProductDetailDto.productType` in `STANDARD`, `ONE_OF_A_KIND` (decided here)                                                                                                                                                                                                                           |
| Resolve a line                | `maxQuantity`                           | Domain rule: `ONE_OF_A_KIND` → `min(stock, 1)`; `STANDARD` → `min(ProductVariant.stockQuantity, 10)`; unavailable or 0 stock → 0                                                                                                                                                                       |
| Resolve a line                | `status`                                | Domain rule over `Product.isActive`, `Product.deletedAt`, supported `productType`, variant existence, `variant.productId == line.productId`, stock, quantity                                                                                                                                           |
| Resolve a line                | `unitPriceBdt`, `unitPriceUsd`          | `Product.priceBdt/priceUsd` + `ProductVariant.additionalPriceBdt/Usd` via `calculateVariantPrice` (`null` when variant unavailable)                                                                                                                                                                    |
| Resolve a line                | `title`, `slug`, `imageUrl`, `imageAlt` | Application mapper from `Product` + `pickPrimaryImage` + `ImageUrlResolver` (`null` when product missing)                                                                                                                                                                                              |
| Resolve a line                | `variantLabel`                          | Non null `colorName`, `sizeLabel`, `yarnType` joined with `·`; `Standard` when all are null; `null` when variant unavailable                                                                                                                                                                           |
| Resolve a line                | `addedAt`                               | Visitor: browser line `addedAt`; account: `CartItem.createdAt` (on merge, visitor `addedAt` clamped to `<= now()`)                                                                                                                                                                                     |
| Unavailable line UI fallbacks | Title, image, variant, price cells      | `Unavailable item` (unlinked) when `title` or `slug` is `null`; catalog placeholder when `imageUrl` is `null`; omit null `variantLabel`; `Unavailable` when `unitPrice` is `null`                                                                                                                      |
| Drawer, `/cart`               | Line total, subtotal                    | `unitPrice` for `useCurrency()` × `quantity`; subtotal via `calculateCartSubtotal` (minor units, excludes flagged lines)                                                                                                                                                                               |
| Drawer, `/cart`, badge        | Currency symbol and format              | `useCurrency()` + existing `formatPrice` (spec 0007)                                                                                                                                                                                                                                                   |
| Badge                         | Item count                              | Sum of `quantity` over the store's lines after client hydration (visitor: saved lines, even when quote failed; account: last `CartDto`)                                                                                                                                                                |
| Visitor mode vs account mode  | Which mode `CartProvider` runs          | Shared client `SessionProvider` (`useSession()` over `/api/auth/me`, shared with `AuthMenu`); 401 from `/api/cart` rechecks session                                                                                                                                                                    |
| Merge                         | `guestCartId`, `lines`                  | Browser cart; server compares `guestCartId` with `Cart.lastMergedGuestCartId`                                                                                                                                                                                                                          |
| Merge banner                  | Per item change text                    | `CartDto.adjustments` (fallback title `An item`): `<title>: limited to <N> available` (`CAPPED`/`LOWERED`), `<title>: out of stock and removed` (`OUT_OF_STOCK`), `<title>: no longer available and removed` (`UNAVAILABLE`), `<title>: left out because your cart has 20 items` (`DROPPED_CART_FULL`) |
| Lowered flag text             | `N` in `Only N left, quantity lowered`  | `CartLineDto.quantity` after lowering, retained in `CartProvider` session memory until the line is edited, removed, or cleared                                                                                                                                                                         |
| At limit note                 | `N` in the note                         | `CartLineDto.maxQuantity`                                                                                                                                                                                                                                                                              |
| Visitor expiry                | Last change time                        | Browser cart `updatedAt` (set on add, quantity edit, remove, clear; never on passive quote lowering)                                                                                                                                                                                                   |
| Account expiry                | Last change time                        | `Cart.updatedAt`, touched in the same transaction as every item write (not on `GET /api/cart` lowering)                                                                                                                                                                                                |
| Disabled type notes (AC-2)    | Note text                               | `DIGITAL`: `Digital patterns are coming to the cart soon.` · `PRE_ORDER`: `Pre orders are not open yet.` · `CUSTOM`: `This piece is made to order through a custom request, coming soon.` (decided here)                                                                                               |
| Rate limits                   | Limits and windows                      | Constants in the cart presentation layer: quote 60/60s per `getClientIp`; `GET /api/cart` 120/60s per user id; writes 120/60s shared per user id                                                                                                                                                       |

**Key invariants**:

- No price, total, or currency is ever stored in a cart (browser or server).
- At most one `Cart` per user; at most one `CartItem` per `(cartId, variantId)`; at most 20 items per cart; `1 <= quantity <= 10` (DB check plus domain).
- Every account cart transaction runs `INSERT INTO carts ... ON CONFLICT (user_id) DO NOTHING` followed by `SELECT ... FOR UPDATE` on that cart row, applies lazy 30 day expiry, and checks live stock inside one transaction so concurrent writes never throw `P2002` or exceed limits.
- `GET /api/cart` applies lazy expiry and persists lowered quantities without advancing `Cart.updatedAt`, returning `LOWERED` in `CartDto`; `CartProvider` retains lowered `variantId` flags in session memory so subsequent reads do not hide the notice before the customer sees it.
- Merge keeps existing account slots first, processes incoming visitor lines newest first (`addedAt` descending), drops `OUT_OF_STOCK`, `UNAVAILABLE`, and >20 overflow new visitor lines into `adjustments`, and records `lastMergedGuestCartId` in the same transaction.
- Only `STANDARD` and `ONE_OF_A_KIND` lines can be added or merged; other types resolve as `UNAVAILABLE`.
- The browser cart is never written while `CartProvider` is in account mode, an account cart is never written to localStorage, and clearing or expiring the browser cart always generates a fresh `guestCartId`.
- `apps/api/src/domain/cart/` contains pure functions with zero external imports; `ImageUrlResolver` and DTO mapping live in `apps/api/src/application/cart/`; Prisma lives only in `infrastructure/database/cart.repository.ts`.

**Security model**:

- Account endpoints resolve the cart from the session user id (`createRequireAuth`); no cart id appears in any URL or body, so one user cannot read or change another's cart. Any role may use the cart.
- All `/api/cart` routes sit behind `createProxyGuard` (401 on missing or wrong `x-proxy-secret`; 403 when a write `Origin` does not match `WEB_APP_URL`).
- The quote route is unauthenticated, rate limited per client IP, and returns only public catalog data.
- No PII and no payment data; no compliance scope. Cart contents are deleted with the user (cascade).

**Configuration required**: no new environment variables. One origin reverse proxies (`deploy/Caddyfile`, `deploy/nginx.conf.example`, and `docs/deployment.md`) must route `/api/cart` and `/api/cart/*` (16 KB body cap) to the web server, matching `/api/auth/*`.

**Critical test scenarios**:

- Happy path: a visitor adds a variant, reloads, sees it; signs in and the line merges into the account cart; changes the quantity and removes it. Verifies **AC-1**, **AC-4**, **AC-9**, **AC-11**.
- Limits: stock 3 and quantity 3 means increase is disabled and add shows the at limit note; a 21st variant shows the full cart toast; a one of a kind line has no stepper. Verifies **AC-5**, **AC-6**.
- Revalidation: stock drops from 5 to 2 with quantity 4, so the next check lowers saved quantity to 2 and keeps `Only 2 left, quantity lowered` visible across drawer open and `/cart`; deactivating the product flags the line, renders fallback UI if deleted, leaves it out of the subtotal, and shows `Remove unavailable items to continue`. Verifies **AC-7**.
- Concurrency: two parallel first time `POST /items` for a new user with variant stock 1 succeed without `P2002` and end with quantity 1. Verifies **AC-5**, **AC-10**, **AC-16**.
- Merge edge cases: posting the same `guestCartId` twice is a no op; merging >20 combined variants or a 0 stock visitor item drops the extra/dead visitor lines and opens the drawer with the merge banner. Verifies **AC-11**.
- Failure: the API is down, so visitor add writes nothing and shows the error toast, while an existing visitor cart keeps its badge count and shows `Try again` in the drawer; a signed in write failure shows the toast and leaves the cart unchanged. Verifies **AC-13**, **AC-14**.
- Auth and permission: `GET /api/cart` without a session gets 401; a request without `x-proxy-secret` gets 401; a write from a foreign origin gets 403; the 61st quote in a minute gets 429. Verifies **AC-16**.
- Currency and auth screens: switching to USD updates line totals and the subtotal with no network call; `(auth)` pages render `<Header />` without crashing and hide the cart icon. Verifies **AC-3**, **AC-8**.
- Accessibility: post mount hydration matches SSR, focus traps and returns, announcements fire inside the open drawer, and axe passes on `/cart` and the open drawer in both themes. Verifies **AC-9**, **AC-17**.

## Build plan

Tracer Bullet: the first milestone stands up a thin, real visitor thread end to end (shared contracts → API → web proxy → store → product page → header → drawer). Later milestones complete the UI, add the server cart, then wire merge, sign out, and proxy config.

**Milestone 1: thin visitor thread**

1. Add `packages/shared/src/cart/` (constants, Zod schemas for `0..20` unique `variantId` lines and UUID params, `CartLineDto`/`CartAdjustmentDto`/`CartDto`/`AddOutcome`, `calculateCartSubtotal`) and export it from the barrel, satisfies **AC-5**, **AC-8**, **AC-16**
2. Add `apps/api/src/domain/cart/` pure rules (`resolveLine`, `maxQuantityFor`, `applyAdd`, `applySetQuantity`, `mergeLines`, `formatVariantLabel`) with unit tests, satisfies **AC-5**, **AC-6**, **AC-7**, **AC-11**
3. Add `apps/api/src/application/cart/` (`quoteCart` + DTO mapper with `ImageUrlResolver`), batch variant lookup on the catalog repository, and `POST /api/cart/quote` behind `createProxyGuard`, Zod validation, and the 60/min IP rate limit, satisfies **AC-7**, **AC-16**
4. Parameterize and extract `apps/web/src/lib/api-proxy/` from the auth proxy (`POST`/`PATCH`/`DELETE` write handling, configurable byte cap, pattern allow list, optional catch all; auth route tests stay green), then add `/api/cart/[[...path]]` (16 KB cap), satisfies **AC-16**
5. Install `zustand`; add the visitor cart store (`apps/web/src/lib/cart/`) with `persist` (`cp_cart`, `version: 1`, `skipHydration: true`, corrupt reset, 30 day expiry with `guestCartId` rotation, in memory fallback, `storage` event rehydrate), extract a shared `SessionProvider` (`useSession`) used by both `AuthMenu` and `CartProvider` in `(storefront)/layout.tsx`, and hide the header cart icon when `useOptionalCart()` is `null`, satisfies **AC-3**, **AC-9**, **AC-12**
6. Enable `Add to cart` in `PurchasePanel` (awaiting `quote`, `Adding...` pending state, disabled type notes, `Out of stock` label, coming soon text removed; update non UUID catalog test fixtures if needed), wire the header badge, and add a minimal drawer listing quoted lines and the subtotal, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-8**, **AC-13**

**Milestone 2: full cart UI**

7. Add the Shadcn `Sheet` primitive (`ui/sheet.tsx` on the umbrella `radix-ui` Dialog), extend `QuantityStepper` with optional `itemTitle` accessible labels, and build the full drawer and `/cart` page (`noindex`, route change auto close, line layout and null fallbacks, summary, disabled checkout with block reason, empty state, `View cart`), satisfies **AC-4**, **AC-7**, **AC-17**
8. Wire limits, notices, and session memory `LOWERED` tracking: increase disabled at max, inline at limit note, full cart toast, unavailable on add toast, and silent quantity lowering without bumping `updatedAt`, satisfies **AC-5**, **AC-6**, **AC-7**
9. Add skeletons, the quote/load error state with `Try again`, `Clear cart` with its confirm dialog, polite live regions (inside the drawer and on page), and focus return, satisfies **AC-14**, **AC-15**, **AC-17**

**Milestone 3: server cart for accounts**

10. Add the Prisma migration for `Cart` and `CartItem` (with the `CHECK (quantity BETWEEN 1 AND 10)` constraint in SQL) and `cart.repository.ts` using `INSERT ... ON CONFLICT (user_id) DO NOTHING` before `SELECT ... FOR UPDATE`, satisfies **AC-5**, **AC-10**
11. Add use cases `getCart` (lazy expiry, persisted lowering without touching `Cart.updatedAt`), `addItem`, `setItemQuantity` (404/409/clamp rules), `removeItem`, `clearCart`, and Express routes with `createRequireAuth`, origin check, 120/min `GET` limit, and shared 120/min write limit; add PostgreSQL integration tests including concurrency, satisfies **AC-7**, **AC-10**, **AC-13**, **AC-16**, **AC-18**
12. Add account mode in `CartProvider`: initial `GET /api/cart` with skeletons and error state, server awaited mutations with pending locks and failure toast, `BroadcastChannel("cp_cart")` sync, and `visibilitychange` refetch, satisfies **AC-10**, **AC-13**, **AC-14**

**Milestone 4: merge, sign out, deployment**

13. Add `mergeCart` use case and `POST /api/cart/merge` (lazy expiry, existing slots first, newest first visitor fold in, drop/cap `adjustments`, visitor `addedAt` preservation, `lastMergedGuestCartId` idempotency); trigger merge in `CartProvider` when entering account mode with local lines, clear local storage with a new `guestCartId` on success, and show the dismissible merge banner (auto opening the drawer when `adjustments` is not empty), satisfies **AC-11**
14. Verify sign out transition via shared `SessionProvider` (account lines drop from memory immediately, showing the empty browser cart with its fresh `guestCartId`), satisfies **AC-12**
15. Route `/api/cart` and `/api/cart/*` (16 KB cap) to the web server in `deploy/Caddyfile`, `deploy/nginx.conf.example`, and `docs/deployment.md`, satisfies **AC-16**

**Milestone 5: full test pass**

16. Add component tests (store, `SessionProvider` + `CartProvider`, `PurchasePanel`, `Header` with and without `CartProvider`, drawer, `/cart` page) and Playwright `e2e/cart.spec.ts` (forwarding distinct client IPs or testing within the quote limit) with axe checks in light and dark themes, satisfies **AC-17**, **AC-18**

## Consequences

**Positive**:

- Signed in carts follow customers across devices; checkout (feature 9) always has a server cart to read, because checkout requires sign in.
- One set of domain rules resolves both modes, so stock, limits, and prices never disagree between visitor and account carts.
- Sharing `SessionProvider` between `AuthMenu` and `CartProvider` avoids duplicate `/api/auth/me` calls, refreshes expired 15 minute access cookies automatically, and switches cart modes cleanly on sign out.

**Negative / tradeoffs**:

- Two storage modes plus a merge is noticeably more code and test surface than a browser only cart: a migration, seven endpoints, a shared proxy refactor, and merge adjustment rules.
- Every cart view costs one API call (quote or `GET /api/cart`), and the header badge populates after client hydration (the icon button reserves fixed dimensions so layout never shifts).
- No stock reservation: two shoppers can both hold the last one of a kind piece; the loser finds out at the next cart check or at checkout.
- In memory rate limits are per API instance; multi instance deployments get looser effective limits until feature 33.
- Deployments must route `/api/cart` and `/api/cart/*` to the web server; a missed proxy rule breaks the cart in one origin setups.

**Neutral**:

- New dependency `zustand` in `apps/web`.
- Downstream contract for feature 9: checkout reads the session user's server cart, revalidates it, snapshots prices from `getActiveCurrency()` (spec 0007), and decides when to clear the cart. Feature 14 makes `CartItem.variantId` nullable and adds `DIGITAL` to the cartable types.

## Follow-up

- [ ] The scope row text for feature 8 still says "client side shopping cart (Zustand)"; `/scope` or `/sync` should reword it to the hybrid cart.
- [ ] Record the declined Zustand Agent Skills (`mindrally/skills@zustand-state-management`, `yonatangross/orchestkit@zustand-patterns`, `fusengine/claude-plugins@nextjs-zustand`, `wshobson/agents@react-state-management`, `lobehub/lobehub@zustand`) on the `Declined:` line in `apps/web/AGENTS.md` (`/sync`).
- [ ] Add the cart boundary (`/api/cart`, proxy secret, origin, rate limits) and the cart proxy to `apps/api/AGENTS.md` and `apps/web/AGENTS.md` once built (`/sync`).
- [ ] Feature 9 spec should cite the downstream contract above (server cart read, revalidation, clearing).
- [ ] Feature 26 (Meta Pixel) should fire `AddToCart` from the cart store's add success path.
- [ ] Feature 33 should move the cart limits to shared storage if the API runs more than one instance.
