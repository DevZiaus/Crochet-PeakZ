# 0002. Data model for Crochet PeakZ

**Date**: 2026-10-02
**Status**: Accepted

## Summary

This spec defines the complete PostgreSQL data model for Crochet PeakZ: 18 entities and 9 enums covering users, products (five types), variants, categories, orders, payments, custom commissions, digital assets, coupons, reviews, blog posts, shipping zones, and store settings. The schema is designed whole so that every later feature slice (auth, catalog, checkout, admin, digital delivery, commissions) builds on a coherent foundation with stable relationships and no breaking migrations. Prisma ORM generates the migration and typed client from a single `schema.prisma` file.

## Requirements

**User stories**:

- As a developer, I want a complete and coherent data model so that every feature I build later has the tables, enums, and relationships it needs without ad hoc schema changes.
- As a developer, I want seed data so that I can develop and test features against a realistic dataset from day one.
- As a developer, I want UUID v7 primary keys so that records sort chronologically by default and are safe for distributed generation.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):

- **AC-1**: A single Prisma migration creates all 18 entities and 9 enums with the exact fields, types, constraints, defaults, and foreign key relationships described in the Feature design section below.
- **AC-2**: UUID v7 is used as the primary key for every entity, generated via a Prisma default function (`@default(uuid(7))`).
- **AC-3**: All table names use `snake_case` mapping (`@@map`) and all column names use `snake_case` mapping (`@map`), while Prisma model and field names stay `PascalCase` and `camelCase` respectively.
- **AC-4**: Soft delete is implemented via a nullable `deletedAt` timestamp on the `Product` model only; no other entity uses soft delete.
- **AC-5**: Self referencing category hierarchy works: a `Category` can have a nullable `parentId` pointing to another `Category`, with `SET NULL` on delete.
- **AC-6**: The `Order` model stores shipping and billing addresses as JSONB snapshots (not foreign keys), and the `shippingAddress` is nullable (null for digital only orders).
- **AC-7**: The `CustomCommission` model stores freeform `measurements` as nullable JSONB.
- **AC-8**: The `Review` model enforces one review per user per product via a unique compound constraint on `(userId, productId)`.
- **AC-9**: A seed script loads realistic test data: at least 2 users (1 admin, 1 customer), 3 categories (1 nested), 5 products with variants and images, 1 coupon, 1 shipping zone, and 3 store settings entries.
- **AC-10**: `npx prisma migrate dev` applies cleanly on a fresh PostgreSQL database, and `npx prisma db seed` runs without errors.
- **AC-11**: The shared `packages/shared` types and enums stay in sync with the Prisma schema: every Prisma enum has a matching Zod schema and TypeScript type exported from `packages/shared`.
- **AC-12**: The existing `StoreSettings` model is replaced (not duplicated) by the new `StoreSettings` model with a `Json` value field instead of `String`.

## Decision

**Chosen option**: Option 1: Full schema up front (single migration, all entities)

Define the complete data model in one Prisma migration so that every later feature slice finds its tables and relationships ready. The schema covers all five product types, four payment gateways, custom commissions, digital assets, coupons, reviews, blog, and shipping zones. Later features add columns or indexes via incremental migrations, not new tables.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:

### Enums

| Enum             | Values                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| UserRole         | CUSTOMER, ADMIN                                                                                              |
| ProductType      | STANDARD, ONE_OF_A_KIND, PRE_ORDER, CUSTOM, DIGITAL                                                          |
| OrderStatus      | PENDING_PAYMENT, CONFIRMED, PROCESSING, HANDCRAFTING, READY_TO_SHIP, SHIPPED, DELIVERED, CANCELLED, REFUNDED |
| PaymentStatus    | UNPAID, PAID, FAILED, REFUNDED                                                                               |
| PaymentGateway   | STRIPE, PAYPAL, SSLCOMMERZ, CASH_ON_DELIVERY                                                                 |
| CurrencyCode     | BDT, USD                                                                                                     |
| DiscountType     | PERCENTAGE, FIXED_AMOUNT                                                                                     |
| AddressType      | SHIPPING, BILLING                                                                                            |
| CommissionStatus | PENDING_REVIEW, QUOTED, ACCEPTED, IN_PRODUCTION, COMPLETED, CANCELLED                                        |

