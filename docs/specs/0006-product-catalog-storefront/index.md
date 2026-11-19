# Product Catalog Storefront

**Date**: 2026-11-10
**Status**: Accepted

## Summary

This spec designs the public catalog: a home page with featured pieces, a filterable shop, product detail pages with variants and lead times, and collection pages built from the existing category tree. Every visible value comes from PostgreSQL through the Express API, and every price is shown in the active currency. The catalog is read only for customers; no new database entities are needed, only indexes that support the catalog queries.

The work is one Tracer Bullet thread through the existing stack. A customer can open the home page, browse real products, filter and paginate the shop, open a product, choose a variant, and see the correct price, stock status, and lead time. Filter state lives in the URL, so a shared or reloaded link shows the same view.

## Requirements

### User stories

- As a visitor, I can land on the home page and see featured pieces plus a way into each collection.
- As a visitor, I can browse all products, filter by category, product type, and price, sort the results, and move through numbered pages.
- As a visitor, I can open a product and see its images, description, variants, price in my currency, stock status, and lead time.
- As a visitor, I can browse collections, including a parent category and its child categories.
- As a visitor, I get clear empty, loading, error, and not found states instead of a broken page.

### Acceptance criteria

- **AC-1**: The home page renders a text only hero on a token based background, up to 8 featured products from the database, a strip of top level collections that have visible products, a brand promise section, and a closing custom order call to action. A section with no data is hidden. No new hero photography is required.
- **AC-2**: `/shop` lists only visible products, where visible means `isActive = true` and `deletedAt = null`, newest first by default, 12 per page. Each card shows the base price in the active currency and a Sold Out badge when the product is not available.
- **AC-3**: Category and product type filters are multi select. Values within one dimension combine with OR, and dimensions combine with AND. The price filter has a minimum and a maximum, interpreted in the active currency. The result count and grid update after Apply.
- **AC-4**: The sort control offers newest, price low to high, and price high to low. Changing it applies immediately, resets the page to 1, and preserves the active filters in the URL.
- **AC-5**: Numbered pagination preserves every active filter. A `page` value beyond the last page clamps to the last real page. When there are zero results, the page stays at 1 and the empty state is shown.
- **AC-6**: Filter, sort, and page state is carried by the URL and survives reload and sharing. The web parser silently drops invalid values and swaps a minimum price greater than the maximum. The API returns 400 for malformed query values.
- **AC-7**: `/shop/[slug]` renders a visible product with its title, description, category, tags, image gallery, base price in the active currency, stock status, and lead time.
- **AC-8**: Variant selectors are grouped by colour, size, and yarn type. Unavailable combinations are disabled. Choosing an available variant updates the displayed price to the base price plus the variant additional price in the active currency, and updates the stock status. Lead time is product level and does not change with the variant. The first available variant in id ascending order is preselected. A product with no variants shows no selector.
- **AC-9**: The add to cart button is visible but disabled, with a short note that the cart is coming soon. A missing, inactive, or soft deleted product slug renders the styled not found page.
- **AC-10**: A product detail page shows up to 4 related visible products from the same category, excluding the current product, newest first. The section is hidden when there are none, including when the product has no category.
- **AC-11**: `/collections` shows top level categories that have at least one visible product in their subtree. Each card shows the name, description, cover image, and subtree product count. Categories with no visible products are hidden. An empty state renders when no collection qualifies.
- **AC-12**: A parent category page shows its nonempty child categories and includes products from descendant categories. A child category page shows its own products. Breadcrumbs show the full category trail.
- **AC-13**: `/collections/[slug]` is the canonical category landing page. A `/shop` view sets its canonical to that collection only when it has exactly one category, page 1, the default sort, and no other filters. Multi category and every other filtered view keep a self canonical URL.
- **AC-14**: The active currency is read from the `cp_currency` cookie on the server. `BDT` is the default and `USD` is used when the cookie holds that value. All prices and price filter labels use the active currency. No visible currency switcher is added in this feature.
- **AC-15**: Home, shop, collection, and product pages set a title and description. Product metadata uses `metaTitle` and `metaDescription` when present. Product and collection pages set a canonical URL and OpenGraph image. Pages without a product or collection image use the committed default OpenGraph image. Product detail pages include Product JSON-LD built from the database values.
- **AC-16**: Catalog routes render skeleton loading states, an empty state with a clear filters action, a retryable error state when the API fails, a styled not found page, and the local placeholder committed in Slice 1 when an image is missing or fails to load.
- **AC-17**: Every catalog screen meets WCAG 2.1 AA. Filters, the mobile filter drawer, the gallery, and variant selectors work by keyboard, colour is never the only signal, focus is visible, touch targets are at least 44px, and reduced motion is respected.
- **AC-18**: The catalog API is public and read only. `GET /api/products` returns `{ data, meta }` with `page`, `pageSize`, `total`, and `totalPages`. `GET /api/products/:slug`, `GET /api/categories`, and `GET /api/categories/:slug` return catalog DTOs. Cloudinary public IDs are resolved to delivery URLs by the API. Internal fields never appear in a response.
- **AC-19**: Domain rules have unit tests. The API and Prisma repository have integration tests. The filter form, variant selector, and gallery have component tests. One Playwright flow browses the shop, applies a filter, and opens a product on desktop and mobile.

## Decision

