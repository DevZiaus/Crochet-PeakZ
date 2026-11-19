# Product Catalog Storefront Rationale

## Context

The project already has the data model, the design system, customer auth, and a running Express and Next.js scaffold. The catalog is the first customer facing feature that turns the seed data into a real storefront. The scope row for feature 6 asks for a home page with featured products, a catalog listing with category, product type, and price filters, and product detail pages with variants, images, active currency pricing, stock, and lead time.

The existing data model already contains everything the catalog needs: `Product`, `ProductImage`, `ProductVariant`, and `Category`. The design system already contains `ProductCard`, `PriceDisplay`, `EmptyState`, `ErrorBoundary`, `Breadcrumbs`, `PageHeader`, `Section`, and `Container`. The auth work already established the server only environment pattern, the centralized error handler, the integration test approach, and the Playwright setup.

The main design problem is therefore not what to store. It is where to put the read rules, how the web reaches the API, how filter state is carried, and how much of the existing model to change. The answers below favor the smallest real path through the existing stack.

## Options considered

### Where the web calls the API

| Option                                                            | Tradeoff                                                                                                                      |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Browser calls Express directly                                    | Needs CORS for every storefront origin, exposes the API surface to the browser, and makes cookie currency handling harder     |
| Next.js route handler proxies Express                             | Adds a second hop and a new proxy layer for no business benefit, when the existing auth proxy already exists for auth only    |
| Next.js server components call Express through `API_INTERNAL_URL` | Keeps the API internal, uses the existing server only environment pattern, and lets the page render with data already present |

**Chosen:** server components call Express through `API_INTERNAL_URL` with a small server only client. The browser never needs the API URL.

### Filter and pagination state

| Option                                     | Tradeoff                                                                                              |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Zustand store                              | Adds a client state library for state that should survive reloads, shares, and back button navigation |
| nuqs                                       | Adds a dependency and a client side URL state layer that the project does not use yet                 |
| Plain `searchParams` and `URLSearchParams` | No new dependency, server rendered links, URL is the source of truth, easy to test                    |

**Chosen:** plain `searchParams`. The catalog is server rendered, and the URL is the correct source of truth for filters, sort, and page.

### Collections shape

| Option                                                         | Tradeoff                                                                                                  |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Shop filter links only                                         | Fewer routes, but no collection landing pages, no category descriptions, no category covers, and weak SEO |
| Dedicated `/collections` index and `/collections/[slug]` pages | More routes, but clear landing pages, breadcrumbs, covers, counts, and canonical URLs                     |
| A generic content page builder                                 | Far more scope than the category tree needs                                                               |

**Chosen:** dedicated collection pages. The existing Header already links to `/collections`, and the category tree gives the pages real structure.

### Category filtering and subtree products

| Option                                            | Tradeoff                                                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Filter only the exact category                    | Simpler query, but a parent category page would look empty even when its children have products |
| Expand the category to its descendants in the API | A little more query work, but parent pages and parent filters behave the way customers expect   |

**Chosen:** the API expands a category filter to the category and all descendants. The web does not need to know the tree shape to build a filter.

### Image URL resolution

| Option                                          | Tradeoff                                                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Store full Cloudinary URLs in the database      | Simple reads, but couples the database to one cloud and makes a future host change a data migration           |
| Resolve public IDs in the web app               | Keeps the API simple, but duplicates Cloudinary knowledge in the presentation tier and makes reuse harder     |
| Resolve public IDs in the API presentation edge | Keeps the database portable, keeps the Cloudinary rule in one place, and lets every client receive ready URLs |

**Chosen:** the API resolves public IDs. The database keeps the existing public ID convention.

### Data model changes

| Option                                       | Tradeoff                                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Add catalog specific tables                  | Duplicates product, image, variant, and category data that already exists                 |
| Add columns for computed stock and counts    | Creates data that can go stale and needs write side maintenance                           |
| Use the existing tables and add read indexes | No data duplication, no write side maintenance, and the queries get the indexes they need |

**Chosen:** no new entities. One migration adds the indexes for visibility, category, product type, featured, price, and image ordering.

### Page rendering and freshness

