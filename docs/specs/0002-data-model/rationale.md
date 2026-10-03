# Data model rationale

## Context

Crochet PeakZ is an e-commerce platform selling handmade crochet products in five flavors (standard, one of a kind, pre order, custom commission, and digital patterns) to both domestic Bangladesh and international customers. The platform operates in dual currency (BDT and USD) with four payment gateways (Stripe, PayPal, SSLCommerz, and Cash on Delivery).

The stack decision (spec 0001) chose PostgreSQL 16 with Prisma ORM. The scaffold shipped a minimal `StoreSettings` model to prove the database connection. Every feature on the roadmap (32 items across 8 slices) needs a data model: auth needs users and refresh tokens, catalog needs products and categories, checkout needs orders and payments, and so on. Building each feature's tables independently risks FK conflicts, naming inconsistencies, and breaking migrations when later features discover missing relationships.

The question is whether to define the full schema now (Foundation phase) or grow it incrementally as each feature lands.

## Options considered

### Option 1: Full schema up front (single migration)

Define all 18 entities and 9 enums in one Prisma schema file and apply a single migration. Later features add columns or indexes via incremental migrations but never new tables (barring genuinely unforeseen requirements).

**Pros**:

- Relationships are coherent from day one; no circular dependency surprises across features.
- Foreign keys, cascades, and constraints are designed together, preventing the "orphaned FK" problem.
- Seed data exercises the whole model, catching constraint issues early.

**Cons**:

- Unused tables exist before their features are built, which may confuse developers new to the codebase.
- A mistake in the initial schema affects many tables; the first migration is large and harder to review.

### Option 2: Incremental schema per feature slice

Each feature slice (auth, catalog, checkout, etc.) defines its own tables in a separate migration. The schema grows as features land.

**Pros**:

- Each migration is small, focused, and easy to review.
- No unused tables until the feature needs them.

**Cons**:

- Cross feature relationships (e.g. orders referencing products, reviews referencing orders) require careful sequencing and may force migration rewrites.
- Naming inconsistencies accumulate across independently authored migrations.
- Seed data must be updated on every migration, and each migration must handle FK dependencies from prior migrations.

### Option 3: Hybrid (core entities now, peripheral later)

Define the "core" entities now (users, products, categories, orders) and defer "peripheral" entities (reviews, blog, coupons, commissions) to their feature slices.

**Pros**:

- Smaller initial migration than Option 1 while covering the most critical relationships.
- Peripheral entities land with their features, keeping context close.

**Cons**:

- The line between "core" and "peripheral" is arbitrary. Coupons affect orders, commissions affect users and products, reviews affect products. These are not truly peripheral.
- Still requires coordinating FK relationships for deferred entities, losing most of Option 2's simplicity benefit without gaining Option 1's coherence.

## Rationale

Option 1 (full schema up front) is the right choice because the entities are tightly interconnected. Orders reference products, variants, coupons, and users. Reviews reference products, users, and orders. Digital downloads reference orders, users, and assets. Commissions reference users and products. Trying to add these relationships incrementally introduces sequencing constraints on which features can be built in which order, and risks breaking existing FKs when a new table introduces a constraint not anticipated by the original migration.

The "unused tables" downside is real but low cost: empty PostgreSQL tables consume no runtime resources, and the seed data populates them immediately for development. The large migration is a one time review cost, mitigated by the spec documenting every field's purpose and constraint.

Option 3 (hybrid) was considered but rejected because the boundary between "core" and "peripheral" is not clean for this domain. Coupons affect order totals, reviews are tied to verified purchases, and commissions are a first class product type. A partial schema would still require most of the relationship design work, just spread across more migration files.

Key design decisions and their reasoning:

**UUID v7 over `cuid()` or `autoincrement()`**: UUID v7 encodes a timestamp prefix, giving chronological sort without a sequence. This removes the need for coordinating sequences across distributed systems (relevant for Heroku's managed PostgreSQL). The existing `StoreSettings` model used `cuid()`, which will be replaced.

**Dual currency columns over a junction table or runtime conversion**: storing `priceBdt` and `priceUsd` side by side on products and variants is denormalized, but the store owner manually sets prices in both currencies (they are not derived from an exchange rate). A junction table would add query complexity for the most common operation (displaying a product) without benefit, since the relationship is always exactly 1:1 with two known currencies.

**JSONB address snapshots on orders over FK to the address book**: when a user edits or deletes an address, the order's address must not change. Snapshotting at checkout guarantees this. The FK approach would require either immutable address rows (creating duplicates) or versioning (adding complexity).

**Soft delete on Products only**: the scope requires that deleted products remain visible in order history. Products are the only entity where this applies: orders use `RESTRICT` on delete (an order with items cannot be deleted), and all other entities either cascade or are not referenced by historical records.

## References

**Project sources**:

- `AGENTS.md`: Clean Architecture layers, strict TypeScript, Prisma ORM, PostgreSQL
- Spec 0001 (Stack and architecture): chose PostgreSQL 16, Prisma ORM, UUID primary keys, `snake_case` DB naming
- `docs/scope/spec-reference.md`: the original detailed schema description that seeded this design
- `packages/shared/src/constants/index.ts`: existing `OrderStatus` and `CurrencyCode` enums in shared types

**Practices and standards**:

- UUID v7 (RFC 9562): timestamp prefixed UUIDs for chronological sorting and distributed generation
- JSONB snapshots for order addresses: standard e-commerce pattern to preserve historical order data
- Single soft delete column (`deletedAt`) over global soft delete: limits query pollution to the one entity that needs it