Build the catalog as a public read path through the existing Clean Architecture stack. The Express API owns catalog queries, visibility rules, stock rules, price composition, category subtree expansion, and Cloudinary URL resolution. The Next.js App Router consumes that API from server components with a small server only client, renders the storefront in a `(storefront)` route group, and keeps filter state in plain URL search parameters. The existing `Product`, `ProductImage`, `ProductVariant`, and `Category` tables are used unchanged; one migration adds the indexes the catalog queries need.

Implementation skills: `nextjs-app-router` for the route group, server components, metadata, `searchParams`, and loading and error boundaries. No other installed skill materially shapes this feature.

## Feature design

### Data model sketch

No new entities are introduced. The feature reads four existing tables.

```text
Category 1 to many Product
Category 1 to many Category (parent and children)
Product 1 to many ProductImage
Product 1 to many ProductVariant
```

Fields used:

| Entity           | Fields used by the catalog                                                                                                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Category`       | `id`, `parentId`, `name`, `slug`, `description`, timestamps                                                                                                                                           |
| `Product`        | `id`, `categoryId`, `title`, `slug`, `description`, `productType`, `priceBdt`, `priceUsd`, `isActive`, `isFeatured`, `leadTimeDays`, `metaTitle`, `metaDescription`, `tags`, `deletedAt`, `createdAt` |
| `ProductImage`   | `productId`, `imageUrl` (Cloudinary public ID), `altText`, `isPrimary`, `displayOrder`                                                                                                                |
| `ProductVariant` | `id`, `productId`, `sku`, `colorName`, `colorHex`, `sizeLabel`, `yarnType`, `stockQuantity`, `additionalPriceBdt`, `additionalPriceUsd`                                                               |

The only schema change is one migration with these indexes:

- `products (is_active, deleted_at, created_at)`
- `products (category_id, is_active, deleted_at, created_at)`
- `products (product_type, is_active, deleted_at, created_at)`
- `products (is_featured, is_active, deleted_at, created_at)`
- `products (price_bdt)`
- `products (price_usd)`
- `product_images (product_id, is_primary, display_order)`

No unique constraint is added for variant combinations. The seed and the future admin form keep combinations unique per product. The selector treats the first matching variant as the chosen variant if duplicate combinations ever appear.

### Derived read rules

- **Visible product**: `isActive = true` and `deletedAt = null`.
- **Available product**: `DIGITAL`, `CUSTOM`, and `PRE_ORDER` are always available. `STANDARD` and `ONE_OF_A_KIND` are available when at least one variant has `stockQuantity > 0`. A `STANDARD` or `ONE_OF_A_KIND` product with no variants is out of stock.
- **Base price**: `priceBdt` or `priceUsd` from `Product`, selected by the active currency.
- **Detail price**: base price plus the selected variant's `additionalPriceBdt` or `additionalPriceUsd`, selected by the active currency. Computed in integer minor units and returned with at most two decimals.
- **Card price**: base price only. Card prices never include a variant additional price.
- **Category product count**: visible products assigned to the category and all of its descendants.
- **Collection cover**: the primary image of the newest visible product in the category subtree. If that product has no image, the cover is null.
- **Primary image**: the image with `isPrimary = true`. If none is marked, the image with the lowest `displayOrder`, then the lowest id. Gallery order is primary first, then `displayOrder` ascending.
- **Related products**: up to 4 visible products with the same direct `categoryId`, excluding the current product, newest first. A product with no category has no related products.
- **Page clamp**: the API clamps a requested page to `max(1, min(requestedPage, totalPages))`. When `total` is 0, the returned page is 1 and `totalPages` is 0. The web redirects to the clamped page when it differs from the requested page.
- **Category tree resolution**: the application loads the category tree once per request and resolves descendants with a visited set, so a parent cycle is ignored after the first visit. The resolved category ids are passed to the repository. The repository does not recurse per category.
- **Filter sidebar categories**: the categories endpoint returns every category with its subtree count. The web shows only categories with `productCount > 0` in the filter sidebar. A stale URL for a category that is now empty still renders the empty state.
- **Child categories**: a parent category page shows a child when the child's subtree count is greater than zero, using the same rule as the collections index.
- **Variant order and selection**: variants are ordered by id ascending. The first variant in that order with `inStock = true` is preselected. An option is enabled when at least one variant with `inStock = true` matches every other chosen dimension plus that option. If a choice leaves no matching variant, the dimensions after the changed one, in colour, size, yarn order, reset to their first available option and the first matching variant is selected.
- **Null variant dimensions**: a dimension group appears when at least one variant has a non null value for it. A null value is shown as a `Standard` option when the group appears. When every variant is null for a dimension, the group is hidden.
- **Variant price helper**: the pure function that adds the base price and the selected variant additional price lives in `packages/shared` and is used by both the API and the client. The client uses `ProductVariantDto.inStock` and the combination rule above; it never recomputes stock.
- **Canonical URL**: a shop view canonicalises to `/collections/[slug]` only when it has exactly one category, page 1, sort `newest` or absent, and no type, price, or featured filter. Every other shop view uses its own normalized URL including its filters. A collection page canonicalises to itself.
- **Product JSON-LD**: the active currency is the offer currency. When variants exist, use `AggregateOffer` with `lowPrice` and `highPrice` computed from the base plus every variant additional price in that currency, and `offerCount` equal to the variant count. When there are no variants, use a single `Offer` at the base price. Availability maps to `InStock` for available products, `OutOfStock` for sold out products, and `PreOrder` for `PRE_ORDER`. Include the product URL, image array, description, and brand. Do not include ratings.

Stock and lead time labels:

| Product type and state                                                  | Stock label              |
| ----------------------------------------------------------------------- | ------------------------ |
| `STANDARD` or `ONE_OF_A_KIND`, selected variant stock 1 to 5            | `Only X left`            |
| `STANDARD` or `ONE_OF_A_KIND`, selected variant stock above 5           | `In stock`               |
| `STANDARD` or `ONE_OF_A_KIND`, selected variant stock 0, or no variants | `Sold out`               |
| `DIGITAL`                                                               | `Available now`          |
| `CUSTOM`                                                                | `Made to order`          |
| `PRE_ORDER`                                                             | `Available to pre order` |

Lead time is product level. `leadTimeDays = 0` renders `Ready to ship`. A positive value renders `Handcrafted in X days`, where `X` is the stored number.

### State transitions

The catalog has no persistent workflow state. The table records the state that does exist so the builder does not invent more.

| State                  | Where it lives                       | Transition                                                                         |
| ---------------------- | ------------------------------------ | ---------------------------------------------------------------------------------- |
| Active currency        | `cp_currency` cookie, read only here | Feature 7 writes it; this feature only reads and validates it                      |
| Filters, sort, page    | URL search parameters                | Filter form Apply, sort change, and pagination links replace the URL               |
| Selected variant       | Client component memory              | First available variant on load; changes on option selection; resets on navigation |
| Selected gallery image | Client component memory              | First image on load; changes on thumbnail or swipe                                 |
| Cart                   | None                                 | Add to cart is disabled until feature 8                                            |

### API surface

All routes are public GET routes under `/api`, mounted beside health and auth. No auth header and no proxy secret are required. Response bodies follow the existing error shape on failure: `{ error: { message, statusCode, code?, details? } }`.

| Method | Path                    | Query                                                                                                                                         | Success response                                                             | Errors                   |
| ------ | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------ |
| GET    | `/api/products`         | `category` repeatable category slug, `type` repeatable `ProductType`, `minPrice`, `maxPrice`, `currency`, `sort`, `page`, `limit`, `featured` | `{ data: ProductSummaryDto[], meta: { page, pageSize, total, totalPages } }` | 400 `INVALID_QUERY`      |
| GET    | `/api/products/:slug`   | None                                                                                                                                          | `{ data: ProductDetailDto }`                                                 | 404 `PRODUCT_NOT_FOUND`  |
| GET    | `/api/categories`       | None                                                                                                                                          | `{ data: CategorySummaryDto[] }`                                             | None expected            |
| GET    | `/api/categories/:slug` | None                                                                                                                                          | `{ data: CategoryDetailDto }`                                                | 404 `CATEGORY_NOT_FOUND` |

Query rules:

- `category` is repeatable. Unknown category slugs match nothing and do not return 400. A parent category expands to itself and all descendants.
- `type` is repeatable and must be one of the five `ProductType` values. An invalid value returns 400.
- `minPrice` and `maxPrice` are nonnegative numbers with at most two decimal places. They filter the price column selected by `currency`. If both are present and `minPrice > maxPrice`, return 400 `INVALID_QUERY`.
- `currency` is `BDT` or `USD`, default `BDT`. It selects the price column for filtering and sorting only. Every product response still carries both `priceBdt` and `priceUsd`. The web sends `currency` on every catalog list request, even when no price filter is active, because the currency also selects the price sort column. This keeps the Next fetch cache key separate for BDT and USD.
- `sort` is `newest`, `price-asc`, or `price-desc`, default `newest`. Price sorts use the selected currency column. Ties break by `createdAt` descending, then id ascending.
- `page` is a positive integer, default 1. Values beyond the last page are clamped as described above.
- `limit` is an integer from 1 to 48, default 12. The web always sends 12.
- `featured` is an optional boolean. When `true`, only featured visible products are returned. The home page uses `featured=true&limit=8`.
- Repeated values are deduplicated. Query objects, arrays of objects, empty values, and non numeric values return 400 with a clear message and an `issues` detail array.

DTOs live in `packages/shared` and are re-exported from the package barrel. They use explicit nulls so the web never has to guess between missing and empty.

- `ProductSummaryDto`: `id`, `slug`, `title`, `productType`, `priceBdt`, `priceUsd`, `primaryImageUrl`, `primaryImageAlt`, `isFeatured`, `inStock`, `leadTimeDays`, `category` (`CategoryRefDto` or null), `tags`.
- `ProductImageDto`: `url`, `alt`, `isPrimary`, `displayOrder`.
- `ProductVariantDto`: `id`, `sku`, `colorName`, `colorHex`, `sizeLabel`, `yarnType`, `stockQuantity`, `inStock`, `additionalPriceBdt`, `additionalPriceUsd`. The API computes `inStock` with the product type and stock rule so the client does not duplicate it.
- `ProductDetailDto`: every summary field plus `description`, `images`, `variants`, `metaTitle`, `metaDescription`, `categoryTrail` (`CategoryRefDto[]`), and `related` (`ProductSummaryDto[]`).
- `CategoryRefDto`: `id`, `name`, `slug`.
- `CategorySummaryDto`: `id`, `name`, `slug`, `parentId`, `description`, `productCount`, `coverImageUrl`, `coverImageAlt`.
- `CategoryDetailDto`: every summary field plus `breadcrumb` (`CategoryRefDto[]`, root to parent) and `children` (`CategorySummaryDto[]`).
- `PaginationMetaDto`: `page`, `pageSize`, `total`, `totalPages`.

`priceBdt`, `priceUsd`, `additionalPriceBdt`, and `additionalPriceUsd` are JSON numbers. The API converts Prisma `Decimal` values with `toNumber()` after writing them with two decimal places. `isActive` and `deletedAt` never leave the API.

### Web behavior

- The public storefront lives in the `(storefront)` route group. Its layout renders the existing Header and Footer. The root layout keeps the document, theme, fonts, and default metadata.
- The home page fetches featured products and categories in parallel. It hides the featured section when there are none and the collections strip when no top level category has a count above zero.
- The shop page fetches categories first, builds the known category slug set, parses the URL, and then fetches products. If the category fetch fails, the page renders the retryable error state, because the filter UI and the forgiving parser both depend on it.
- The shop filter form uses GET with Apply and Clear all. Sort applies immediately with the router and preserves the current filters. Pagination is server rendered links. Every list request includes `currency` for cache separation.
- The product detail page fetches the product by slug. The purchase panel is a client component that receives the variant DTOs, the base prices, the active currency, the product type, and the lead time. It applies the variant selection and price helper rules, shows the stock and lead time labels, and renders the disabled cart button.
- The collections index fetches categories and renders top level categories with a count above zero. A collection page fetches `GET /api/categories/:slug` for the header, breadcrumbs, children, and count, and fetches `GET /api/products?category=<slug>` for the paginated product grid. The two reads share the same subtree rule.
- Every catalog page reads the active currency from the `cp_currency` cookie and passes it to the server rendered prices and the client purchase panel.
- Missing or failed images resolve to `/images/product-placeholder.webp`. Pages without a product or collection image use `/images/og-default.webp` for OpenGraph.

### Value sourcing

| Displayed or computed value                          | Source                                                                                    |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Product title, slug, description, product type, tags | `products` table                                                                          |
| Base price in BDT and USD                            | `products.price_bdt`, `products.price_usd`                                                |
| Variant name, swatch, size, yarn, SKU                | `product_variants`                                                                        |
| Variant additional price                             | `product_variants.additional_price_bdt`, `additional_price_usd`                           |
| Displayed product price                              | Domain calculation: base plus selected variant additional in the active currency          |
| Stock status                                         | Domain rule over `product_type` and `product_variants.stock_quantity`                     |
| Variant availability                                 | `ProductVariantDto.inStock`, computed by the API with the same stock rule                 |
| Variant order                                        | `product_variants.id` ascending                                                           |
| Lead time                                            | `products.lead_time_days`                                                                 |
| Primary card image                                   | `product_images` primary rule, resolved by the Cloudinary resolver                        |
| Gallery images                                       | `product_images` sorted by primary and display order, resolved by the Cloudinary resolver |
| Category name, slug, description, parent             | `categories` table                                                                        |
| Category product count                               | Count of visible products in the category subtree                                         |
| Collection cover                                     | Newest visible product in the subtree and its primary image                               |
| Featured products                                    | `products.is_featured` plus visibility and `limit=8`                                      |
| Related products                                     | Same direct category, visible, newest first, limit 4                                      |
| Result count                                         | API `meta.total`                                                                          |
| Page numbers                                         | API `meta.page`, `meta.totalPages`, and the current URL                                   |
| Active currency                                      | `cp_currency` cookie, validated against `Currency`, default `BDT`                         |
| Filter options                                       | `GET /api/categories` plus the shared `ProductType` values                                |
| Sort label                                           | URL `sort` parameter, default `newest`                                                    |
| Canonical URL                                        | Normalized URL state plus `WEB_APP_URL`                                                   |
| Page title and description                           | Page copy, or `meta_title` and `meta_description` for products                            |
| OpenGraph image fallback                             | `/images/og-default.webp` when no product or collection image exists                      |
| Product JSON-LD                                      | Product fields, images, variant prices, and stock rule                                    |
| Customer facing copy                                 | The copy deck in this spec                                                                |

### Cloudinary image resolution

The API stores Cloudinary public IDs, as the data model already does. The API resolves each ID at the presentation edge with `ImageUrlResolver`:

- An empty or null ID returns null.
- An absolute `https://` URL on `res.cloudinary.com` is returned unchanged.
- Any other absolute URL returns null, including `http://` URLs and URLs on other hosts. This is deliberate hardening: a tampered or mis-seeded value cannot point customers at an arbitrary host. The web falls back to the placeholder.
- A value that looks absolute but does not parse as a URL returns null.
- Any other value becomes `https://res.cloudinary.com/<CLOUDINARY_CLOUD_NAME>/image/upload/f_auto,q_auto/<publicId>`. Slashes inside the public ID are preserved.
- The resolver never rewrites the database value.