### Entities

#### User

| Field                  | Type        | Constraints                                     |
| ---------------------- | ----------- | ----------------------------------------------- |
| id                     | UUID v7     | PK                                              |
| name                   | String(255) | required                                        |
| email                  | String(255) | required, unique                                |
| passwordHash           | String(255) | nullable (null for OAuth users)                 |
| phone                  | String(50)  | nullable                                        |
| role                   | UserRole    | default CUSTOMER                                |
| authProvider           | String(50)  | default "local" ("local", "google", "facebook") |
| providerId             | String(255) | nullable                                        |
| avatarUrl              | String      | nullable                                        |
| emailVerified          | Boolean     | default false                                   |
| emailVerificationToken | String(255) | nullable                                        |
| createdAt              | DateTime    | default now()                                   |
| updatedAt              | DateTime    | auto update                                     |

#### Address

| Field         | Type        | Constraints                      |
| ------------- | ----------- | -------------------------------- |
| id            | UUID v7     | PK                               |
| userId        | UUID        | FK → User, CASCADE on delete     |
| fullName      | String(255) | required                         |
| phoneNumber   | String(50)  | required                         |
| streetAddress | String      | required                         |
| city          | String(100) | required                         |
| stateDivision | String(100) | nullable                         |
| postalCode    | String(30)  | required                         |
| country       | String(100) | required                         |
| addressType   | AddressType | default SHIPPING                 |
| label         | String(50)  | nullable (e.g. "Home", "Office") |
| isDefault     | Boolean     | default false                    |
| createdAt     | DateTime    | default now()                    |
| updatedAt     | DateTime    | auto update                      |

#### RefreshToken

| Field      | Type        | Constraints                  |
| ---------- | ----------- | ---------------------------- |
| id         | UUID v7     | PK                           |
| userId     | UUID        | FK → User, CASCADE on delete |
| tokenHash  | String(255) | required, unique             |
| expiresAt  | DateTime    | required                     |
| deviceInfo | String(255) | nullable                     |
| createdAt  | DateTime    | default now()                |

#### Category

| Field       | Type        | Constraints                                      |
| ----------- | ----------- | ------------------------------------------------ |
| id          | UUID v7     | PK                                               |
| parentId    | UUID        | nullable, self FK → Category, SET NULL on delete |
| name        | String(100) | required                                         |
| slug        | String(120) | required, unique                                 |
| description | String      | nullable                                         |
| createdAt   | DateTime    | default now()                                    |
| updatedAt   | DateTime    | auto update                                      |

#### Product

| Field           | Type          | Constraints                                 |
| --------------- | ------------- | ------------------------------------------- |
| id              | UUID v7       | PK                                          |
| categoryId      | UUID          | nullable, FK → Category, SET NULL on delete |
| title           | String(255)   | required                                    |
| slug            | String(280)   | required, unique                            |
| description     | String        | required                                    |
| productType     | ProductType   | required, default STANDARD                  |
| priceBdt        | Decimal(12,2) | required                                    |
| priceUsd        | Decimal(12,2) | required                                    |
| isActive        | Boolean       | default true                                |
| isFeatured      | Boolean       | default false                               |
| leadTimeDays    | Int           | default 0                                   |
| metaTitle       | String(255)   | nullable                                    |
| metaDescription | String        | nullable                                    |
| tags            | String[]      | default []                                  |
| deletedAt       | DateTime      | nullable (soft delete)                      |
| createdAt       | DateTime      | default now()                               |
| updatedAt       | DateTime      | auto update                                 |

