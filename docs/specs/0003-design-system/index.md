# 0003. Design system and UI foundation for Crochet PeakZ

**Date**: 2026-10-04
**Status**: Accepted

## Summary

Crochet PeakZ adopts a warm, artisanal visual language built on a deep teal and warm gold color palette, DM Sans and Playfair Display typography, and Shadcn UI components customized to the brand. This spec defines every design token (colors, type scale, spacing, radii, shadows), the dark mode system (via `next-themes`), and the full base component inventory that every later feature builds on. The foundation ships before Slice 1 so the storefront and admin panel share a cohesive, accessible, premium look from day one.

## Requirements

**User stories**:

- As a developer, I want a complete design token system so that every page and component I build later uses consistent colors, typography, spacing, and shadows without ad hoc decisions.
- As a developer, I want pre built, accessible base components (Button, Input, Card, ProductCard, Header, Footer, and others) so that Slice 1 features assemble from tested primitives rather than building from scratch.
- As a customer, I want the storefront to feel premium and cohesive so that I trust the brand and enjoy browsing.
- As an admin, I want the admin panel to share the same visual language but with a full width layout optimized for data so that managing the store feels professional.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):

- **AC-1**: Design tokens are defined as CSS custom properties in `globals.css` under `:root` (light) and `[data-theme="dark"]` (dark), covering: primary (teal), accent (gold), secondary highlight (rose/coral), surface colors, foreground colors, border colors, radius values, shadow values, and the full typography scale.
- **AC-2**: Tailwind CSS v4 consumes the tokens via `@theme` inline declarations so that `bg-primary`, `text-accent`, `font-heading`, and similar utility classes resolve to the design token values.
- **AC-3**: Typography uses DM Sans (body/UI, variable `--font-dm-sans`) and Playfair Display (headings/display, variable `--font-playfair`) loaded via `next/font/google`, replacing Geist as the default body font.
- **AC-4**: The type scale defines at least 7 sizes (xs through 3xl) with corresponding line heights and letter spacing values, documented in `design.md`.
- **AC-5**: Dark mode toggles via `next-themes` with `attribute="data-theme"` on the `<html>` element, defaulting to system preference with a manual override. No flash of wrong theme on load (SSR safe).
- **AC-6**: All Shadcn UI primitives are initialized via `npx shadcn@latest init` and customized to use the project's design tokens. At minimum: Button, Input, Textarea, Select, Checkbox, Switch, Badge, Card, Dialog, Toast (Sonner), DropdownMenu, Avatar, Skeleton.
- **AC-7**: Each Shadcn primitive uses CVA (Class Variance Authority) for variant definitions (size, visual variant) and the `cn()` utility (clsx + tailwind-merge) from `src/lib/utils.ts`.
- **AC-8**: Composed components are built for: Header/Navbar, Footer, Breadcrumbs, MobileNavDrawer, AdminSidebar, ProductCard, PriceDisplay (currency aware), QuantityStepper, StarRating, FormField (label + error + description wrapper), FileUploadZone, Container, Section, PageHeader, Divider.
- **AC-9**: Every interactive component meets WCAG 2.1 AA: visible focus ring (2px, primary teal), minimum 4.5:1 text contrast ratio, 44px minimum touch target, and `prefers-reduced-motion` respected on all transitions.
- **AC-10**: Loading states use the Skeleton primitive with a warm shimmer matching the palette. Error states use an ErrorBoundary wrapper (icon + heading + description + retry button). Empty states use a centered layout (icon + heading + description + optional CTA).
- **AC-11**: Storefront layout uses a max width container of 1280px centered. Admin layout uses full width fluid. Both share the same design tokens and component library.
- **AC-12**: A `design.md` file in `apps/web/` documents the finalized token values, type scale, color usage guide, spacing system, component API conventions, and accessibility rules, serving as the reference for all future feature development.
- **AC-13**: Transitions use 200ms to 300ms duration on hover/focus/active states. Scroll triggered fade in animations on product cards. All motion honors `prefers-reduced-motion: reduce`.

## Decision

**Chosen option**: Shadcn UI with custom theme on Tailwind CSS v4, deep teal and warm gold palette, DM Sans + Playfair Display typography, `next-themes` for dark mode.