The web uses the placeholder committed in Slice 1 at `/images/product-placeholder.webp` when the resolver returns null or when a remote image fires an error. The default OpenGraph image at `/images/og-default.webp` is also committed in Slice 1. Seed image IDs must be uploaded to the configured Cloudinary account for real images to appear. Until then, the placeholder is the expected local state.

The six logo files in `apps/web/public/` (`logo.png`, `logo-square.png`, `logo.jpg`, `logo-square.jpg`, `logo.webp`, `logo-square.webp`) are intentionally retained for future brand use outside the current storefront. They are not referenced by this feature, and that is expected. Do not remove them as unused assets.

### Security model

- Catalog routes are public and read only. They never require a session, the proxy shared secret, or an admin role.
- Every query passes through Zod validation before it reaches Prisma. Unknown or malformed values return 400. Prisma parameterizes the database queries.
- Every repository read applies the visibility rule. A hidden product or category never appears in a list and never returns a detail response.
- DTO mappers whitelist fields. `isActive`, `deletedAt`, internal ids not needed by the UI, and any future internal columns stay inside the API.
- The Cloudinary cloud name is public information. API keys and secrets are not read or returned by this feature.
- The API sets no catalog cache headers. The web caches its own server side fetch for 60 seconds.
- No application level rate limiting is added. The reverse proxy or WAF owns request limits. This is recorded in Follow-up.
- JSON-LD is serialized on the server with `<` escaped, so product text cannot break out of the script element.
- The existing centralized error handler is used. Unexpected errors do not leak stack traces to the client.

