# Verify: product catalog storefront · spec 0006 · updated 2026-11-10

_Steps derived from spec 0006 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [ ] Home `/` shows the hero, up to 8 featured products, a collections strip of top level categories with visible products, the promise section, and the custom order call to action. A section with no data is hidden. → AC-1, AC-16
- [ ] `/shop` lists only active, non deleted products, newest first, 12 per page. Each card shows the base price in the active currency and a Sold Out badge when unavailable. → AC-2, AC-14
- [ ] Category and type filters are multi select: OR within a dimension, AND across dimensions. The price minimum and maximum filter the active currency. The result count and grid update after Apply. → AC-3, AC-6, AC-14
- [ ] Sort offers newest, price low to high, and price high to low. Changing it applies at once, resets the page to 1, and keeps the active filters. → AC-4
- [ ] Numbered pagination keeps every active filter. A page past the last clamps to the last real page. Zero results stay on page 1 with the empty state. → AC-5, AC-16
- [ ] The web parser drops invalid values and swaps a minimum price greater than the maximum. The API returns 400 for malformed type, sort, currency, page, limit, and price values. → AC-6, AC-18
- [ ] `/shop/[slug]` shows the title, description, category, tags, gallery, base price, stock status, and lead time. → AC-7
- [ ] Variants are grouped by colour, size, and yarn. Unavailable combinations are disabled. Selecting an available variant updates the displayed price (base plus additional) and the stock status. Lead time stays fixed. The first available variant is preselected. A product with no variants shows no selector. → AC-8, AC-14
- [ ] The add to cart button is visible but disabled with the coming soon note. A missing, inactive, or soft deleted slug renders the styled not found page. → AC-9
- [ ] A product detail page shows up to 4 related visible products from the same direct category, newest first, and hides the section when there are none, including when the product has no category. → AC-10
- [ ] `/collections` lists top level categories with at least one visible product in their subtree. Each card shows name, description, cover, and subtree product count. Empty categories are hidden and an empty state renders when nothing qualifies. → AC-11
- [ ] A parent category page shows its nonempty child categories and includes descendant products. A child category page shows its own products. Breadcrumbs show the full category trail. → AC-12
- [ ] `/collections/[slug]` is the canonical category page. A `/shop` view sets its canonical to the collection only for one category, page 1, the default sort, and no other filters. Every other filtered view keeps a self canonical. → AC-13, AC-15
- [ ] With no `cp_currency` cookie all prices use BDT. Setting `cp_currency=USD` switches every price and price filter label to USD. An invalid value falls back to BDT. → AC-14
- [ ] Home, shop, collection, and product pages set a title and description. Product metadata uses `metaTitle` and `metaDescription` when present. Product and collection pages set a canonical and OpenGraph image, falling back to `/images/og-default.webp`. Product detail includes Product JSON-LD. → AC-15
- [ ] Catalog routes show skeleton loading, an empty state with a clear filters action, a retryable error state, a styled not found page, and the local placeholder when an image is missing or fails. → AC-16
- [ ] Every catalog screen meets WCAG 2.1 AA: keyboard filters, drawer, gallery, and variants; colour never the only signal; visible focus; 44px touch targets; reduced motion respected. → AC-17
- [ ] The catalog API is public and read only. `GET /api/products` returns `{ data, meta }` with page, pageSize, total, and totalPages. Product and category endpoints return DTOs. Cloudinary public IDs are resolved to delivery URLs. No internal fields appear. → AC-18
- [ ] Domain rules have unit tests, API and Prisma repository have integration tests, the filter form, variant selector, and gallery have component tests, and one Playwright flow covers desktop and mobile. → AC-19

## Commands

- [ ] `npm run typecheck` returns clean for shared, api, web, and e2e → AC-19
- [ ] `npm run lint` returns clean → AC-19
- [ ] `npm run test` passes (shared 78, api 261, web 278) → AC-19
- [ ] `npx playwright test e2e/catalog.spec.ts` passes on desktop and mobile → AC-19
- [ ] `npm run build` succeeds and `/collections` is dynamic → AC-16

## Value sourcing edges

- [ ] Set `cp_currency=USD`, then BDT, then an invalid value. Prices and price filters follow the cookie and default to BDT on invalid input. → AC-3, AC-14
- [ ] Soft delete or deactivate a product. The shop hides it and its direct slug returns the not found page. → AC-2, AC-9
- [ ] A variant with a null dimension shows a Standard option, and a dimension that is null on every variant is hidden. → AC-8
- [ ] A parent category lists descendant products, and child cards hide empty children. → AC-12
- [ ] A product with no category hides the related section. → AC-10
- [ ] A category with zero visible products is absent from collections. → AC-11

## Acceptance-criteria coverage

- AC-1 covered by home and states steps · AC-2 by shop visibility · AC-3 by filters · AC-4 by sort · AC-5 by pagination · AC-6 by URL and API validation · AC-7 by product detail · AC-8 by variant selection · AC-9 by cart note and not found · AC-10 by related products · AC-11 by collections index · AC-12 by category pages · AC-13 by canonical rules · AC-14 by currency steps and edges · AC-15 by metadata · AC-16 by states · AC-17 by accessibility · AC-18 by API and commands · AC-19 by tests and commands.