The design system is built as a layer on top of Shadcn UI (which provides accessible Radix UI primitives as owned source code) with a fully custom theme applied through CSS custom properties consumed by Tailwind v4's `@theme` system. This gives full control over every visual detail while inheriting Radix's battle tested accessibility (keyboard navigation, ARIA attributes, focus management). The warm artisanal personality comes from the color palette and typography, not from fighting the component library.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:

No new database entities. The design system is a frontend only concern. All tokens, components, and layouts live in `apps/web/`.

**API surface**:

No API endpoints. The design system produces React components and CSS tokens consumed by other frontend features.

**Value sourcing**:

| Action                   | Value produced / displayed                  | Source                                                                                                                                                                                                                             |
| ------------------------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PriceDisplay render      | Formatted price string with currency symbol | `priceBdt` / `priceUsd` from product entity (spec 0002), active currency from the `cp_currency` cookie via `getActiveCurrency()` on the server or `useCurrency()` in client components (spec 0007). Defaults to `"BDT"` when unset |
| ProductCard image render | Product thumbnail                           | `url` field from `ProductImage` entity (spec 0002), loaded via Next.js `Image` component with Cloudinary domain configured in `next.config.ts`                                                                                     |
| StarRating render        | Average rating display                      | `averageRating` computed from Review entity (spec 0002)                                                                                                                                                                            |
| Dark mode toggle         | Current theme                               | `next-themes` reads from localStorage, falls back to `prefers-color-scheme` media query                                                                                                                                            |
| Header logo display      | Brand logo / wordmark                       | Static SVG asset in `public/logo.svg` (or `src/assets/`), provided by the engineer. If not yet created, a text wordmark placeholder renders                                                                                        |
| Skeleton shimmer color   | Shimmer gradient                            | Derived from `--muted` and `--muted-foreground` CSS tokens                                                                                                                                                                         |

**Key invariants**:

- Every color used in the UI must resolve to a CSS custom property from the design token system, never a raw hex or Tailwind default color.
- All text must meet WCAG 2.1 AA contrast ratio (4.5:1 for normal text, 3:1 for large text) in both light and dark themes.
- No component may use inline `transition` or `animation` CSS without checking `prefers-reduced-motion`.
- Shadcn primitives live in `src/components/ui/`. Composed components live in `src/components/`. No component crosses this boundary (a composed component imports from `ui/`, never the reverse).

**Security model**:

No security surface. The design system is presentation only with no data mutations, no auth requirements, and no sensitive data handling.

**Configuration required**:

No new environment variables or secrets. All design tokens are compile time CSS values.

**Critical test scenarios** (each maps to an acceptance criterion):

- Happy path: all Shadcn primitives render in both light and dark themes with correct token colors, verifies **AC-1**, **AC-2**, **AC-5**, **AC-6**
- Happy path: DM Sans loads as body font and Playfair Display loads as heading font across all pages, verifies **AC-3**
- Happy path: `design.md` documents every token value and matches what `globals.css` actually defines, verifies **AC-4**, **AC-12**
- Accessibility: every interactive component shows a visible focus ring on keyboard tab, passes axe automated checks at AA level, verifies **AC-9**
- Accessibility: with `prefers-reduced-motion: reduce` enabled, no animations or transitions play, verifies **AC-13**
- Loading state: Skeleton placeholders render with the themed shimmer, ErrorBoundary catches a thrown error and shows retry, Empty state renders centered with icon and CTA, verifies **AC-10**
- Layout: storefront content stays within 1280px centered container on wide screens; admin layout fills available width, verifies **AC-11**

## Build plan

Ordered by Tracer Bullet: prove the full pipe (tokens → primitives → composed → layout → docs) works end to end in the thinnest thread first, then thicken.