### Configuration

| Variable or cookie      | Where                                  | Required                                     | Purpose                                                   |
| ----------------------- | -------------------------------------- | -------------------------------------------- | --------------------------------------------------------- |
| `CLOUDINARY_CLOUD_NAME` | API                                    | Yes, no default, placeholder values rejected | Builds Cloudinary delivery URLs                           |
| `API_INTERNAL_URL`      | Web server only                        | Yes, existing validation                     | Base URL for server side catalog fetches, includes `/api` |
| `WEB_APP_URL`           | Web server only                        | Yes, existing validation                     | `metadataBase`, canonical URLs, and JSON-LD URLs          |
| `cp_currency`           | Browser cookie, read by the web server | No                                           | Active currency, `BDT` default, `USD` accepted            |

`CLOUDINARY_CLOUD_NAME` is added to `ApiEnv`, `apps/api/.env.example`, the root environment example, the deployment guide, API environment tests, and the Playwright and CI environment. `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` remain unparsed until an upload feature needs them.

### Copy deck

The copy below is the starting text. The engineer may edit it during review. It is written for a warm, handmade voice.

**Home**

- Hero eyebrow: `Handmade in small batches`
- Hero heading: `Handmade pieces, made to be kept`
- Hero body: `Every stitch is worked by hand in our studio, from soft amigurumi friends to scarves you will reach for all winter. Small batches, thoughtful materials, and a little bit of joy in every piece.`
- Primary call to action: `Shop the collection`
- Secondary call to action: `Explore collections`
- Featured heading: `Featured pieces`
- Featured description: `A few favourites from the studio, ready to find a home.`
- Collections heading: `Shop by collection`
- Collections description: `Start with a category, then make it yours.`
- Promise heading: `Made slowly, made well`
- Promise pillar one: `Worked by hand` and `Each piece is crocheted in small batches, never mass produced.`
- Promise pillar two: `Thoughtful materials` and `Soft cottons, warm wool blends, and colours chosen to last.`
- Promise pillar three: `Made for you` and `Need a different colour or size? Custom orders are always welcome.`
- Closing heading: `Have something made just for you?`
- Closing body: `Tell us what you have in mind and we will work with you on a custom piece.`
- Closing button: `Start a custom order`