| Option                                     | Tradeoff                                                                            |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| Fully static pages                         | Fast, but stale until a rebuild and awkward with a currency cookie                  |
| Fully dynamic on every request             | Fresh, but every request reaches the API and the database                           |
| Dynamic pages with a 60 second fetch cache | Fresh enough for a small catalog, cheap on the database, and simple to reason about |

**Chosen:** dynamic pages with a 60 second revalidate on the catalog fetch. The cookie is read on the server, so the pages are dynamic, but the API response is cached between requests.

### Home and storefront layout

| Option                                         | Tradeoff                                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Put Header and Footer in the root layout       | Every route gets them, including admin, auth, and the design system, which already manage their own shells         |
| Add Header and Footer to every storefront page | Duplication and easy to miss a page                                                                                |
| Add a `(storefront)` route group layout        | One shell for the public storefront, no change to auth, admin, or design system routes, and the URLs stay the same |

**Chosen:** a `(storefront)` route group. The root layout keeps the document, theme, and metadata only.

### Price filtering currency

| Option                                                  | Tradeoff                                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Convert both price columns to one currency in the API   | Needs exchange rates, rounding rules, and a source of truth that the project does not have |
| Filter both columns with the same number                | Wrong results, because BDT and USD values differ by a large factor                         |
| Pass the active currency and filter the matching column | Correct results with the data the project already stores                                   |

**Chosen:** a `currency` query parameter selects the price column for filtering and sorting. The response still carries both prices.

### Validation posture

| Option                                       | Tradeoff                                                                                |
| -------------------------------------------- | --------------------------------------------------------------------------------------- |
| One forgiving parser for the API and the web | Hides malformed requests and makes API behavior hard to test                            |
| One strict parser for both                   | A stale or hand edited storefront URL would show an error page                          |
| Strict API and forgiving web                 | The API contract stays clear, and a customer with a stale link still gets a useful page |

**Chosen:** strict API, forgiving web. The web drops invalid values and swaps a reversed price range before calling the API.

### Spec shape

The decision touches the data model indexes, the shared contracts, the domain rules, the API surface, the web routes, the filter state, the SEO, the copy, and the test layers. A single file would bury the API and build plan details. The directory shape keeps the build spec in `index.md` and the reasoning in `rationale.md`, matching the earlier heavy specs.

## Rationale

The chosen design keeps the catalog inside the boundaries the project already set. PostgreSQL remains the source of truth. The API owns the read rules so the web cannot accidentally show a hidden product or compute stock differently on two pages. The web owns presentation, URL state, and accessibility. Shared DTOs and schemas sit between them.

The URL as the state container is the most important web decision. It makes every filtered view linkable, keeps the server components simple, and avoids introducing a client state library for a feature that does not need one. The sort control is the one immediate interaction, and it can update the URL without a full form submit.

The category subtree rule is what makes collections feel complete. A customer who opens Wearables should see the scarves inside it, and the count on the collection card should match what the page will show. Expanding the category in one place, the API, keeps that rule consistent.

The Cloudinary resolver at the API edge keeps the database portable and the web simple. It also gives the placeholder behavior a clear boundary: null means the web placeholder, a string means a ready image URL, and a failed load is a client concern.

The decision to make `CLOUDINARY_CLOUD_NAME` required is deliberate. The resolver depends on it, and a silent fallback would produce broken image URLs that look like missing data. The seed IDs will show the placeholder until the assets exist, but the configuration failure is honest and early.

The no new entity decision is the result of checking the existing schema. Visibility, featured state, lead time, dual prices, variants, images, and the category tree are already modeled. Adding tables or computed columns would duplicate data and create write side work that feature 6 does not need. Indexes are the only database change that earns its place.

The testing plan follows the architecture. Domain rules are pure and unit tested. The repository is tested against real PostgreSQL. The API is tested through the Express app. The interactive web pieces, filters and variant selection, are component tested. One Playwright flow proves the customer path in a real browser. This matches the existing auth testing approach and avoids mocking infrastructure where an integration test is more honest.

The main cost is the dynamic rendering caused by the currency cookie. That cost is small for a storefront at this stage, and feature 7 will make the cookie a first class control. The 60 second cache is a reasonable first setting for a small catalog, and an on demand revalidation hook can replace it when the admin feature lands.