#### ProductImage

| Field        | Type        | Constraints                     |
| ------------ | ----------- | ------------------------------- |
| id           | UUID v7     | PK                              |
| productId    | UUID        | FK → Product, CASCADE on delete |
| imageUrl     | String      | required (Cloudinary public ID) |
| altText      | String(255) | nullable                        |
| isPrimary    | Boolean     | default false                   |
| displayOrder | Int         | default 0                       |

#### ProductVariant

| Field              | Type          | Constraints                     |
| ------------------ | ------------- | ------------------------------- |
| id                 | UUID v7       | PK                              |
| productId          | UUID          | FK → Product, CASCADE on delete |
| sku                | String(100)   | nullable, unique                |
| colorName          | String(50)    | nullable                        |
| colorHex           | String(10)    | nullable                        |
| sizeLabel          | String(50)    | nullable                        |
| yarnType           | String(100)   | nullable                        |
| stockQuantity      | Int           | default 0                       |
| additionalPriceBdt | Decimal(12,2) | default 0.00                    |
| additionalPriceUsd | Decimal(12,2) | default 0.00                    |
| createdAt          | DateTime      | default now()                   |
| updatedAt          | DateTime      | auto update                     |

#### DigitalAsset

| Field         | Type        | Constraints                       |
| ------------- | ----------- | --------------------------------- |
| id            | UUID v7     | PK                                |
| productId     | UUID        | FK → Product, CASCADE on delete   |
| fileName      | String(255) | required                          |
| fileKey       | String      | required (Cloudinary private URI) |
| fileSizeBytes | BigInt      | required                          |
| fileType      | String(50)  | default "application/pdf"         |
| createdAt     | DateTime    | default now()                     |

#### CustomCommission

| Field          | Type             | Constraints                                |
| -------------- | ---------------- | ------------------------------------------ |
| id             | UUID v7          | PK                                         |
| userId         | UUID             | FK → User, SET NULL on delete              |
| productId      | UUID             | nullable, FK → Product, SET NULL on delete |
| specifications | String           | required                                   |
| measurements   | Json             | nullable (freeform JSONB)                  |
| status         | CommissionStatus | default PENDING_REVIEW                     |
| quotedPriceBdt | Decimal(12,2)    | nullable                                   |
| quotedPriceUsd | Decimal(12,2)    | nullable                                   |
| adminNotes     | String           | nullable                                   |
| createdAt      | DateTime         | default now()                              |
| updatedAt      | DateTime         | auto update                                |

#### CommissionImage

| Field        | Type    | Constraints                              |
| ------------ | ------- | ---------------------------------------- |
| id           | UUID v7 | PK                                       |
| commissionId | UUID    | FK → CustomCommission, CASCADE on delete |
| imageUrl     | String  | required (Cloudinary public ID)          |
| displayOrder | Int     | default 0                                |

#### Coupon

| Field         | Type          | Constraints                                               |
| ------------- | ------------- | --------------------------------------------------------- |
| id            | UUID v7       | PK                                                        |
| code          | String(50)    | required, unique                                          |
| discountType  | DiscountType  | required                                                  |
| discountValue | Decimal(10,2) | required                                                  |
| currency      | CurrencyCode  | nullable (null for percentage; required for FIXED_AMOUNT) |
| minOrderValue | Decimal(12,2) | default 0.00                                              |
| maxUses       | Int           | nullable                                                  |
| usedCount     | Int           | default 0                                                 |
| expiresAt     | DateTime      | nullable                                                  |
| isActive      | Boolean       | default true                                              |
| createdAt     | DateTime      | default now()                                             |
| updatedAt     | DateTime      | auto update                                               |

#### Order

