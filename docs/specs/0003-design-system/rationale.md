# Rationale: Design system and UI foundation

## Context

Crochet PeakZ is a handmade crochet e-commerce platform targeting both Bangladeshi and international customers. The project has a working scaffold (Next.js 16, Tailwind CSS v4, Express.js backend, PostgreSQL with Prisma) and a complete data model, but no visual identity, no base components, and no design tokens. Every feature in Slice 1 (auth, catalog, cart, checkout) needs UI, and without a shared design system each feature would invent its own colors, spacing, and component patterns, creating visual inconsistency that is expensive to fix later.

The brand personality must convey "handmade, artisanal, premium but approachable" rather than "generic tech startup." The store sells handcrafted crochet products, so the visual language should feel warm, personal, and tactile, while still being modern and professional enough to inspire trust for international e-commerce transactions. Two distinct surfaces (a customer facing storefront and an admin dashboard) must share the same visual DNA while differing in layout strategy.

The scaffold currently uses Geist and Geist Mono fonts, which are clean but generic. The default Tailwind color palette carries no brand identity. No dark mode, no component library, no accessibility baseline beyond what the browser provides.

## Options considered

### Option 1: Shadcn UI with custom theme (chosen)

Install Shadcn UI via CLI, which generates Radix UI based components as owned source code. Override the default theme with the project's custom palette, typography, and spacing through CSS custom properties consumed by Tailwind v4's `@theme` system.

**Pros**:

- Components are source code you own and can edit freely, not a locked dependency
- Built on Radix UI primitives with full accessibility (keyboard nav, ARIA, focus management) out of the box
- Tailwind v4 native token consumption via `@theme` and CSS custom properties
- Large community, well documented, battle tested patterns

**Cons**:

- Upstream Shadcn updates require manual merging (no automatic dependency updates)
- Initial setup and customization of ~13 primitives is non trivial
- Source code ownership means you also own the bugs

### Option 2: Raw Radix UI primitives with fully custom styling

Install Radix UI primitives directly and write all Tailwind styling from scratch, with no Shadcn layer.

**Pros**:

- Maximum control over every visual detail
- No Shadcn conventions or opinions to work around
- Lighter starting point (no generated code)

**Cons**:

- Significantly more build time to style every primitive (Button, Dialog, Select, DropdownMenu each need careful styling for all states)
- Must manually implement variant systems, the `cn()` pattern, and consistent APIs
- Reinvents patterns Shadcn already solved

### Option 3: Fully custom component library (no Radix)

Build every component from raw HTML elements with Tailwind, handling all ARIA attributes, keyboard navigation, and focus management manually.

**Pros**:

- Zero external component dependencies
- Complete control over markup and behavior

**Cons**:

- Enormous build time for accessible components (Dialog, Select, DropdownMenu are notoriously hard to implement correctly)
- High risk of accessibility regressions
- A solo developer maintaining a custom component library is not sustainable

## Rationale

Option 1 (Shadcn UI with custom theme) is the right choice because the project is a solo developer building a full e-commerce platform. Accessibility correctness and build speed are the binding constraints, not maximum styling control. Radix UI's accessibility layer is the most thoroughly tested open source implementation available, and Shadcn wraps it in a developer friendly pattern (owned source, CVA variants, `cn()` utility) that exactly matches the project's Tailwind v4 + TypeScript stack.

Option 2 would deliver the same end result with more build time and more risk of inconsistent APIs across components. The Shadcn layer costs nothing at runtime (it generates source, not a bundle dependency) and saves significant design decision time on component APIs.

Option 3 is disqualified by the scale of work. A solo developer building Dialog, Select, and DropdownMenu to WCAG AA standard from scratch is weeks of work that Radix already solved.

The typography pairing (DM Sans + Playfair Display) balances warmth with readability. DM Sans is a geometric sans serif with slightly rounded terminals that feels friendly without being childish, excellent for body text and UI labels at small sizes. Playfair Display is a modern serif with high stroke contrast that brings personality and elegance to headings, pairing naturally with the deep teal and warm gold palette.

The deep teal (#0D7377) and warm gold (#C8A456) palette was chosen over warmer options (terracotta, sage) because teal is gender neutral, sophisticated, and distinctive in the crochet/craft e-commerce space, which tends toward pastels. The warm gold accent adds the artisanal warmth without the palette feeling cold. Rose/coral as a secondary highlight handles sale badges and alerts without clashing.

Subsequent storefront work evolved the palette from warm gold (`#C8A456`) to the botanical cream/paper/sage surfaces paired with deep teal (`#0f5c5c`) primary, brand rose (`#bf5570`) accent, and AA-safe deep rose (`#ae4460`) highlight (see `apps/web/design.md` and `apps/web/src/app/globals.css`) to align with the Crochet PeakZ emblem and hero art.

Dark mode via `next-themes` with `data-theme` attribute was chosen over Tailwind's `dark:` class strategy because CSS custom property switching is more natural for a token based system, avoids coupling dark mode to Tailwind specific syntax, and `next-themes` handles the SSR hydration problem (flash of wrong theme) that a custom solution would need to solve manually.
