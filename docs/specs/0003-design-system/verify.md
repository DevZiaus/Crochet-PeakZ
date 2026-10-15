# Verify: design system & UI foundation · spec 0003 · updated 2026-10-15

_Steps derived from spec 0003 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [ ] Open the app in a browser, toggle the theme in the header → every surface, card, and text colour switches with no per component logic, and no flash of the wrong theme on a hard reload → **AC-1**, **AC-5**
- [ ] Inspect body text and headings on any page → body renders DM Sans, headings render Playfair Display → **AC-3**
- [ ] Tab through the header, a form, and the product cards with the keyboard only → every control shows a 2px teal focus ring with a 2px offset, and nothing focusable has no visible indicator → **AC-9**
- [ ] Set `prefers-reduced-motion: reduce` in the OS or devtools, then load the page and hover the cards → no transition or scroll reveal animation plays → **AC-9**, **AC-13**
- [ ] Measure any interactive control (button, icon button, nav link) → at least 44px in one dimension → **AC-9**
- [ ] Resize from 320px up to 1440px → no horizontal overflow, the product grid reflows 1 to 2 to 3 to 4 columns, the header collapses to a hamburger, and the drawer opens and closes → **AC-8**, **AC-11**
- [ ] On a page using Container, widen past 1440px → storefront content stays inside a centred 1280px column with even gutters → **AC-11**
- [ ] Render AdminLayout at desktop and mobile widths → the sidebar fills the viewport fluidly at desktop, collapses to icons, and becomes an overlay drawer at mobile → **AC-11**
- [ ] Force an ErrorBoundary child to throw → the fallback shows the destructive icon, a heading, the message, and a working Try again button → **AC-10**
- [ ] Render EmptyState with and without an action → icon, heading, description, and optional CTA all centre correctly → **AC-10**
- [ ] Fire a toast → it appears and picks up the popover tokens in both themes (the Toaster is mounted in the root layout) → **AC-6**
- [ ] Drag a valid file and an oversized file onto FileUploadZone → the valid one lists with its size, the oversized one shows an inline error and is excluded from the callback → **AC-8**
- [ ] Step QuantityStepper to its min and max → the buttons disable at each bound and the value is announced → **AC-8**

## Commands

- [ ] `npm run typecheck` → all three workspaces pass with no errors → **AC-2**, **AC-7**
- [ ] `npm run lint` → passes across all workspaces → **AC-7**
- [ ] `npm run build` → the web app builds and prerenders `/` and `/design-system` → **AC-2**, **AC-6**
- [ ] `grep -rE '(bg|text|border|ring)-(white|black|zinc|gray|slate|red|blue|green)(-[0-9]+)?' apps/web/src --include='*.tsx'` → no matches outside the temporary showcase fixture, proving every colour resolves to a token → **AC-1**
- [ ] Run a contrast check over every `--*-foreground` pair in both themes → all normal text at least 4.5:1, all non text boundaries at least 3:1 → **AC-9**

## Value sourcing (one step per row of the spec table)

- [ ] Render `PriceDisplay` with `priceBdt={1200} priceUsd={12}` and no `activeCurrency` → shows `৳1,200` (the BDT default), then pass `activeCurrency="USD"` → shows `$12.00`; add `compareAtBdt={1500}` → the old price strikes through in the highlight colour beside the new one → **AC-8**
- [ ] Render `ProductCard` with a Cloudinary style `imageUrl` → the image loads through `next/image` and fills a 4:5 box without layout shift; pass an invalid URL → the card still renders its title, badge, and price → **AC-8**
- [ ] Render `StarRating` at `1`, `2.5`, `3.5`, and `5` → the filled, half, and empty star counts match each value and the accessible name reads the rating out of the max → **AC-8**
- [ ] Toggle the theme, reload, and read `document.documentElement.dataset.theme` → it persists the manual choice; clear `localStorage` and set the OS to dark → it follows the system preference → **AC-5**
- [ ] Render `Header` with no logo asset present → the text wordmark "Crochet PeakZ" renders as the brand, never an empty corner → **AC-8**
- [ ] Render `Skeleton` in light and dark → the shimmer gradient derives from the muted tokens and is visible in both themes → **AC-10**

## Acceptance-criteria coverage

- AC-1 covered by the token step and the reduction step · AC-2 by typecheck and build · AC-3 by the font step · AC-4 by checking `design.md` matches `globals.css` · AC-5 by the theme toggle and `data-theme` step · AC-6 by the toast and build steps · AC-7 by typecheck, lint, and the CVA primitives · AC-8 by the component, resize, and file steps · AC-9 by the focus, touch target, and contrast steps · AC-10 by the ErrorBoundary, EmptyState, and Skeleton steps · AC-11 by the container and admin layout steps · AC-12 by a read of `apps/web/design.md` · AC-13 by the reduced motion and hover steps.