| Field           | Type           | Constraints                                      |
| --------------- | -------------- | ------------------------------------------------ |
| id              | UUID v7        | PK                                               |
| orderNumber     | String(50)     | required, unique (format: CP-YYMMDD-XXXX)        |
| userId          | UUID           | FK → User, RESTRICT on delete                    |
| couponId        | UUID           | nullable, FK → Coupon, SET NULL on delete        |
| currency        | CurrencyCode   | required                                         |
| subtotalAmount  | Decimal(12,2)  | required                                         |
| shippingAmount  | Decimal(12,2)  | required                                         |
| discountAmount  | Decimal(12,2)  | default 0.00                                     |
| totalAmount     | Decimal(12,2)  | required                                         |
| orderStatus     | OrderStatus    | default PENDING_PAYMENT                          |
| paymentStatus   | PaymentStatus  | default UNPAID                                   |
| paymentGateway  | PaymentGateway | required                                         |
| transactionId   | String(255)    | nullable                                         |
| shippingAddress | Json           | nullable (JSONB snapshot, null for digital only) |
| billingAddress  | Json           | nullable (JSONB snapshot)                        |
| digitalOnly     | Boolean        | default false                                    |
| trackingNumber  | String(100)    | nullable                                         |
| courierName     | String(100)    | nullable                                         |
| notes           | String         | nullable                                         |
| createdAt       | DateTime       | default now()                                    |
| updatedAt       | DateTime       | auto update                                      |

#### OrderItem

| Field              | Type          | Constraints                                       |
| ------------------ | ------------- | ------------------------------------------------- |
| id                 | UUID v7       | PK                                                |
| orderId            | UUID          | FK → Order, CASCADE on delete                     |
| productId          | UUID          | FK → Product, RESTRICT on delete                  |
| variantId          | UUID          | nullable, FK → ProductVariant, SET NULL on delete |
| productTitle       | String(255)   | required (snapshot)                               |
| variantDescription | String(255)   | nullable (snapshot)                               |
| unitPrice          | Decimal(12,2) | required                                          |
| quantity           | Int           | required                                          |
| totalPrice         | Decimal(12,2) | required                                          |
| isDigital          | Boolean       | default false                                     |

#### DigitalDownload

| Field         | Type     | Constraints                          |
| ------------- | -------- | ------------------------------------ |
| id            | UUID v7  | PK                                   |
| orderId       | UUID     | FK → Order, CASCADE on delete        |
| assetId       | UUID     | FK → DigitalAsset, CASCADE on delete |
| userId        | UUID     | FK → User, CASCADE on delete         |
| downloadCount | Int      | default 0                            |
| maxDownloads  | Int      | default 10                           |
| expiresAt     | DateTime | nullable                             |
| createdAt     | DateTime | default now()                        |

#### Review

| Field      | Type     | Constraints                            |
| ---------- | -------- | -------------------------------------- |
| id         | UUID v7  | PK                                     |
| userId     | UUID     | FK → User, CASCADE on delete           |
| productId  | UUID     | FK → Product, CASCADE on delete        |
| orderId    | UUID     | FK → Order, SET NULL on delete         |
| rating     | Int      | required (1 to 5)                      |
| text       | String   | nullable                               |
| isVerified | Boolean  | default false (true when order exists) |
| isApproved | Boolean  | default false (admin moderation)       |
| createdAt  | DateTime | default now()                          |
| updatedAt  | DateTime | auto update                            |

**Unique compound constraint**: `(userId, productId)`, one review per user per product.

#### BlogPost

| Field           | Type        | Constraints                     |
| --------------- | ----------- | ------------------------------- |
| id              | UUID v7     | PK                              |
| authorId        | UUID        | FK → User, SET NULL on delete   |
| title           | String(255) | required                        |
| slug            | String(280) | required, unique                |
| content         | String      | required                        |
| featuredImage   | String      | nullable (Cloudinary public ID) |
| metaTitle       | String(255) | nullable                        |
| metaDescription | String      | nullable                        |
| isPublished     | Boolean     | default false                   |
| publishedAt     | DateTime    | nullable                        |
| createdAt       | DateTime    | default now()                   |
| updatedAt       | DateTime    | auto update                     |

