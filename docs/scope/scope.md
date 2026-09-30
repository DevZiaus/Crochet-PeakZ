# Scope: Crochet PeakZ

A specialized handmade crochet e-commerce platform serving both domestic (Bangladesh) and international customers. Sells physical products (standard, one of a kind, custom commissions) and digital goods (patterns, guides) with dual currency (BDT/USD), multiple payment gateways, and a custom admin panel.

**Build approach:** Tracer Bullet (prove the whole pipe works before building any part of it fully; each feature is end to end, real, and shippable).
**Workflow:** GA (after /develop, /check verify, /test, a fresh model /check review, then /document; most features need a spec). Individual features may override this with a tag.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## At a glance

| #   | Feature                            | Phase      | Status  |
| --- | ---------------------------------- | ---------- | ------- |
| 1   | Stack & architecture               | Foundation | done    |
| 2   | Coding standards & tooling         | Foundation | done    |
| 3   | Data model                         | Foundation | planned |
| 4   | Design system & UI foundation      | Foundation | planned |
| 5   | Customer auth                      | Slice 1    | planned |
| 6   | Product catalog storefront         | Slice 1    | planned |
| 7   | Currency switcher                  | Slice 1    | planned |
| 8   | Shopping cart                      | Slice 1    | planned |
| 9   | Checkout & Stripe payment          | Slice 1    | planned |
| 10  | Order confirmation & tracking      | Slice 1    | planned |
| 11  | PayPal integration                 | Slice 2    | planned |
| 12  | SSLCommerz & COD                   | Slice 2    | planned |
| 13  | Shipping engine                    | Slice 2    | planned |
| 14  | Digital product catalog & delivery | Slice 3    | planned |
| 15  | Custom commission request flow     | Slice 4    | planned |
| 16  | Admin commission review & quoting  | Slice 4    | planned |
| 17  | Admin dashboard & analytics        | Slice 5    | planned |
| 18  | Product management (admin)         | Slice 5    | planned |
| 19  | Order management (admin)           | Slice 5    | planned |
| 20  | Payment gateway & store settings   | Slice 5    | planned |
| 21  | Coupon & discount system           | Slice 5    | planned |
| 22  | Customer dashboard & order history | Slice 6    | planned |
| 23  | Address book management            | Slice 6    | planned |
| 24  | Reviews & ratings                  | Slice 6    | planned |
| 25  | Blog CMS                           | Slice 7    | planned |
| 26  | Meta Pixel & analytics tracking    | Slice 7    | planned |
| 27  | Transactional email system         | Slice 7    | planned |
| 28  | SEO                                | Slice 8    | planned |
| 29  | Cookie consent & legal pages       | Slice 8    | planned |
| 30  | Accessibility                      | Slice 8    | planned |
| 31  | Error monitoring                   | Slice 8    | planned |
| 32  | Internationalization               | Slice 8    | planned |

## Foundations

### 1. Stack & architecture

Decide the full technology stack (Next.js frontend, Express.js backend, PostgreSQL, Prisma ORM, Cloudinary, deployment targets) and scaffold a runnable project so every later slice builds on real structure. The spec reference (`docs/scope/spec-reference.md`) documents the intended stack; `/architect` validates these choices and records the decision.

**Done when:** the stack is recorded in a spec and the empty scaffold boots locally (frontend dev server + backend dev server + database connection) and passes build.

- [x] Decide the stack (spec): [0001](../specs/0001-stack-and-architecture/index.md)
- [x] Scaffold from the decision: `/develop stack & architecture`

### 2. Coding standards & tooling

Capture conventions from the real scaffolded project, then install lint, format, and pre commit enforcement.

**Done when:** root `AGENTS.md` reflects the real stack, and lint/format/pre commit run clean.

- [x] Capture conventions + tooling choices: `/audit`
- [x] Install lint, format, pre commit enforcement: `/develop coding standards & tooling`

code in `eslint.config.mjs` · `apps/*/eslint.config.mjs` · `.prettierrc` · `.husky/pre-commit`

### 3. Data model · needs a decision

Core entities every feature builds on: users, products (four types), variants, categories, orders, payments, commissions, digital assets, coupons, blog posts, store settings, addresses. The spec reference has a detailed PostgreSQL schema; `/architect` validates and refines it as a Prisma schema.