**Shop**

- Page title: `Shop`
- Page description: `Handmade crochet pieces, from amigurumi friends to cosy scarves.`
- Result count: `1 piece` or `X pieces`
- Filters heading: `Filters`
- Category legend: `Category`
- Product type legend: `Product type`
- Price legend: `Price range`
- Minimum label: `Minimum`
- Maximum label: `Maximum`
- Currency hint: `Prices in BDT` or `Prices in USD`
- Apply button: `Apply filters`
- Clear link: `Clear all`
- Sort label: `Sort by`
- Sort options: `Newest`, `Price: low to high`, `Price: high to low`
- Empty heading: `No pieces match these filters`
- Empty body: `Try removing a filter or widening the price range.`
- Empty action: `Clear all filters`
- Error heading: `We could not load the shop`
- Error body: `Something went wrong on our side. Please try again.`
- Error action: `Try again`

**Collections**

- Index title: `Collections`
- Index description: `Browse the studio by collection, from amigurumi to wearables.`
- Child section heading: `Inside this collection`
- Empty index heading: `No collections yet`
- Empty index body: `New pieces are on the way. Check back soon.`
- Empty collection heading: `Nothing here yet`
- Empty collection body: `This collection is waiting for its first piece. Explore the rest of the shop in the meantime.`
- Empty collection action: `Browse all pieces`

**Product detail**

- Add to cart: `Add to cart`
- Cart note: `Cart is coming soon. You can still explore the full collection or ask for a custom piece.`
- Variant labels: `Colour`, `Size`, `Yarn`
- Stock labels: `In stock`, `Only X left`, `Sold out`, `Available now`, `Made to order`, `Available to pre order`
- Lead time labels: `Ready to ship`, `Handcrafted in X days`
- Details heading: `Details`
- Related heading: `You may also like`
- Gallery thumbnail label: `View image X of Y`
- Not found heading: `This piece could not be found`
- Not found body: `It may have sold out or moved. The rest of the shop is still here.`
- Not found action: `Back to shop`