#### StoreSettings (replaces existing minimal model)

| Field       | Type        | Constraints            |
| ----------- | ----------- | ---------------------- |
| id          | UUID v7     | PK                     |
| key         | String(100) | required, unique       |
| value       | Json        | required (typed JSONB) |
| description | String      | nullable               |
| createdAt   | DateTime    | default now()          |
| updatedAt   | DateTime    | auto update            |

#### ShippingZone

| Field          | Type          | Constraints                                         |
| -------------- | ------------- | --------------------------------------------------- |
| id             | UUID v7       | PK                                                  |
| name           | String(100)   | required (e.g. "Domestic BD", "Zone 1: USA/Canada") |
| countries      | String[]      | required (ISO country codes)                        |
| baseRateBdt    | Decimal(12,2) | default 0.00                                        |
| baseRateUsd    | Decimal(12,2) | default 0.00                                        |
| perItemRateBdt | Decimal(12,2) | default 0.00                                        |
| perItemRateUsd | Decimal(12,2) | default 0.00                                        |
| isActive       | Boolean       | default true                                        |
| createdAt      | DateTime      | default now()                                       |
| updatedAt      | DateTime      | auto update                                         |

### Relationships

| From             | To               | Cardinality | FK / Notes                                   |
| ---------------- | ---------------- | ----------- | -------------------------------------------- |
| User             | Address          | 1:N         | address.userId → user.id                     |
| User             | RefreshToken     | 1:N         | refreshToken.userId → user.id                |
| User             | Order            | 1:N         | order.userId → user.id                       |
| User             | CustomCommission | 1:N         | commission.userId → user.id                  |
| User             | Review           | 1:N         | review.userId → user.id                      |
| User             | BlogPost         | 1:N         | blogPost.authorId → user.id                  |
| User             | DigitalDownload  | 1:N         | digitalDownload.userId → user.id             |
| Category         | Category (self)  | 1:N         | category.parentId → category.id              |
| Category         | Product          | 1:N         | product.categoryId → category.id             |
| Product          | ProductImage     | 1:N         | productImage.productId → product.id          |
| Product          | ProductVariant   | 1:N         | productVariant.productId → product.id        |
| Product          | DigitalAsset     | 1:N         | digitalAsset.productId → product.id          |
| Product          | CustomCommission | 1:N         | commission.productId → product.id            |
| Product          | Review           | 1:N         | review.productId → product.id                |
| Product          | OrderItem        | 1:N         | orderItem.productId → product.id             |
| CustomCommission | CommissionImage  | 1:N         | commissionImage.commissionId → commission.id |
| Coupon           | Order            | 1:N         | order.couponId → coupon.id                   |
| Order            | OrderItem        | 1:N         | orderItem.orderId → order.id                 |
| Order            | DigitalDownload  | 1:N         | digitalDownload.orderId → order.id           |
| Order            | Review           | 1:N         | review.orderId → order.id                    |
| ProductVariant   | OrderItem        | 1:N         | orderItem.variantId → variant.id             |
| DigitalAsset     | DigitalDownload  | 1:N         | digitalDownload.assetId → asset.id           |

**State transitions** (OrderStatus):

```
PENDING_PAYMENT → CONFIRMED → PROCESSING → HANDCRAFTING → READY_TO_SHIP → SHIPPED → DELIVERED
                                                                                    ↘ CANCELLED
PENDING_PAYMENT → CANCELLED
CONFIRMED → CANCELLED
Any paid state → REFUNDED (requires admin action)
```

Note: HANDCRAFTING is optional (used for custom and made to order items, skipped for standard fulfillment).

**State transitions** (CommissionStatus):