**Done when:** entities and relationships support all later slices (catalog, payments, commissions, digital delivery, admin) without breaking migrations; seed data is loadable.

- [ ] Design it (spec): `/architect data model`

### 4. Design system & UI foundation · needs a decision

Visual language, layout primitives, and base components (with Tailwind CSS, Radix UI / Shadcn UI) so the storefront and admin panel feel cohesive, accessible, and premium.

**Done when:** `design.md` covers typography, color palette, spacing, responsive breakpoints, and base components; components handle focus, keyboard navigation, and are WCAG 2.1 AA compliant.

- [ ] Design it (spec): `/architect design system & UI foundation`

## Slice 1: Core product loop

The thinnest real thread through the entire stack: a customer signs in, browses standard crochet products, views a product with variants, adds to cart, checks out with Stripe, and sees their order confirmed. Real auth, real DB, real payment, real UI.

### 5. Customer auth · needs a decision

Mandatory account creation (no guest checkout). Local email/password auth with verification, plus Google and Facebook OAuth 2.0. JWT with HttpOnly secure cookies. Role based access (CUSTOMER, ADMIN).

**Done when:** a user can register, verify email, sign in (local + Google + Facebook), and access protected routes; admin role guard works; sessions persist across page reloads.

- [ ] Design it (spec): `/architect customer auth`

### 6. Product catalog storefront · needs a decision

Home page with featured products, catalog listing with filtering (category, product type, price range), and dynamic product detail pages showing variants (color swatches, sizes, yarn types), image gallery, pricing in the active currency, stock status, and lead time indicators.

**Done when:** products render from the real database; filtering and pagination work; product detail shows variants, images, and correct pricing; empty and error states render; the URL reflects filter state.

- [ ] Design it (spec): `/architect product catalog storefront`

### 7. Currency switcher

Global header toggle between BDT (৳) and USD ($). Persisted in local storage / session cookie. All product prices display in the selected currency. Dual pricing from the database (`price_bdt`, `price_usd`).

**Done when:** switching currencies updates all displayed prices site wide; the preference persists across sessions; checkout uses the selected currency.

- [ ] Design it (spec): `/architect currency switcher`

### 8. Shopping cart · needs a decision

Persistent client side shopping cart (Zustand) with variant selection, quantity controls, currency aware subtotal, and cart drawer/page. Handles standard stock products with inventory validation.

**Done when:** a user can add/remove/update items; the cart shows correct totals in the active currency; out of stock items are rejected; cart state persists across page reloads.

- [ ] Design it (spec): `/architect shopping cart`

### 9. Checkout & Stripe payment · needs a decision · GA

Checkout wizard: address entry, shipping calculation (flat rate for now), order summary, Stripe payment (Elements / Payment Intent API). Creates an order in PENDING_PAYMENT, processes the Stripe webhook, and moves to CONFIRMED on success.

**Done when:** a customer can complete a real Stripe payment; the order record is created with correct amounts and currency; the webhook handler updates payment and order status; the customer sees a confirmation page.

- [ ] Design it (spec): `/architect checkout & Stripe payment`

### 10. Order confirmation & tracking

Confirmation page after successful payment showing order number, items, totals, and estimated delivery. Basic order status display for customers (the status stages from the spec).

**Done when:** the confirmation page renders after payment; a customer can look up their order by order number and see its current status.

- [ ] Design it (spec): `/architect order confirmation & tracking`

## Slice 2: Full payments

Thicken the payment segment: add the remaining gateways and the full shipping engine so the store works for both domestic and international customers.

### 11. PayPal integration · needs a decision · GA

PayPal Smart Buttons / v2 Checkout API for international USD payments. Webhook handler for capture events.

**Done when:** a customer can pay with PayPal; the webhook updates order and payment status correctly; PayPal is hidden for BD only orders when configured.

- [ ] Design it (spec): `/architect PayPal integration`

### 12. SSLCommerz & COD · needs a decision · GA

SSLCommerz gateway for domestic BDT payments (cards, bKash, Nagad, Rocket, internet banking). Cash on Delivery for Bangladesh addresses only. IPN verification endpoint.