**Page metadata**

- Home title: `Crochet PeakZ | Handmade crochet pieces`
- Home description: `Handmade crochet amigurumi, wearables, patterns, and custom pieces from Crochet PeakZ.`
- Shop title: `Shop handmade crochet | Crochet PeakZ`
- Shop description: `Browse handmade crochet pieces, filter by collection, product type, and price, and find something made to be kept.`
- Collections title: `Collections | Crochet PeakZ`
- Collections description: `Explore the Crochet PeakZ collections, from amigurumi to wearables and scarves.`
- Collection title: `[Category name] | Crochet PeakZ`
- Collection description: the category description.
- Product title: `metaTitle` when set, otherwise the product title.
- Product description: `metaDescription` when set, otherwise the product description trimmed to 160 characters.

### Key invariants

1. No public catalog response contains a product with `isActive = false` or a non null `deletedAt`.
2. A hidden or missing product slug returns the styled not found page, never a partial product.
3. Stock and price labels come from the domain rules, not from ad hoc page logic.
4. The API returns both currencies. The active currency selects display and filtering, never conversion.
5. Category counts and category product lists include descendant categories.
6. The URL is the only source of truth for filters, sort, and page. The cookie is the only source of truth for currency.
7. The API is strict and the web is forgiving. Invalid URL values are dropped by the web and never reach the API.
8. No internal field or database entity crosses the API boundary.
9. Cloudinary public IDs are resolved in one place, at the API presentation edge.
10. A product detail CTA never claims the cart works before feature 8.

### Critical test scenarios

| Scenario                                                                                                                               | AC                 |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Home hides featured and collection sections when the API returns no data, and renders them when data exists                            | AC-1               |
| Shop hides inactive and soft deleted products and shows only 12 per page                                                               | AC-2               |
| Category OR, type OR, and category AND type filter combinations return the expected products                                           | AC-3               |
| Price minimum and maximum filter the active currency column                                                                            | AC-3, AC-14        |
| Sort applies newest, price ascending, and price descending, and resets the page                                                        | AC-4               |
| Page beyond the last page clamps, and zero results stay on page 1                                                                      | AC-5               |
| Web parser drops unknown category and type values and swaps minimum greater than maximum                                               | AC-6               |
| API rejects malformed type, sort, currency, page, limit, and price values with 400                                                     | AC-6, AC-18        |
| Product detail returns full images, variants, category trail, and related products                                                     | AC-7, AC-10, AC-18 |
| Variant selection narrows available options and updates the displayed price in the active currency, while the API returns both prices  | AC-8, AC-14        |
| A null variant dimension renders a Standard option, and a dimension that is null for every variant is hidden                           | AC-8               |
| The filter sidebar hides categories with a zero subtree count, and a stale empty category URL renders the empty state                  | AC-3, AC-11        |
| A hidden product slug returns 404 and the styled not found page                                                                        | AC-9               |
| A product with no variants shows no selector and uses the base price                                                                   | AC-8               |
| Collections hide categories with zero visible products and use the cover fallback                                                      | AC-11              |
| Parent category listing includes child products and child cards hide empty children                                                    | AC-12              |
| Canonical points to the collection only for a single category shop view with page 1 and default sort, and stays self for other filters | AC-13              |
| Currency cookie defaults to BDT, accepts USD, and ignores invalid values                                                               | AC-14              |
| Product metadata uses stored SEO fields, canonical, and OpenGraph image                                                                | AC-15              |
| Product JSON-LD contains the expected name, images, price range, currency, and availability                                            | AC-15              |
| API failure renders the retryable error state and empty results render the empty state                                                 | AC-16              |
| A broken image renders the local placeholder                                                                                           | AC-16              |
| Keyboard navigation, focus, labels, and touch targets pass the accessibility checks                                                    | AC-17              |
| API list envelope, detail DTO, category DTO, and public access are correct                                                             | AC-18              |
| Playwright browses, filters, and opens a product on desktop and mobile                                                                 | AC-19              |

## Build plan

The plan follows the Tracer Bullet approach. Slice 1 proves the whole pipe from PostgreSQL to a rendered storefront. Later slices thicken the listing, the product detail, the collections, and the quality gates. Every task names the acceptance criteria it satisfies.

### Slice 1: Contracts and the first end to end thread