```
PENDING_REVIEW → QUOTED → ACCEPTED → IN_PRODUCTION → COMPLETED
PENDING_REVIEW → CANCELLED
QUOTED → CANCELLED
ACCEPTED → CANCELLED
```

**API surface**:

The data model has no direct API surface. The interface is Prisma CLI commands:

| Command                  | Purpose                      | Auth       | Key errors                                              |
| ------------------------ | ---------------------------- | ---------- | ------------------------------------------------------- |
| `npx prisma migrate dev` | Apply schema to local dev DB | local only | Connection refused (DB not running), migration conflict |
| `npx prisma db seed`     | Load seed data               | local only | Duplicate key (seed already ran), FK violation          |
| `npx prisma generate`    | Regenerate typed client      | local only | Schema syntax error                                     |

**Value sourcing**:

| Action             | Value produced / displayed             | Source                                                                                                                    |
| ------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Migration          | All table DDL                          | `schema.prisma` entities and enums                                                                                        |
| Migration          | FK constraints, indexes                | `schema.prisma` relation annotations                                                                                      |
| Migration          | `snake_case` table/column names        | `@@map` / `@map` directives                                                                                               |
| Seed: admin user   | `passwordHash`                         | bcryptjs hash of a hardcoded dev password                                                                                 |
| Seed: products     | `slug`                                 | Derived from `title` via slugify                                                                                          |
| Seed: products     | `priceBdt`, `priceUsd`                 | Hardcoded realistic test values                                                                                           |
| Seed: order number | `orderNumber` format `CP-YYMMDD-XXXX`  | Derived from date + sequence counter (spec 0002 defines the format; the generation logic belongs to the checkout feature) |
| Shared types       | Zod schemas and TS types for each enum | Manually mirrored from Prisma enum values                                                                                 |

**Key invariants**:

- Every entity uses UUID v7 as its primary key, never `cuid()` or `autoincrement()`.
- The `StoreSettings.value` field is `Json` (typed JSONB), replacing the old `String` type.
- `Order.totalAmount` equals `subtotalAmount + shippingAmount - discountAmount` (enforced at application layer, not DB constraint; the checkout feature will own this logic).
- `Review` has a unique compound constraint on `(userId, productId)`: one review per user per product.
- `Product.deletedAt` is the only soft delete mechanism; all other entities use hard delete (with appropriate FK cascades or restrictions).
- `Coupon.currency` must be non null when `discountType` is `FIXED_AMOUNT` (enforced at application layer).
- `OrderItem.totalPrice` equals `unitPrice * quantity` (enforced at application layer).
- `Order.shippingAddress` is null when `digitalOnly` is true (enforced at application layer).

**Security model**:

The data model itself has no runtime security surface. Row level access control is the responsibility of each feature's application layer (auth, catalog, admin). The schema enables these later controls:

- `User.role` (UserRole enum) supports `CUSTOMER` and `ADMIN` role based access.
- `User.passwordHash` stores bcrypt hashes, never plaintext passwords.
- `RefreshToken.tokenHash` stores hashed tokens, never raw JWT refresh tokens.
- `Order.userId` and `Review.userId` enable ownership based access control in application code.
- `DigitalAsset.fileKey` stores Cloudinary private URIs; access is controlled via signed URLs generated at runtime (the digital delivery feature will own this).

**Configuration required**:

- `DATABASE_URL`: PostgreSQL connection string (already exists in the project, used by Prisma).

No new environment variables are introduced by this spec. The seed script uses hardcoded dev data.