**Done when:** a customer in Bangladesh can pay via SSLCommerz or select COD; the IPN handler validates and updates order status; SSLCommerz and COD are hidden for international orders.

- [ ] Design it (spec): `/architect SSLCommerz & COD`

### 13. Shipping engine · needs a decision

Flat rate domestic shipping (whole Bangladesh), country tiered international rates (Zone 1, 2, 3), weight/item multiplier support, digital goods exemption (zero shipping). All rates admin editable via store settings.

**Done when:** checkout calculates correct shipping by destination; digital only orders skip address and shipping; rates are configurable from the admin store settings.

- [ ] Design it (spec): `/architect shipping engine`

## Slice 3: Digital products

Add the digital product archetype: browsable, purchasable, instantly delivered crochet patterns and guides.

### 14. Digital product catalog & delivery · needs a decision

Digital products (PDF patterns, stitch charts, video guides) in the catalog with their own type indicator. Instant fulfillment on payment webhook: generates temporary, cryptographically signed download URLs with expiration and max download limits. Customer pattern library for re downloading.

**Done when:** digital products display in the catalog with correct type; after payment, the customer can download the file via a signed URL; download limits and expiration are enforced; a customer can re download from their pattern library.

- [ ] Design it (spec): `/architect digital product catalog & delivery`

## Slice 4: Custom commissions

Add the custom/made to order product flow: customer submits a request with reference photos and specs, admin reviews and quotes.

### 15. Custom commission request flow · needs a decision

Interactive product customizer: reference photo multi upload (PNG, JPEG, WEBP up to 10MB, stored in Cloudinary), detailed specification textarea, optional custom sizing (bust, waist, length in cm/inches). Creates a commission ticket linked to the customer account.

**Done when:** a customer can submit a custom commission request with photos, specifications, and measurements; the request is stored and visible in their account; uploads go to Cloudinary.

- [ ] Design it (spec): `/architect custom commission request flow`

### 16. Admin commission review & quoting · needs a decision

Admin view of submitted commissions: reference photos, measurements, specifications. Admin can set a custom price quote (BDT/USD) and trigger an invoice email to the customer. Customer can accept and pay.

**Done when:** admin can view all commission requests, review details, set a quote; the customer receives an email with the quote; the customer can accept and pay for the quoted commission.

- [ ] Design it (spec): `/architect admin commission review & quoting`

## Slice 5: Admin dashboard

Build the admin panel: analytics, product CRUD, order management, settings, and coupons.

### 17. Admin dashboard & analytics · needs a decision

Secure admin interface (`/admin`) with protected layout guards. Dashboard with dual currency metric cards (Total Revenue BDT/USD, Active Orders, Pending Commissions), revenue timeline charts (daily/weekly/monthly), low stock alerts, and top performing items.

**Done when:** the admin dashboard renders real time metrics from the database; charts display revenue trends; low stock alerts fire correctly; only ADMIN role users can access it.

- [ ] Design it (spec): `/architect admin dashboard & analytics`

### 18. Product management (admin) · needs a decision

Full CRUD for products: multi file image uploader with drag and drop preview (Cloudinary), variant builder (color with hex swatch, size, yarn type, stock, SKU), digital file attachment uploader, category and collection management.

**Done when:** admin can create, read, update, and delete products of all four types; images and files upload to Cloudinary; variants are manageable; categories are assignable.

- [ ] Design it (spec): `/architect product management`

### 19. Order management (admin)

Order lifecycle manager: view all orders, update status through the stages, assign courier tracking numbers and carrier names. Filterable by status, date, payment gateway.

**Done when:** admin can view and filter orders; update order status; add tracking numbers; the status change is reflected in the customer's order view.

- [ ] Design it (spec): `/architect order management`

### 20. Payment gateway & store settings

Live toggles for each payment gateway (Stripe, PayPal, SSLCommerz, COD) with enable/disable in real time without code redeployment. Shipping rate configuration. Currency exchange rate setting.

**Done when:** admin can toggle gateways on/off and the checkout immediately reflects the change; shipping rates are editable; the store_settings table drives all dynamic configuration.

- [ ] Design it (spec): `/architect payment gateway & store settings`

### 21. Coupon & discount system · needs a decision