- Add the catalog index migration and the Prisma schema `@@index` entries. (AC-18)
- Add `ProductSummaryDto`, `ProductDetailDto`, `ProductImageDto`, `ProductVariantDto` with `inStock`, `CategoryRefDto`, `CategorySummaryDto`, `CategoryDetailDto`, `PaginationMetaDto`, the sort type, the list query schema, and the shared variant price helper to `packages/shared`, and re-export them from the barrel. (AC-18)
- Add `CLOUDINARY_CLOUD_NAME` to `ApiEnv`, the environment loader, environment tests, both `.env.example` files, the deployment guide, and the test environment. (AC-18)
- Add the catalog domain rules for visibility, availability, variant order, variant selection, base price, detail price, and image ordering, with unit tests. (AC-2, AC-7, AC-8, AC-18)
- Add the `CatalogRepository` and `ImageUrlResolver` ports. (AC-18)
- Add the Prisma catalog repository for list, product detail, related products, category list, and category detail, with integration tests. (AC-2, AC-7, AC-10, AC-11, AC-12, AC-18)
- Add the Cloudinary resolver and its tests, including absolute URLs, slash preservation, empty values, and the `f_auto,q_auto` path. (AC-18)
- Add the list, detail, categories, and category detail use cases with unit tests against in memory fakes. Resolve category descendants with a visited set in the application layer and pass the resolved ids to the repository. (AC-2, AC-7, AC-10, AC-11, AC-12, AC-18)
- Add the catalog router with strict query validation, DTO mapping, and the existing `AppError` and error handler. Mount it from `createApp` with an optional catalog router argument. (AC-2, AC-6, AC-7, AC-18)
- Add API integration tests for the list envelope, visibility, detail, 404, and categories. (AC-2, AC-7, AC-18)
- Add the server only catalog API client and env helper, using `API_INTERNAL_URL`, a 60 second revalidate, and a typed error. (AC-1, AC-14, AC-16)
- Add the `(storefront)` route group layout with Header and Footer, move the real home page into it, keep the root layout for html, body, theme, and metadata, and add `metadataBase` from `WEB_APP_URL`. (AC-1, AC-15)
- Commit `apps/web/public/images/product-placeholder.webp` and `apps/web/public/images/og-default.webp`. (AC-1, AC-16)
- Add the home page hero, featured grid, collections strip, promise, and custom call to action, plus `ProductImage`, `ProductGrid`, and the updated `ProductCard`. (AC-1, AC-14, AC-16)
- Add a minimal `/shop` page that renders the real product grid with base prices and stock badges. (AC-2, AC-14)

### Slice 2: Filtering, sorting, and pagination

- Add the web search parameter parser with repeatable category and type values, known category validation, type validation, price parsing, minimum and maximum swap, sort whitelist, and page reset. Add unit tests. (AC-3, AC-4, AC-5, AC-6)
- Add the desktop filter sidebar and the mobile filter drawer with a GET form, Apply, Clear all, category checkboxes, product type checkboxes, minimum and maximum inputs, and the active currency hint. Show only categories with a subtree count above zero. (AC-3, AC-6, AC-17)
- Add the sort select that applies immediately, preserves filters, and resets the page. (AC-4, AC-6)
- Add the numbered pagination component that preserves filters and renders accessible page links. (AC-5, AC-17)
- Wire the shop page to fetch categories first, render the retryable error state if that fetch fails, parse the URL, fetch products, redirect to the clamped page, and render the result count. (AC-3, AC-4, AC-5, AC-6, AC-14, AC-16)
- Add component tests for the filter form and search parameter behavior. (AC-3, AC-6, AC-19)

### Slice 3: Product detail

- Add the product detail page with breadcrumbs, title, description, tags, gallery, purchase panel, details section, and related products. (AC-7, AC-10, AC-14, AC-17)
- Add the product gallery with a main image, thumbnail strip on desktop, and a swipeable image row on mobile. (AC-7, AC-17)
- Add the variant selector and purchase panel with grouped colour, size, and yarn options, a Standard option for null dimensions, disabled unavailable combinations, the reset rule for conflicting choices, first available preselection by id, live price, the stock and lead time label table, and the disabled cart button with its note. Lead time stays product level. Add component tests. (AC-8, AC-9, AC-17, AC-19)
- Add the product not found path, the `(storefront)/not-found.tsx` page, and the 404 test. (AC-9, AC-16)
- Add related products and hide the section when empty. (AC-10)
- Add product metadata, canonical, OpenGraph image, and Product JSON-LD. (AC-15)
- Add API tests for variant price, stock labels, and related products. (AC-7, AC-8, AC-10)

### Slice 4: Collections

- Add the collections index with top level categories, cover, count, description, hidden empty categories, and the empty state. (AC-11, AC-16, AC-17)
- Add the category page with PageHeader, breadcrumbs, child category cards that show only when their subtree count is above zero, a subtree product listing from `GET /api/products?category=<slug>`, sort, pagination, and the empty collection state. (AC-12, AC-16, AC-17)
- Add the category detail and product count queries, including descendant expansion through the application tree, cover selection, and integration tests. (AC-11, AC-12, AC-18)
- Add the canonical rules for collections and the single category shop view. (AC-13, AC-15)
- Add collection metadata and OpenGraph tags. (AC-15)

### Slice 5: States and accessibility

- Add storefront `loading.tsx` skeletons for home, shop, product detail, and collections. (AC-16)
- Add the storefront `error.tsx` retry boundary and the empty states with clear filters actions. (AC-5, AC-16)
- Use the `product-placeholder.webp` committed in Slice 1 in every product image path, and use `og-default.webp` wherever a page has no image. (AC-15, AC-16)
- Run the accessibility pass: fieldset and legend labels, visible focus, keyboard drawer, keyboard gallery, non colour variant labels, 44px targets, reduced motion, and result count announcements. (AC-17)
- Add component tests for the image fallback and the empty and error states where practical. (AC-16, AC-19)

### Slice 6: Full test suite and verification

