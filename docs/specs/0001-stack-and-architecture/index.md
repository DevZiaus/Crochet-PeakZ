# 0001. Stack and architecture for Crochet PeakZ

**Date**: 2026-09-09
**Status**: Accepted

## Summary

Crochet PeakZ will be built as a decoupled monorepo with a Next.js 15 frontend and an Express.js backend, both in TypeScript, backed by PostgreSQL 16 with Prisma ORM. The repo uses npm workspaces with three packages: `apps/web`, `apps/api`, and `packages/shared`. The frontend deploys to Vercel, the backend and database to Heroku. This stack gives a solo developer one repo, shared types, and two proven hosting platforms.

## Decision

**Chosen option**: Option 1: Decoupled TypeScript monorepo (Next.js + Express.js + PostgreSQL)

The project uses a decoupled architecture with a Next.js 15 (App Router, React 19) frontend and an Express.js backend, connected by a REST API, in a single npm workspaces monorepo. PostgreSQL 16 with Prisma ORM provides the persistence layer. Authentication is self hosted (JWT with HttpOnly cookies, Passport.js for Google and Facebook OAuth 2.0, bcryptjs for password hashing). Cloudinary handles all file storage. Resend provides transactional email. Payments integrate directly with each provider's SDK (Stripe, PayPal, SSLCommerz, plus Cash on Delivery logic).

## Proposed stack

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript (strict mode) | Type safety across frontend and backend; shared validation schemas via Zod in `packages/shared` |
| Node.js version | Node.js 22 LTS | Latest LTS with modern features; the project starts fresh and benefits from the newest runtime |
| Frontend framework | Next.js 15 (App Router, React 19) | Server Components for performance, App Router for modern patterns, Vercel optimized deployment |
| Backend framework | Express.js (TypeScript) | Mature, huge middleware ecosystem, straightforward REST APIs; well supported on Heroku |
| Primary DB | PostgreSQL 16 (Prisma ORM) | Relational data with ACID guarantees; Prisma gives typed queries, migrations, and seeds; Heroku Postgres add on |
| Auth | JWT (HttpOnly cookies) + Passport.js (OAuth 2.0) + bcryptjs | Full control, no vendor lock in; supports local email/password plus Google and Facebook sign in |
| File storage | Cloudinary | Purpose built for images and media; on the fly transformations, signed URLs for private digital assets |
| Email | Resend | Developer friendly API, React Email for templating, modern TypeScript SDK |
| Payments (international) | Stripe SDK + PayPal SDK | Official SDKs, proven for USD international payments; Stripe Elements for card UI, PayPal Smart Buttons |
| Payments (domestic) | SSLCommerz API + Cash on Delivery | SSLCommerz covers Bangladesh payment methods (bKash, Nagad, cards); COD for domestic orders |
| State management | Zustand | Minimal, hook based, tiny bundle; handles cart, currency toggle, and UI state |
| Styling | Tailwind CSS v4 + Shadcn UI (Radix UI) | Utility first CSS with accessible component primitives; Shadcn installs into your codebase |
| Icons | Lucide React | Tree shakable, consistent design, well maintained |
| Forms + validation | React Hook Form + Zod | Performant form state, shared schemas between frontend and backend in `packages/shared` |
| i18n | next-intl | Purpose built for Next.js App Router; ICU message format, type safe translations; English + Bangla |
| Product analytics | Google Analytics 4 | Free, widely used, sufficient for measuring signups and behavior alongside Meta Pixel |
| Error monitoring | Sentry | Industry standard; Next.js and Express integrations, source map upload, free tier for small projects |
| API architecture | REST (Express Router) | Traditional REST endpoints matching the spec's API design; clear URL structure, easy to document |
| Monorepo tooling | npm workspaces | Built in, no extra tooling; `apps/web`, `apps/api`, `packages/shared` |
| Frontend hosting | Vercel | Optimized for Next.js; edge SSR, automatic previews, zero config |
| Backend hosting | Heroku (with Postgres add on) | Managed Node.js hosting with integrated PostgreSQL; simple deployment |
| Backend dev server | ts-node-dev | Fast TypeScript reloading for Express development |
| CORS | cors middleware + environment based origin whitelist | Standard approach for cross origin requests between Vercel and Heroku domains |
| Password hashing | bcryptjs | Pure JS implementation (no native compile issues on Heroku); constant time comparison |

### Workspace structure