Coupon CRUD: code, discount type (percentage vs fixed amount), currency (BDT/USD), minimum order value, expiry date, max uses. Applied at checkout with validation.

**Done when:** admin can create and manage coupons; customers can apply coupons at checkout; validation enforces min order, expiry, max uses, and currency match; discount is reflected in the order total.

- [ ] Design it (spec): `/architect coupon & discount system`

## Slice 6: Customer portal

Enrich the customer facing experience: full dashboard, address management, and product reviews.

### 22. Customer dashboard & order history

Customer portal with profile management, full order history with itemized receipts, invoice PDF download, and the digital pattern library (permanent access to purchased patterns with one click re download).

**Done when:** a customer can view their profile, see all past orders with details, download invoice PDFs, and re download purchased digital patterns.

- [ ] Design it (spec): `/architect customer dashboard & order history`

### 23. Address book management

Saved shipping and billing addresses with add, edit, delete, and set default. Used at checkout for quick address selection.

**Done when:** a customer can manage multiple addresses; set a default; select a saved address at checkout.

- [ ] Design it (spec): `/architect address book management`

### 24. Reviews & ratings · needs a decision

Star rating (1 to 5) with text review on purchased products. Display average rating on product cards and detail pages. Only verified purchasers can review.

**Done when:** a customer who bought a product can leave a star rating and text review; reviews display on the product page with average rating; only verified purchasers can submit; admin can moderate.

- [ ] Design it (spec): `/architect reviews & ratings`

## Slice 7: Content & marketing

Blog, tracking pixels, analytics, and transactional emails.

### 25. Blog CMS · needs a decision

Markdown or rich text editor for articles (yarn care guides, crochet tips, behind the scenes). SEO metadata controls (slug, meta title, meta description, featured image). Published/draft states.

**Done when:** admin can create, edit, and publish blog posts; posts render on the public storefront with SEO metadata; slugs are unique and URL friendly.

- [ ] Design it (spec): `/architect blog CMS`

### 26. Meta Pixel & analytics tracking · needs a decision

Meta Pixel (Facebook Pixel) with standard e-commerce events (PageView, ViewContent, AddToCart, InitiateCheckout, Purchase) with product ID, category, value, and currency. Plus a general product analytics integration (PostHog or similar) for measuring signups, activation, and behavior.

**Done when:** Meta Pixel fires correct events with correct data on all high intent paths; product analytics captures user flows; both work with ad blockers where possible (server side Conversions API for Meta).

- [ ] Design it (spec): `/architect Meta Pixel & analytics tracking`

### 27. Transactional email system · needs a decision

Email templates via Resend or SendGrid: welcome/account confirmation, order received/payment receipt, digital pattern download ready, handcrafting started, order shipped with tracking, custom commission quote ready.

**Done when:** each transactional event triggers the correct email; emails render correctly; links in emails work (download links, tracking links, quote acceptance links).

- [ ] Design it (spec): `/architect transactional email system`

## Slice 8: Cross cutting polish

Production hardening: SEO, legal compliance, accessibility, monitoring, and internationalization.

### 28. SEO · needs a decision

Public page metadata (title tags, meta descriptions), sitemap.xml generation, social cards (Open Graph, Twitter), structured data (JSON LD for products, breadcrumbs, organization), SSR/SSG for public pages.

**Done when:** every public page has proper title, meta description, and social cards; sitemap.xml is generated; product pages have structured data; search engines can crawl and index the store.

- [ ] Design it (spec): `/architect SEO`

### 29. Cookie consent & legal pages

Cookie consent banner (GDPR/CCPA compliant), privacy policy page, terms of service page. Consent gates analytics and tracking pixels.

**Done when:** a cookie consent banner appears for new visitors; tracking fires only after consent; privacy policy and terms pages are accessible from the footer; consent preference persists.

- [ ] Design it (spec): `/architect cookie consent & legal pages`

### 30. Accessibility · needs a decision

WCAG 2.1 AA compliance across the storefront and admin: keyboard navigation, screen reader support, focus management, color contrast, alt text, ARIA labels, skip navigation.

**Done when:** the site passes automated accessibility audits (axe/Lighthouse) at AA level; all interactive elements are keyboard accessible; forms have proper labels; images have alt text.

