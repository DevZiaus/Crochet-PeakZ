# 0001. Stack and architecture: rationale

## Context

Crochet PeakZ is a specialized handmade crochet e-commerce platform serving both domestic (Bangladesh) and international customers. It handles four product types (standard stock with variants, one of a kind, custom commissions, and digital downloads), dual currency operations (BDT and USD), four payment gateways (Stripe, PayPal, SSLCommerz, Cash on Delivery), and complex business logic (custom commission quoting, digital delivery with signed URLs, inventory tracking per variant).

The platform must be production grade from day one: real money flows through it, customer PII is stored, and digital assets need secure delivery. A solo developer builds and operates it with no deadline, so the stack must be productive for one person while being robust enough for a real store.

The existing spec reference (`docs/scope/spec-reference.md`) documents the intended technology choices in detail. This decision validates those choices against the project's constraints and formalizes them.

Key forces shaping the stack:

1. **Solo developer**: one person builds, deploys, and operates everything. Simplicity and productivity outweigh cutting edge features.
2. **Real payments**: Stripe and PayPal (USD), SSLCommerz (BDT), and Cash on Delivery require secure, correct integrations. No room for "good enough" on money flows.
3. **Dual audience**: Bangladesh (BDT, SSLCommerz, COD, domestic shipping) and international (USD, Stripe, PayPal, tiered shipping). The codebase must handle both cleanly.
4. **Digital delivery**: crochet patterns need cryptographically signed, expiring download URLs with download limits. Cloud storage with signed URL support is mandatory.
5. **Heroku constraint**: Heroku has an ephemeral filesystem, so all user uploads and digital assets must reside in cloud storage (Cloudinary).
6. **TypeScript preference**: the developer works in TypeScript; the entire stack should be TypeScript for maximum type sharing.

## Options considered

### Option 1: Decoupled TypeScript monorepo (Next.js + Express.js + PostgreSQL) [chosen]

Next.js 15 frontend (App Router, React 19) on Vercel, Express.js backend on Heroku, PostgreSQL with Prisma ORM, npm workspaces monorepo with a shared types/schemas package. REST API between frontend and backend.

**Pros**:
- One repo, shared types, single CI pipeline. A solo developer manages one codebase.
- Next.js on Vercel is the best supported deployment path for React apps: edge SSR, automatic previews, zero config.
- Express.js is the most mature Node.js framework: huge middleware ecosystem, well documented, understood failure modes.
- PostgreSQL + Prisma gives relational integrity (products, orders, inventory need ACID) with typed queries.
- Clean separation: the frontend can be rewritten or replaced without touching the backend, and vice versa.

**Cons**:
- Two deployment targets mean two sets of env vars, two CI targets, two monitoring dashboards.
- Heroku's cheaper dynos sleep after inactivity, causing cold starts.
- REST between frontend and backend requires manual type alignment (mitigated by shared Zod schemas).
- Express.js is less performant per request than Fastify or Hono, though for this scale it is irrelevant.

### Option 2: Next.js full stack (API Routes + serverless)

Use Next.js API Routes for all backend logic, deployed entirely to Vercel. No separate Express server.

**Pros**:
- Single deployment target, single hosting bill.
- API Routes colocated with pages for simpler developer experience.
- No CORS issues (same origin).

**Cons**:
- Vercel serverless has execution time limits, cold starts, and no persistent database connections without a proxy.
- Complex backend logic (payment webhooks, background jobs, file processing) is harder in serverless.
- No persistent process for scheduled tasks (reminders, commission expiry checks).
- Vendor lock in to Vercel for the entire application.

### Option 3: NestJS backend instead of Express

Replace Express.js with NestJS for a more opinionated, decorator based backend architecture.

**Pros**:
- Built in dependency injection, module system, and validation pipes.
- More structured for large applications.

**Cons**:
- Heavier learning curve, more boilerplate for a solo developer.
- The decorator heavy style adds cognitive overhead without proportional benefit at this scale.
- Overkill for a project where Clean Architecture already provides the structure.

## Rationale

Option 1 aligns with the original spec's intended stack and the project's constraints. A solo developer building a production e-commerce store needs proven, well documented tools with large communities. Next.js + Express.js + PostgreSQL is the most common and well supported stack in the TypeScript ecosystem. Every choice has extensive documentation, active communities, and understood failure modes.

The decoupled architecture (separate frontend and backend) adds slight complexity over a full stack Next.js approach (Option 2), but it removes the serverless constraints that would complicate payment webhooks, background processing, and persistent database connections. A production store handling real payments needs a persistent backend process, not serverless functions with cold starts and execution limits.

Express.js over NestJS (Option 3) is the right call for a solo developer. NestJS's structure adds value on a team, but for one person already using Clean Architecture, the decorator heavy patterns and module system are overhead without proportional benefit.

The npm workspaces monorepo keeps the repository simple while enabling shared types. If builds slow down later, Turborepo can be added as an optimization without changing the project structure.

PostgreSQL with Prisma ORM provides the relational integrity this domain requires (products with variants and inventory, orders with items and status transitions, users with multiple addresses) with type safe queries that catch schema drift at compile time.

Cloudinary is the only practical file storage choice given Heroku's ephemeral filesystem and the need for image transformations (product thumbnails, responsive images) and signed URLs (digital pattern delivery).