- Add domain unit tests for every stock type, visibility, price composition in both currencies, related product selection, category subtree counts, and page clamping. (AC-2, AC-5, AC-7, AC-8, AC-10, AC-11, AC-14, AC-19)
- Add API integration tests for every query rule, status code, envelope, and DTO field. (AC-2, AC-3, AC-4, AC-5, AC-6, AC-13, AC-18, AC-19)
- Add Prisma repository integration tests against the seeded database, including soft deleted products, inactive products, categories with no products, and images with no primary row. (AC-2, AC-11, AC-12, AC-18, AC-19)
- Add web component tests for the filter form, sort select, pagination links, variant selector, gallery, price display, and image fallback. (AC-3, AC-4, AC-5, AC-8, AC-16, AC-17, AC-19)
- Add the Playwright catalog flow for home, shop, filter, and product detail on desktop and mobile. (AC-1, AC-2, AC-3, AC-7, AC-8, AC-19)
- Update CI with `CLOUDINARY_CLOUD_NAME` and any seed or database setup the catalog tests need. (AC-18, AC-19)
- Run `npm run typecheck`, `npm run lint`, `npm run test`, and `npx playwright test`. (AC-19)

## Consequences

### Positive

- The storefront becomes real: products, prices, variants, categories, and stock come from PostgreSQL instead of placeholder data.
- The catalog reuses the existing data model, design system, error handler, and Clean Architecture layers.
- Shared DTOs and query schemas keep the API and the web aligned.
- The URL is shareable and reload safe, and the server side API client keeps the browser away from the Express API.
- Category subtree counts and covers make the collections pages useful without a second data model.
- The 60 second revalidate keeps the pages fast without a manual publish step.

### Negative

- Reading the currency cookie makes catalog pages dynamic, so they cannot be fully static. The API fetch cache still reduces database load.
- Customers can see data up to 60 seconds old after an admin change. There is no on demand revalidation in this feature.
- The cart is not available. The add to cart button is deliberately disabled, which limits the product page to browsing.
- Reviews and ratings are not available, so cards and detail pages do not show stars.
- Search is not in scope. Customers can filter by category, type, and price only.
- There is no application level rate limiting. A public API depends on the reverse proxy or WAF for abuse protection.
- Cloudinary images depend on a real cloud name and uploaded assets. The seed public IDs will show the placeholder until the images are uploaded.
- The currency switcher is feature 7. Until then, the `cp_currency` cookie can only be set by hand or by a test.
- Product management is feature 18. The catalog is seed only until an admin can create and edit products.
- Category pages show direct children and the subtree listing. Very deep category trees still work through direct URLs, but the collections index only surfaces top level categories.
- Price filters and sorts use the stored BDT and USD values. There is no exchange rate conversion, so the two price columns must be maintained together.
- The product detail related section is intentionally limited to the direct category. Products with no category have no related pieces.

## Follow-up

- Add rate limiting at the reverse proxy or WAF for the public catalog routes, and revisit an application level limiter if abuse appears.
- Upload the seed product images to Cloudinary and replace the placeholder public IDs, or accept the local placeholder until the brand photography is ready.
- Feature 7 writes `cp_currency`, adds the visible currency control, and updates the header indicator. This feature only reads the cookie.
- Feature 8 enables the add to cart button, quantity controls, and the cart drawer.
- Feature 14 adds the digital download flow and may refine the digital stock and lead time wording.
- Feature 18 adds product and category management, including image uploads and the `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` configuration.
- Feature 24 adds reviews and ratings, then the `StarRating` display can return to cards and detail pages.
- Feature 28 adds the sitemap, robots rules, and the final SEO pass for filtered views.
- Consider an on demand revalidation hook for admin edits instead of waiting for the 60 second window.
- Consider server side API cache headers if the public traffic grows beyond the web tier.
- Revisit the category stats query when the catalog outgrows the seed set. `listCategories` expands each category subtree and the repository joins every visible product against every subtree. Cache the categories response at the API layer or maintain counts incrementally before the tables grow.
- Revisit the product detail trail when the category table grows. The trail loads every category row to build one path; a recursive CTE would remove that read. The related product read runs in parallel with the category list.
- Consider search and additional filters once the catalog grows beyond the seed set.
- Add visual regression coverage for the product card, gallery, and collection cards when the brand photography lands.
- Assert the JSON-LD that the product page emits, not only the builder. `apps/web/src/app/(storefront)/shop/[slug]/page.tsx` renders the `Product` structured data, and no test checks the rendered script, including price, availability, and currency.
- Resolve the five nits from the 2026-11-16 review (`docs/reviews/2026-11-16-feat-product-catalog-storefront.md`): theme colour token, manifest capitalisation, filter step, collections comment numbering, and custom order CTA targets.
- Cache the categories response at the API or maintain subtree counts incrementally if the category and product tables grow; the current query recomputes stats for every category on each uncached read.
- Parallelize the product detail trail and related reads, or use a recursive CTE for the category trail, if product detail latency grows.
- When the URL builders, pluralization copy, or catalog route params are next touched, consolidate the collection and shop URL builders, extract the piece count helper, and remove the redundant route param guard.
- Give the product image fallback a terminal state if both the remote image and the local placeholder fail.

## Rationale

See [rationale.md](rationale.md) for the context, the options considered, and the reasons behind the chosen design.
