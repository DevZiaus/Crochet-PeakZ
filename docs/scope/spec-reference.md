# Project Technical Scope & Specification Document: Crochet PeakZ

**Document Version:** 1.0.0  
**Client / Brand:** Crochet PeakZ  
**Official Page:** [facebook.com/crochet.peakz](https://www.facebook.com/crochet.peakz)  
**Architecture:** Decoupled Full-Stack Web Application (Next.js Frontend + Express.js/PostgreSQL Backend)

---

## 1. Executive Summary & System Vision

Crochet PeakZ is a specialized fashion and lifestyle e-commerce platform dedicated to handmade crochet craftsmanship. The platform must cater to both physical product transactions (one-of-a-kind pieces, customizable made-to-order items, standard inventory with variants) and digital transactions (crochet patterns, schematics, and instructional guides).

The system bridges domestic (Bangladesh) and international audiences by implementing dual-currency operations (BDT & USD), country-specific shipping engines, and dynamic payment gateway routing (SSLCommerz, Cash on Delivery, Stripe, and PayPal).

---

## 2. Architecture & Technology Stack

### 2.1 Frontend Architecture

- **Framework:** Next.js (App Router, React 19 / 18, TypeScript)
- **Styling:** Tailwind CSS, Lucide React (icons), Radix UI / Shadcn UI (accessible UI primitives)
- **State Management:** Zustand or Redux Toolkit (client-side cart, currency state, filters)
- **Form Handling & Validation:** React Hook Form + Zod
- **Deployment & Hosting:** Vercel (Edge-optimized SSR/SSG/ISR)

### 2.2 Backend Architecture

- **Runtime & Framework:** Node.js, Express.js (TypeScript)
- **Database:** PostgreSQL (Relational Database)
- **ORM / Query Builder:** Prisma ORM (strongly typed data models, migrations, and seeds)
- **Authentication:** JWT (JSON Web Tokens) with HttpOnly secure cookies + OAuth 2.0 (Google, Facebook via Passport.js or NextAuth/Auth.js)
- **Object Storage:** Cloudinary (Mandatory: Heroku has an ephemeral filesystem; all user uploads, product media, and digital patterns must reside in cloud storage with signed URL access)
- **Email Service:** Resend or SendGrid API (Order confirmations, pattern delivery, status updates)
- **Deployment & Hosting:** Heroku (Containerized or Node buildpack, Eco/Basic dynos with Postgres add-on)

---

## 3. Product Catalog & Inventory Engine

The product subsystem supports four distinct fulfillment and catalog archetypes:

### 3.1 Product Types

1. **Standard Stock with Variants:**
   - Traditional e-commerce SKUs with multi-dimensional variations:
     - Color (with visual swatch codes)
     - Size (e.g., S, M, L, custom dimensions)
     - Yarn Type (e.g., Milk Cotton, Acrylic, Mercerized Cotton, Wool)
   - Exact inventory tracking per SKU/variant.

2. **Pre-Order / One-of-a-Kind (OOAK):**
   - Single-unit inventory or production reservation slots.
   - Clear visual indicators of lead time (e.g., "Handcrafted upon order: 7-10 business days").

3. **Custom Commissions / Made-to-Order:**
   - Interactive product customizer.
   - Capabilities:
     - Reference photo multi-upload (supporting PNG, JPEG, WEBP up to 10MB per file, stored in cloud storage).
     - Detailed specification textarea (measurements, target colors, special yarn preferences).
     - Option for custom sizing entry (bust, waist, length in cm/inches).
   - Generates a "Custom Request" ticket associated with the customer account, allowing admin review and quote validation.

4. **Digital Downloadable Goods:**
   - Items such as downloadable PDF crochet patterns, stitch charts, and instructional video guides.
   - Instant automatic fulfillment upon verified payment webhook.
   - Protected download links (temporary, cryptographically signed URLs with expiration and max-download limits).

---

## 4. Multi-Currency, Payments & Dynamic Gateway Matrix

### 4.1 Currency Architecture

- **Supported Currencies:**
  - **BDT (৳):** Default currency for traffic originating from or delivering to Bangladesh.
  - **USD ($):** Default currency for all international destinations.
- **Storage Standard:**
  - Product base prices can either be set dual-manually (`price_bdt`, `price_usd`) to prevent exchange rate volatility or dynamically converted via a configurable rate stored in `store_settings`.
- **Frontend Currency Switcher:**
  - Global header toggle allowing manual override by the customer.
  - Persisted in local storage / session cookie.

### 4.2 Payment Gateways & Dynamic Admin Control

- **Domestic Gateways (BDT):**
  - **SSLCommerz:** Credit/Debit Cards, bKash, Nagad, Rocket, Upay, Internet Banking.
  - **Cash on Delivery (COD):** Available strictly for addresses inside Bangladesh.
- **International Gateways (USD):**
  - **Stripe:** Credit/Debit cards, Apple Pay, Google Pay.
  - **PayPal:** PayPal Wallet, Pay in 4, International cards.
- **Admin Dynamic Gateway Management:**
  - Admin dashboard must feature a dedicated settings panel to toggle each gateway `ENABLED` or `DISABLED` in real-time without code redeployment.
  - System must validate checkout options: if a user selects a destination outside Bangladesh, SSLCommerz and COD are hidden or rejected; if inside Bangladesh, Stripe/PayPal can be hidden or converted.

---

## 5. Shipping & Order Fulfillment Engine

### 5.1 Shipping Calculation Matrix

- **Domestic (Bangladesh):**
  - Flat-rate shipping engine with two standard sub-rules:
    - Whole Bangladesh (e.g., ৳170)
  - Editable via admin shipping settings.
- **International (Worldwide):**
  - Country-tiered rate matrix configured by the admin (e.g., Zone 1: USA/Canada, Zone 2: UK/Europe, Zone 3: Rest of World).
  - Weight/Item count multiplier support.
- **Digital Goods Exemption:**
  - Orders containing strictly digital patterns automatically bypass shipping address collection and incur zero shipping fees.

### 5.2 Customer Order Tracking Dashboard

- Order status stages:
  1. `PENDING_PAYMENT` (Awaiting gateway webhook or COD confirmation)
  2. `CONFIRMED` (Payment validated / COD approved)
  3. `IN_PRODUCTION` (Handcrafting in progress by artisan)
  4. `SHIPPED` / `IN_TRANSIT` (Consignment handed to courier, tracking ID attached)
  5. `DELIVERED` (Customer receipt confirmed)
  6. `CANCELLED` / `REFUNDED`
- Customers can enter their Order ID or view orders in their customer portal to inspect real-time progress, tracking links, and carrier details.

---

## 6. User Management & Authentication

### 6.1 Authentication Rules

- **Mandatory Account Creation:** Guest checkout is prohibited. Customers must authenticate to guarantee access to their digital downloads, order status history, and custom commission requests.
- **Authentication Providers:**
  - Local: Email + Argon2/Bcrypt hashed password with email verification tokens.
  - Social OAuth 2.0: Google Sign-In and Facebook Login.
- **Role-Based Access Control (RBAC):**
  - `CUSTOMER`: Storefront browsing, ordering, file downloads, review submission.
  - `ADMIN`: Complete store administration.

### 6.2 Customer Dashboard

- **Profile Management:** Address book (saved shipping/billing addresses), password management.
- **Order History:** Full itemized receipts with invoice PDF download capability.
- **Digital Pattern Library:** Permanent access to purchased pattern files with one-click re-download.
- **Commission Hub:** Tracking progress of custom design requests, admin quote reviews, and direct payment links for custom approvals.

---

## 7. Custom Admin Panel

A secure, bespoke admin interface (route: `/admin` or separated admin subdomain) built directly in Next.js with protected server-side layout guards.

### 7.1 Key Administrative Modules

1. **Analytics & Revenue Dashboard:**
   - Dual-currency metric cards: Total Revenue (BDT), Total Revenue (USD), Active Orders, Pending Commissions.
   - Revenue timeline charts (daily, weekly, monthly).
   - Low stock alerts and top-performing crochet items.

2. **Catalog & Inventory Management:**
   - Full CRUD operations for Products.
   - Multi-file image uploader with drag-and-drop preview.
   - Variant builder (Color, Size, Yarn Type, Stock Level, SKU).
   - Digital file attachment uploader (PDF patterns).
   - Category and collection management.

3. **Order & Commission Operations:**
   - Order lifecycle manager (Update status, assign courier tracking numbers).
   - Custom Commission Reviewer:
     - View user-submitted reference photos.
     - Review custom measurements and text instructions.
     - Set a custom price quote and trigger an invoice email to the customer.

4. **Payment Gateway & Store Controls:**
   - Live toggles for Stripe, PayPal, SSLCommerz, and COD.
   - Shipping rate configuration (Dhaka, Rest of BD, International country rates).

5. **Discounts & Coupons:**
   - Coupon CRUD: Code, Discount Type (`PERCENTAGE` vs `FIXED_AMOUNT`), Currency (`BDT` vs `USD`), Min Order Value, Expiry Date, Max Uses.

6. **Content Management (Blog):**
   - Markdown or Rich Text editor for articles (yarn care guides, crochet tips, behind-the-scenes).
   - SEO metadata controls (Slug, Meta Title, Meta Description, Featured Image).

---

## 8. Third-Party Integrations & Marketing

### 8.1 Meta Pixel (Facebook Pixel)

- Full integration via Next.js Script component or dedicated pixel utility.
- Implementation of standard e-commerce events:
  - `PageView` (All routes)
  - `ViewContent` (Product detail view with product ID, category, value, currency)
  - `AddToCart` (When items are added to basket)
  - `InitiateCheckout` (When proceeding to checkout screen)
  - `Purchase` (Triggered on successful order confirmation with transaction value and currency)
- Server-side Conversions API (CAPI) recommendation for ad-blocker resilience.

### 8.2 Transactional Email

- Templates:
  - Welcome / Account Confirmation.
  - Order Received & Payment Receipt.
  - Digital Pattern Download Ready (with direct link).
  - Handcrafting Started & Order Shipped (with tracking details).
  - Custom Commission Quote Ready.

---

## 9. Comprehensive PostgreSQL Database Schema

```sql
-- ENUMS
CREATE TYPE user_role AS ENUM ('CUSTOMER', 'ADMIN');
CREATE TYPE product_type AS ENUM ('STANDARD', 'ONE_OF_A_KIND', 'PRE_ORDER', 'CUSTOMIZABLE', 'DIGITAL');
CREATE TYPE order_status AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED');
CREATE TYPE payment_gateway AS ENUM ('STRIPE', 'PAYPAL', 'SSLCOMMERZ', 'CASH_ON_DELIVERY');
CREATE TYPE payment_status AS ENUM ('UNPAID', 'PAID', 'FAILED', 'REFUNDED');
CREATE TYPE currency_code AS ENUM ('BDT', 'USD');
CREATE TYPE discount_type AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- USERS TABLE
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    role user_role DEFAULT 'CUSTOMER',
    auth_provider VARCHAR(50) DEFAULT 'local', -- 'local', 'google', 'facebook'
    provider_id VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- USER ADDRESSES
CREATE TABLE addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    street_address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state_division VARCHAR(100),
    postal_code VARCHAR(30) NOT NULL,
    country VARCHAR(100) NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- CATEGORIES
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- PRODUCTS
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(280) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    product_type product_type NOT NULL DEFAULT 'STANDARD',
    price_bdt DECIMAL(12, 2) NOT NULL,
    price_usd DECIMAL(12, 2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    lead_time_days INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- PRODUCT IMAGES
CREATE TABLE product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    display_order INT DEFAULT 0
);

-- PRODUCT VARIANTS
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(100) UNIQUE,
    color_name VARCHAR(50),
    color_hex VARCHAR(10),
    size_label VARCHAR(50),
    yarn_type VARCHAR(100),
    stock_quantity INT DEFAULT 0,
    additional_price_bdt DECIMAL(12, 2) DEFAULT 0.00,
    additional_price_usd DECIMAL(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- DIGITAL PRODUCT ASSETS
CREATE TABLE digital_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_key TEXT NOT NULL, -- S3 object key or Cloudinary private URI
    file_size_bytes BIGINT NOT NULL,
    file_type VARCHAR(50) DEFAULT 'application/pdf',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- CUSTOM COMMISSIONS / MADE-TO-ORDER REQUESTS
CREATE TABLE custom_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    reference_images TEXT[] NOT NULL, -- Array of image URLs
    specifications TEXT NOT NULL,
    measurements JSONB, -- { "bust": "36in", "length": "24in" }
    status VARCHAR(50) DEFAULT 'PENDING_REVIEW', -- 'PENDING_REVIEW', 'QUOTED', 'ACCEPTED', 'REJECTED'
    quoted_price_bdt DECIMAL(12, 2),
    quoted_price_usd DECIMAL(12, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- COUPONS
CREATE TABLE coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_type discount_type NOT NULL,
    discount_value DECIMAL(10, 2) NOT NULL,
    min_order_bdt DECIMAL(12, 2) DEFAULT 0.00,
    min_order_usd DECIMAL(12, 2) DEFAULT 0.00,
    max_uses INT,
    used_count INT DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ORDERS
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    currency currency_code NOT NULL,
    subtotal_amount DECIMAL(12, 2) NOT NULL,
    shipping_amount DECIMAL(12, 2) NOT NULL,
    discount_amount DECIMAL(12, 2) DEFAULT 0.00,
    total_amount DECIMAL(12, 2) NOT NULL,
    order_status order_status DEFAULT 'PENDING_PAYMENT',
    payment_status payment_status DEFAULT 'UNPAID',
    payment_gateway payment_gateway NOT NULL,
    transaction_id VARCHAR(255),
    shipping_address JSONB NOT NULL,
    tracking_number VARCHAR(100),
    courier_name VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ORDER ITEMS
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    product_title VARCHAR(255) NOT NULL,
    variant_description VARCHAR(255),
    unit_price DECIMAL(12, 2) NOT NULL,
    quantity INT NOT NULL,
    total_price DECIMAL(12, 2) NOT NULL,
    is_digital BOOLEAN DEFAULT false
);

-- DIGITAL DOWNLOAD ACCESS LOGS
CREATE TABLE digital_downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES digital_assets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    download_count INT DEFAULT 0,
    max_downloads INT DEFAULT 10,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- BLOG POSTS
CREATE TABLE blog_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(280) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    featured_image TEXT,
    meta_title VARCHAR(255),
    meta_description TEXT,
    is_published BOOLEAN DEFAULT false,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- STORE SETTINGS & GATEWAY TOGGLES
CREATE TABLE store_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Default settings seed for payment toggles & shipping
INSERT INTO store_settings (key, value, description) VALUES
('payment_gateways', '{
    "stripe": { "enabled": true, "mode": "live" },
    "paypal": { "enabled": true, "mode": "live" },
    "sslcommerz": { "enabled": true, "mode": "live" },
    "cash_on_delivery": { "enabled": true, "mode": "live" }
}', 'Dynamic control for active payment gateways'),
('shipping_rates', '{
    "bd_inside_dhaka": 80.00,
    "bd_outside_dhaka": 150.00,
    "international_base_usd": 25.00
}', 'Base shipping calculation rates');
```

---

## 10. API Specification & Endpoints

### 10.1 Authentication & Profile (`/api/auth`, `/api/users`)

- `POST /api/auth/register` - Create email/password customer account.
- `POST /api/auth/login` - Authenticate customer/admin and return HttpOnly JWT.
- `GET /api/auth/oauth/google` & `/facebook` - Initiate OAuth handshakes.
- `GET /api/users/me` - Fetch profile, default addresses, and permissions.
- `GET /api/users/orders` - List customer order history.
- `GET /api/users/downloads` - List purchased digital assets with signed download URLs.

### 10.2 Products & Catalog (`/api/products`, `/api/categories`)

- `GET /api/products` - Query catalog with filtering (category, type, price, currency).
- `GET /api/products/:slug` - Product detail with variants, image gallery, and lead times.
- `POST /api/commissions` - Submit custom commission with reference photos (multipart/form-data).

### 10.3 Checkout & Orders (`/api/checkout`, `/api/orders`)

- `POST /api/checkout/quote` - Calculate shipping, coupon discounts, subtotal, and tax.
- `POST /api/checkout/create-order` - Lock in order record in `PENDING_PAYMENT`.
- `POST /api/payments/stripe/create-intent` - Generate Stripe Client Secret.
- `POST /api/payments/paypal/create-order` - Initialize PayPal checkout order.
- `POST /api/payments/sslcommerz/init` - Initialize SSLCommerz session and obtain redirect URL.
- `POST /api/webhooks/stripe` - Stripe webhook handler (activates downloads / updates order).
- `POST /api/webhooks/paypal` - PayPal capture webhook.
- `POST /api/webhooks/sslcommerz` - SSLCommerz IPN / validation endpoint.

### 10.4 Admin Management (`/api/admin`)

- `GET /api/admin/metrics` - Revenue aggregates (BDT/USD), order velocity, stock levels.
- `CRUD /api/admin/products` - Full product lifecycle management.
- `CRUD /api/admin/orders` - Update status, add tracking numbers.
- `GET /api/admin/commissions` & `PATCH /api/admin/commissions/:id/quote` - Quote custom requests.
- `GET /api/admin/settings` & `PATCH /api/admin/settings` - Toggle payment gateways and shipping fees.
- `CRUD /api/admin/coupons` - Coupon management.
- `CRUD /api/admin/blogs` - Content marketing management.

---

## 11. Implementation Roadmap for Autonomous AI Agents

Follow this sequential execution plan:

### Phase 1: Environment & Project Scaffolding

1. Initialize monorepo or standard decoupled repos:
   - `/frontend` (Next.js App Router, TypeScript, Tailwind CSS, Lucide React).
   - `/backend` (Express.js, TypeScript, Prisma/Drizzle, ts-node-dev).
2. Set up PostgreSQL database and apply schema migrations.
3. Configure cloud object storage (AWS S3 / Supabase Storage / Cloudinary) SDK with upload utilities.

### Phase 2: Authentication & Admin Security

1. Implement JWT generation, cookie parsers, and password hashing.
2. Build Google and Facebook OAuth strategies.
3. Establish admin middleware (`requireAuth`, `requireAdmin`) and protected Next.js admin layout guards.

### Phase 3: Product Catalog & Storefront UI

1. Implement backend product CRUD APIs with multi-variant and image attachment support.
2. Build storefront home, catalog listing, and dynamic product details pages (`/products/[slug]`).
3. Implement custom commission upload interface (dropzone for reference images, dimension forms).
4. Implement currency switcher state (Zustand) with automatic formatting (`৳` and `$`).

### Phase 4: Cart, Checkout & Payment Gateways

1. Build persistent shopping cart.
2. Build checkout wizard:
   - Shipping country selector (toggles BD flat-rate vs International dynamic rate).
   - Gateway selector filtered by country and admin store settings.
3. Integrate Stripe SDK (Elements / Intent API).
4. Integrate PayPal SDK (Smart Buttons / v2 Checkout API).
5. Integrate SSLCommerz gateway engine with IPN verification.
6. Implement Cash on Delivery order placement.

### Phase 5: Customer Portal & Digital Delivery

1. Implement customer order tracking view (`/track-order` and `/account/orders`).
2. Build digital downloads system: webhook triggers token generation, customer can download pattern PDFs via signed S3/storage URLs.

### Phase 6: Admin Dashboard & Marketing

1. Construct `/admin` overview with revenue cards (BDT vs USD separation) and order tables.
2. Build gateway toggle switch controls in `/admin/settings`.
3. Build Coupon and Blog CMS.
4. Integrate Meta Pixel tracking on all high-intent user paths (`PageView`, `ViewContent`, `AddToCart`, `InitiateCheckout`, `Purchase`).