```
crochet-peakz/
├── apps/
│   ├── web/                    # Next.js 15 frontend
│   │   ├── src/
│   │   │   ├── app/            # App Router pages and layouts
│   │   │   ├── components/     # React components (Shadcn UI + custom)
│   │   │   ├── lib/            # Client utilities, stores (Zustand)
│   │   │   └── styles/         # Tailwind config, global styles
│   │   ├── public/             # Static assets
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── api/                    # Express.js backend
│       ├── src/
│       │   ├── domain/         # Entities, value objects (Clean Architecture)
│       │   ├── application/    # Use cases, interfaces
│       │   ├── infrastructure/ # DB (Prisma), APIs, external services
│       │   ├── presentation/   # Controllers, routes, middleware
│       │   └── index.ts        # Server entry point
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── migrations/
│       │   └── seed.ts
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   └── shared/                 # Shared types, Zod schemas, constants
│       ├── src/
│       │   ├── types/          # Shared TypeScript types/interfaces
│       │   ├── schemas/        # Zod validation schemas
│       │   └── constants/      # Shared constants (currencies, statuses)
│       ├── tsconfig.json
│       └── package.json
├── package.json                # Root: npm workspaces config
├── tsconfig.base.json          # Base TypeScript config extended by each package
├── AGENTS.md
└── docs/
    ├── scope/
    └── specs/
```

### Clean Architecture layers (backend)

The backend follows Clean Architecture with four layers, dependency flowing inward:

- **Domain** (`src/domain/`): entities (e.g. `Product`, `Order`, `User`), value objects, business rules. Zero external imports. No Prisma, no Express, no framework code.
- **Application** (`src/application/`): use cases (e.g. `CreateOrderUseCase`, `ProcessPaymentUseCase`). Thin orchestrators that call domain logic and infrastructure interfaces. Define interfaces that infrastructure implements.
- **Infrastructure** (`src/infrastructure/`): Prisma repositories, Cloudinary service, Stripe/PayPal/SSLCommerz clients, Resend email service, Passport.js auth strategies. Implements interfaces from the application layer.
- **Presentation** (`src/presentation/`): Express controllers, routes, middleware (auth guards, error handler, validation). Calls use cases, returns HTTP responses. Uses DTOs, never exposes domain entities.

### Environment variables (initial set)

```bash
# Backend (apps/api/.env)
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
RESEND_API_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
SSLCOMMERZ_STORE_ID=...
SSLCOMMERZ_STORE_PASSWORD=...
SENTRY_DSN=...
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development

# Frontend (apps/web/.env.local)
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_PAYPAL_CLIENT_ID=...
NEXT_PUBLIC_GA_MEASUREMENT_ID=...
NEXT_PUBLIC_META_PIXEL_ID=...
NEXT_PUBLIC_SENTRY_DSN=...
```

## Consequences

**Positive**:
- One repo with shared types eliminates frontend/backend type drift, a common source of bugs in decoupled architectures.
- Vercel and Heroku are both zero ops for a solo developer: push to deploy, managed SSL, automatic scaling.
- Every tool chosen is proven at scale with large communities and documentation; nothing experimental.
- Clean Architecture in the backend keeps business logic testable without mocking infrastructure.
- Prisma ORM gives type safe database access and handles migrations, reducing the chance of schema drift.

**Negative / tradeoffs**:
- Two deployment targets (Vercel + Heroku) mean two sets of env vars, two CI targets, and two monitoring dashboards.
- Heroku's Eco/Basic dynos sleep after inactivity, causing cold start delays for the first API request; the Standard plan avoids this but costs more.
- npm workspaces is simpler than pnpm or Turborepo but lacks build caching and strict dependency resolution; if builds slow down later, Turborepo can be added.
- SSLCommerz has no official Node.js SDK; the integration uses their REST API directly, which requires more manual work than Stripe or PayPal.
- Cloudinary's free tier has upload and transformation limits that a high traffic store may outgrow.

**Neutral**:
- Google Analytics 4 is free but heavier and has privacy concerns; a privacy friendly alternative (PostHog, Plausible) can replace it later without architectural changes.
- The monorepo adds slight complexity for initial setup (workspace config, shared package linking) but pays off quickly in shared types and single PR workflow.

## Follow-up

- [ ] Agent Skills for this stack (Next.js, Prisma, Stripe, Cloudinary, Tailwind, Shadcn UI) cannot be searched until Node.js and npm are installed. Run a skill search after scaffold.
- [ ] Heroku dyno plan decision: Eco/Basic (cheap, sleeps) vs Standard (always on). Decide based on expected traffic before launch.
- [ ] Cloudinary plan: verify the free tier limits against expected product media volume.
- [ ] SSLCommerz integration: no official SDK. Plan for manual REST API integration with IPN verification.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