**Critical test scenarios** (each maps to an acceptance criterion in ## Requirements):

- Happy path: `npx prisma migrate dev` creates all 18 tables and 9 enums on a fresh database, then `npx prisma db seed` loads test data without errors, verifies **AC-1**, **AC-9**, **AC-10**
- Schema correctness: the generated Prisma client exposes typed relations matching the documented FK relationships (e.g. `user.orders`, `product.variants`, `category.children`), verifies **AC-1**, **AC-5**
- Soft delete: a product with `deletedAt` set to a timestamp is excluded from "active products" queries but remains accessible via direct ID lookup and in existing order items, verifies **AC-4**
- Review uniqueness: inserting a second review for the same `(userId, productId)` pair throws a unique constraint violation, verifies **AC-8**
- StoreSettings migration: the old `StoreSettings` model (String value) is replaced by the new one (Json value) without data loss in the migration, verifies **AC-12**

## Build plan

Build approach: Tracer Bullet. The data model is a foundation, not a user facing feature, so the "thin end to end thread" is: schema → migration → seed → shared types.

1. [x] Write the full `schema.prisma` with all 18 models, 9 enums, `@@map`/`@map` directives, UUID v7 defaults, and all relationship annotations (replaces the existing minimal `StoreSettings` model), satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-12**
2. [x] Run `npx prisma migrate dev --name init-data-model` to generate and apply the migration on a local PostgreSQL database, verifying it applies cleanly, satisfies **AC-10**
3. [x] Write the seed script (`apps/api/prisma/seed.ts`) with realistic test data (2 users, 3 categories, 5 products with variants/images, 1 coupon, 1 shipping zone, 3 store settings), configure the seed command in `apps/api/prisma.config.ts`, and run `npx prisma db seed`, satisfies **AC-9**, **AC-10**
4. [x] Update `packages/shared/src/types/` and `packages/shared/src/constants/` to export Zod schemas and TypeScript types for all 9 enums, keeping them in sync with the Prisma schema, satisfies **AC-11**
5. [x] Migrate Prisma CLI config to `apps/api/prisma.config.ts` (Prisma 7 deprecation fix)
6. [x] Use the `prisma/config` entry point for `defineConfig`; no separate `@prisma/config` dependency is needed

## Consequences

**Positive**:

- Every feature from Slice 1 onward finds its tables, FKs, and enums ready. No ad hoc schema patches.
- UUID v7 keys sort chronologically, support distributed generation, and avoid predictable sequential IDs.
- JSONB address snapshots on orders mean historical orders remain accurate even when a user edits or deletes their address book entries.
- A single soft delete column (`Product.deletedAt`) keeps product data in order history while hiding it from the storefront, without polluting every query across unrelated entities.

**Negative / tradeoffs**:

- A large up front migration means all 18 tables exist before most features use them. Empty tables carry no runtime cost, but unused tables may cause confusion during early development.
- Dual currency columns (`priceBdt`, `priceUsd`) on products, variants, shipping zones, and commissions mean every price change requires updating two fields. This trades data normalization for query simplicity (no runtime currency conversion for stored products).
- JSONB fields (`shippingAddress`, `billingAddress`, `measurements`, `StoreSettings.value`) lose type safety at the database layer. Application layer Zod validation is required to enforce structure.

**Neutral**:

- The `OrderStatus` enum includes `HANDCRAFTING`, which is only used for custom commissions and one of a kind items. Standard orders skip this state. The application layer must handle the optional step.
- The `tags` array on `Product` uses PostgreSQL array type, which Prisma supports natively. Full text search across tags requires a later migration to add a GIN index (deferred to the search feature).

## Follow-up

- [x] Verify that Prisma supports `@default(uuid(7))` in the installed Prisma version; the local migration applies cleanly ✓
- [ ] The `orderNumber` format (`CP-YYMMDD-XXXX`) defines the human readable pattern but the generation logic (sequence counter, concurrency safety) belongs to the checkout feature spec (Feature #9)
- [ ] Application layer validation for `Coupon.currency` (required when `discountType` is `FIXED_AMOUNT`) and `Order.shippingAddress` (null when `digitalOnly` is true) must be implemented in the relevant feature specs, not in the data model
- [ ] A GIN index on `Product.tags` should be added when the search feature (Feature #29 or a dedicated search feature) is designed
