# Verify: design system & UI foundation · spec 0003 · final

_Steps derived from spec 0003 acceptance criteria. All passed._

## UI / manual

- [x] Open the app in a browser, toggle the theme in the header → every surface, card, and text colour switches with no per component logic, and no flash of the wrong theme on a hard reload → **AC-1**, **AC-5**
- [x] Inspect body text and headings on any page → body renders DM Sans, headings render Playfair Display → **AC-3**
- [x] Tab through the header, a form, and the product cards with the keyboard only → every control shows a 2px teal focus ring with a 2px offset, and nothing focusable has no visible indicator → **AC-9**
- [x] Set `prefers-reduced-motion: reduce` in the OS or devtools, then load the page and hover the cards → no transition or scroll reveal animation plays → **AC-9**, **AC-13**
- [x] Measure any interactive control (button, icon button, nav link) → at least 44px in one dimension → **AC-9**
- [x] Resize from 320px up to 1440px → no horizontal overflow, the product grid reflows 1 to 2 to 3 to 4 columns, the header collapses to a hamburger, and the drawer opens and closes → **AC-8**, **AC-11**
- [x] On a page using Container, widen past 1440px → storefront content stays inside a centred 1280px column with even gutters → **AC-11**
- [x] Render AdminLayout at desktop and mobile widths → the sidebar fills the viewport fluidly at desktop, collapses to icons, and becomes an overlay drawer at mobile → **AC-11**
- [x] Force an ErrorBoundary child to throw → the fallback shows the destructive icon, a heading, the message, and a working Try again button → **AC-10**
- [x] Render EmptyState with and without an action → icon, heading, description, and optional CTA all centre correctly → **AC-10**
- [x] Fire a toast → it appears and picks up the popover tokens in both themes (the Toaster is mounted in the root layout) → **AC-6**
- [x] Drag a valid file and an oversized file onto FileUploadZone → the valid one lists with its size, the oversized one shows an inline error and is excluded from the callback → **AC-8**
- [x] Step QuantityStepper to its min and max → the buttons disable at each bound and the value is announced → **AC-8**
- [x] Mobile admin drawer: hamburger button with `aria-label="Open admin navigation"`, drawer opens, Escape closes it, toggle button inside drawer labelled `aria-label="Close admin navigation"` → correct accessible name for dismiss action → AC-8

## Commands

- [x] `npm run typecheck` → all three workspaces pass with no errors → **AC-2**, **AC-7**
- [x] `npm run lint` → passes across all workspaces → **AC-7**
- [x] `npm run build` → the web app builds and prerenders `/` and `/design-system` → **AC-2**, **AC-6**
- [x] `grep -rE '(bg|text|border|ring)-(white|black|zinc|gray|slate|red|blue|green)(-[0-9]+)?' apps/web/src --include='*.tsx'` → no matches outside the temporary showcase fixture, proving every colour resolves to a token → **AC-1**
- [x] Run a contrast check over every `--*-foreground` pair in both themes → all normal text at least 4.5:1, all non text boundaries at least 3:1 → **AC-9**

## Value sourcing (one step per row of the spec table)

- [x] Render `PriceDisplay` with `priceBdt={1200} priceUsd={12}` and no `activeCurrency` → shows `৳1,200` (the BDT default), then pass `activeCurrency="USD"` → shows `$12.00`; add `compareAtBdt={1500}` → the old price strikes through in the highlight colour beside the new one → **AC-8**
- [x] Render `ProductCard` with a Cloudinary style `imageUrl` → the image loads through `next/image` and fills a 4:5 box without layout shift; pass an invalid URL → the card still renders its title, badge, and price → **AC-8**
- [x] Render `StarRating` at `1`, `2.5`, `3.5`, and `5` → the filled, half, and empty star counts match each value and the accessible name reads the rating out of the max → **AC-8**
- [x] Toggle the theme, reload, and read `document.documentElement.dataset.theme` → it persists the manual choice; clear `localStorage` and set the OS to dark → it follows the system preference → **AC-5**
- [x] Render `Header` with no logo asset present → the text wordmark "Crochet PeakZ" renders as the brand, never an empty corner → **AC-8**
- [x] Render `Skeleton` in light and dark → the shimmer gradient derives from the muted tokens and is visible in both themes → **AC-10**

## Contrast verification results