- [ ] Design it (spec): `/architect accessibility`

### 31. Error monitoring

Error monitoring integration (Sentry or similar) for both frontend (Next.js) and backend (Express.js). Captures unhandled exceptions, API errors, and payment failures with context.

**Done when:** errors in both frontend and backend are captured and reported; payment failures are tagged; source maps are uploaded for readable stack traces.

- [ ] Design it (spec): `/architect error monitoring`

### 32. Internationalization · needs a decision

English as the default language, Bangla (bn) as the second language, with infrastructure for adding more languages later. UI string extraction, locale routing or switcher, RTL not needed (Bangla is LTR).

**Done when:** the store can be viewed in English and Bangla; the language switcher works; all user facing strings are extracted for translation; the infrastructure supports adding new languages without code changes.

- [ ] Design it (spec): `/architect internationalization`

## Deferred

Out of scope for the current build pass, kept so the plan stays honest.

- **Pre order / OOAK product type**: specialized pre order flow with reservation slots and lead time · needs a decision
- **Wishlist**: save products for later · needs a decision
- **Social sharing**: share products on social media · needs a decision
- **Product comparison**: compare multiple products side by side · needs a decision
- **Advanced search**: full text search with filters and autocomplete · needs a decision
- **Notifications center**: in app notification feed for order updates · needs a decision
- **Admin user management**: admin CRUD for customer accounts · needs a decision
- **Refund processing**: automated refund flows through payment gateways · needs a decision · GA

## Legend

**The decision box.** Every feature carries exactly one, the sub task whose label ends with `(spec)`. Its wording varies (`Design it (spec)` normally, `Decide the stack (spec)` on Stack & architecture), so skills locate it by that `(spec)` suffix, never by an exact label. Every other box is an execution box and `/architect` never ticks one.

**Feature lifecycle**: the scope updates as a feature moves; each row is what it shows and who sets it:

| State                        | Set by                                                                                 | The feature shows                                                                                                                                                                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `planned` · needs a decision | `/scope`                                                                               | one box: `Design it (spec): /architect <feature>`                                                                                                                                                                                            |
| `in-progress` (designed)     | **`/architect` at spec capture**                                                       | `Design it` ticked; spec linked; `Build it: /develop <feature>` + **2 to 5 milestones**; the tier's closing boxes (`Verify it` Alpha+, `Test it` Beta+, `Review it` + `Document it` GA); any surfaced follow up enrolled                     |
| `in-progress` (building)     | `/develop`                                                                             | milestone sub boxes tick one by one; code pointer filled                                                                                                                                                                                     |
| `in-progress` (verified)     | `/check verify`                                                                        | `Build it` + milestones ticked; `Verify it` ticked                                                                                                                                                                                           |
| `done`                       | **you, when you decide it is** (any skill sets it when you say so); `/sync` reconciles | boxes you ran ticked, skipped ones marked skipped; the tier's last stage (`Prototype` → after `/develop`; `Alpha` → after `/check verify`; `Beta`/`GA` → after `/test`) is the suggested point to call it done; `/sync` captures conventions |

- **Next step** = the first unticked box (always a command or a tracked milestone).
- **needs a decision** = run `/architect` first; otherwise straight to `/develop` (or `/audit` for standards & tooling). The tag drops once the spec is captured.
- **Atomic build tasks live in the spec's `## Build plan`, not here**: the scope carries only the milestone rollup.
- **Status** `planned` → `in-progress` → `done`, plus `existing` (pre workflow) and `dropped` (de scoped, kept for history).
- **Approach tag** beside a heading (e.g. `· Facade`) overrides the project default for that feature; no tag = inherits it.
- **Workflow tier tag** beside a heading (e.g. `· GA`, `· Prototype`) sets that one feature's rigor above or below the project default; no tag inherits the default. It decides the feature's check boxes and each skill's next suggestion.
- **Workflow** (header line) is the project default, what runs after `/develop`: **GA** = `/check verify`, `/test`, a fresh model `/check review`, then `/document`. A feature built on an unratified decision (an `Assumed` spec) stays flagged, but that never blocks `done`.
- **Pointer line** (`spec <n> · code in <path>`): the spec link added by `/architect`, the code path by `/develop`.