1. **Install dependencies and initialize Shadcn UI**: install `next-themes`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`; run `npx shadcn@latest init` with the New York style and custom theme; create `src/lib/utils.ts` with the `cn()` helper, satisfies **AC-6**, **AC-7**
2. **Replace fonts**: swap Geist/Geist Mono for DM Sans (body) and Playfair Display (headings) via `next/font/google` in `layout.tsx`; set CSS variables `--font-dm-sans` and `--font-playfair`; update `@theme` to register `--font-sans` and `--font-heading`, satisfies **AC-3**
3. **Define design tokens in globals.css**: write the full CSS custom property set under `:root` and `[data-theme="dark"]` covering the complete palette (primary teal scale, accent gold scale, secondary rose, surfaces, foreground, muted, border, ring, radius, shadows) and the type scale (7 sizes with line heights), satisfies **AC-1**, **AC-2**, **AC-4**
4. **Wire up next-themes**: add `ThemeProvider` in the root layout with `attribute="data-theme"`, `defaultTheme="system"`, `enableSystem`; verify no FOUC, satisfies **AC-5**
5. **Install and customize Shadcn primitives**: add Button, Input, Textarea, Select, Checkbox, Switch, Badge, Card, Dialog, Toast (Sonner), DropdownMenu, Avatar, Skeleton via the Shadcn CLI; restyle each to use the project's tokens and verify CVA variant definitions, satisfies **AC-6**, **AC-7**, **AC-9**
6. **Build accessibility foundations**: apply visible focus ring styles (2px offset, primary teal), verify 4.5:1 contrast on all token pairs, set 44px minimum touch targets on interactive elements, add `prefers-reduced-motion` guard to all transition utilities, satisfies **AC-9**, **AC-13**
7. **Build state pattern components**: create Skeleton loading pattern with themed shimmer, ErrorBoundary wrapper, and EmptyState component (icon + heading + description + optional CTA), satisfies **AC-10**
8. **Build layout components**: create Container (1280px max, centered for storefront), Section wrapper, PageHeader, Divider; create AdminLayout (full width fluid) shell; verify both layouts at all breakpoints, satisfies **AC-11**
9. **Build navigation components**: Header/Navbar (logo, nav links, currency switcher placeholder, theme toggle, cart icon placeholder, auth placeholder), Footer (links, social, copyright), Breadcrumbs, MobileNavDrawer (hamburger + slide out), AdminSidebar (collapsible, icon + label), satisfies **AC-8**
10. **Build commerce components**: ProductCard (image, title, price, badge, rating), PriceDisplay (currency aware, accepts `priceBdt`/`priceUsd` + active currency), QuantityStepper (increment/decrement with min/max), StarRating (display, 1 to 5, half star support), satisfies **AC-8**
11. **Build form components**: FormField wrapper (label, input slot, error message, description), FileUploadZone (drag and drop area, file list, size/type validation display), satisfies **AC-8**
12. **Write design.md reference**: document every token value, the type scale table, color usage guide (when to use primary vs accent vs secondary), spacing system, component variant APIs, icon usage, and accessibility rules, satisfies **AC-12**

## Consequences

**Positive**:

- Every later feature (auth, catalog, cart, checkout, admin) assembles from tested, accessible, themed components rather than building UI from scratch.
- Dark mode works everywhere with zero per feature effort (tokens switch automatically).
- The `design.md` gives any developer (or AI agent) a single reference for visual decisions, eliminating "what color/font/spacing should I use" during builds.

**Negative / tradeoffs**:

- The full component inventory (5 groups, ~25 components) is a significant build before any business feature ships. This is the cost of a cohesive foundation.
- Shadcn components are source code you own, which means you also own their maintenance and updates. Upstream Shadcn changes require manual merging.
- `next-themes` adds a small runtime dependency (2KB gzip) for theme switching.

**Neutral**:

- Geist and Geist Mono fonts are removed from the project. Any existing references will need updating (only the scaffold `layout.tsx` and `globals.css` currently use them).
- The Shadcn CLI adds a `components.json` configuration file to the web app root.

## Follow-up

- [ ] After this ships, each Slice 1 feature should import from the component library rather than creating new primitives. The ProductCard, PriceDisplay, and Header are specifically designed to be consumed by Feature #6 (Product catalog storefront) and Feature #7 (Currency switcher).
- [x] Currency switching shipped in Feature #7 (spec 0007) using a Server Action (`setCurrency`), the `cp_currency` HttpOnly cookie, server `getActiveCurrency()`, and client `CurrencyProvider` / `useCurrency()` rather than a Zustand store.
- [ ] Consider adding a Storybook instance later for visual component documentation. Not worth the setup cost at foundation stage, but valuable once the component count grows past 30.
- [ ] A brand logo SVG is needed for the Header component. If one does not exist yet, create or commission it before the storefront goes live. The Header renders a text wordmark placeholder until then.