| Theme | Pair                              | Ratio   | Status                |
| ----- | --------------------------------- | ------- | --------------------- |
| Light | foreground/background             | 13.93:1 | ✅ Pass               |
| Light | mutedForeground/muted             | 4.99:1  | ✅ Pass               |
| Light | primaryForeground/primary         | 7.76:1  | ✅ Pass               |
| Light | secondaryForeground/secondary     | 10.52:1 | ✅ Pass               |
| Light | highlightForeground/highlight     | 5.5:1   | ✅ Pass               |
| Light | destructiveForeground/destructive | 6.57:1  | ✅ Pass               |
| Light | cardForeground/card               | 14.76:1 | ✅ Pass               |
| Light | popoverForeground/popover         | 14.76:1 | ✅ Pass               |
| Light | ring/background (focus)           | 7.33:1  | ✅ Pass               |
| Light | input/background (border)         | 3.89:1  | ✅ Pass 3:1 threshold |
| Dark  | foreground/background             | 15.82:1 | ✅ Pass               |
| Dark  | mutedForeground/muted             | 6.76:1  | ✅ Pass               |
| Dark  | primaryForeground/primary         | 7.61:1  | ✅ Pass               |
| Dark  | secondaryForeground/secondary     | 10.96:1 | ✅ Pass               |
| Dark  | highlightForeground/highlight     | 6.01:1  | ✅ Pass               |
| Dark  | destructiveForeground/destructive | 7.03:1  | ✅ Pass               |
| Dark  | cardForeground/card               | 14.27:1 | ✅ Pass               |
| Dark  | popoverForeground/popover         | 14.27:1 | ✅ Pass               |
| Dark  | ring/background (focus)           | 7.61:1  | ✅ Pass               |
| Dark  | input/background (border)         | 4.59:1  | ✅ Pass               |

Note: `--accent` on background is a documented exception (decorative fill only, never text).

## Post-verification fixes applied

- **Lint error fixed**: `apps/web/src/components/admin-layout.tsx:151` - the `useEffect` cleanup returned a void expression, triggering `@typescript-eslint/no-confusing-void-expression`. Fixed by wrapping the cleanup in braces.
- **Mobile drawer accessible label fixed**: Added `toggleLabel` prop to `AdminSidebar`. Mobile overlay passes `toggleLabel="Close admin navigation"` instead of `"Collapse sidebar"` so screen reader users hear the correct action.
- **Debug round fixes** (after first review pass): star-rating rounding now rounds to nearest half star before computing counts (4.8 renders 5 full stars matching the ARIA label); sale badge in product-card now selects prices by `activeCurrency` instead of hardcoding BDT; button `min-h-11 min-w-11` is `pointer-coarse:` prefixed per design.md; checkbox and switch gained 44px coarse-pointer hit areas; mobile nav drawer replaced with Radix Dialog primitive for focus trap, Escape, and focus restoration; star-rating ARIA label uses normalized `safeMax`.
- **Second review fixes**: `apps/web/package.json` devDependencies now declare `@testing-library/jest-dom`, `@testing-library/react`, `@testing-library/user-event`, `happy-dom`, `vite-tsconfig-paths`, and `vitest` so the web workspace type-checks and builds on a clean checkout without relying on root hoisting; `apps/web/tsconfig.json` already excludes test files from the production project.
- **Second review fixes (44px touch targets)**: footer social links changed from `size-10` (40px) to `size-11` (44px); all footer text links and legal links gained `min-h-11 min-w-11` for a 44px hit area while preserving text sizing; breadcrumb home and item links switched to `inline-flex size-11` / `min-h-11 min-w-11` with `px-2`; dialog close button (`<DialogPrimitive.Close>`) now renders as a 44px square via `flex size-11`; file-upload-zone remove button changed from `size="icon-xs"` (24px) to `size="icon-sm"` with explicit `min-h-44px min-w-44px` and `rounded-lg` for a 44px target.

## Acceptance-criteria coverage

- AC-1 covered by token check and reduction step · AC-2 by typecheck and build · AC-3 by the font step · AC-4 by checking `design.md` matches `globals.css` · AC-5 by the theme toggle and `data-theme` step · AC-6 by the toast and build steps · AC-7 by typecheck, lint, and the CVA primitives · AC-8 by the component, resize, and file steps · AC-9 by the focus, touch target, and contrast steps · AC-10 by the ErrorBoundary, EmptyState, and Skeleton steps · AC-11 by the container and admin layout steps · AC-12 by a read of `apps/web/design.md` · AC-13 by the reduced motion and hover steps.
