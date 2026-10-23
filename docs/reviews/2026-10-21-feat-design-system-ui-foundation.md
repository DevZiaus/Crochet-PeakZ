# Review, feat/design-system-ui-foundation, 2026-10-21

**Reviewed by**: GLM-5.3-Flash Free (author on DeepSeek V4.1 Flash Free)
**Scope**: 58 files (excluding package-lock.json, + 1 untracked test), branch vs base (`82e1d991`) including uncommitted working-tree changes
**Verdict**: Changes requested

## Summary

This change delivers spec 0003 end to end: design tokens in `globals.css` mapped through Tailwind v4 `@theme`, Shadcn/Radix primitives under `src/components/ui/`, composed storefront/admin components, dark mode via `next-themes`, design-system fixture routes, `design.md`, and a Vitest suite (36 web tests, green). The latest uncommitted work correctly fixes the mobile drawer positioning (resets `left`/translate/`sm:max-w-lg`) and restores focus to the hamburger on close, and both are covered by a genuine behavioral test. Both prior reviews' blockers are resolved. One new contract problem stands out: `ProductCard` redefines the product type union instead of importing it from `@crochet-peakz/shared`, inventing `MADE_TO_ORDER` and dropping `PRE_ORDER`, which contradicts the data model it is explicitly built to consume. Remaining issues are focused a11y, resilience, and hygiene minors.

## Major

### 🟠 ProductCard product-type union drifts from the shared data model — `apps/web/src/components/product-card.tsx:8-9`

**Problem**: `ProductCard` declares its own `type ProductType = "STANDARD" | "MADE_TO_ORDER" | "ONE_OF_A_KIND" | "CUSTOM" | "DIGITAL"` plus a matching `productTypeBadge` record. The canonical union in `packages/shared/src/types/index.ts:29-37` (mirroring the Prisma enum, spec 0002) is `STANDARD | ONE_OF_A_KIND | PRE_ORDER | CUSTOM | DIGITAL`. So the component invents `MADE_TO_ORDER` (no such store: the badge "Made to Order" can never come from real data) and drops `PRE_ORDER` (a real product kind that this card cannot display a badge for without a type error or a silent miss).

**Why it matters**: Spec 0003's value-sourcing table says ProductCard is purpose-built for Feature #6 (product catalog) to consume the product entity of spec 0002. When the catalog wires this card to entity data, every `PRE_ORDER` product compiles against the wrong type or loses its badge, and the invented `MADE_TO_ORDER` propagates a nonexistent product kind into the UI vocabulary. The same enum will be duplicated in cart/checkout UIs later, compounding the drift. AGENTS.md also directs features to consume shared types and constants rather than redeclaring them.

**Suggested fix**: Import `ProductType` from `@crochet-peakz/shared` and make `productTypeBadge` a `Record<ProductType, …>` with one entry per real enum member (badge labels map `PRE_ORDER` to "Pre-order"; delete `MADE_TO_ORDER`). If the store intends a "made to order" concept, that belongs in the shared enum, not the component.

## Minor

### 🟡 Admin mobile drawer has no focus management — `apps/web/src/components/admin-layout.tsx:172-186`

**Problem**: At mobile widths the admin drawer renders as a plain conditional block: a click-to-dismiss overlay followed by a fixed-position `AdminSidebar`. It has no focus trap, does not move focus into the drawer on open, does not restore focus to the hamburger on close, sets no `aria-modal`, and background content is not inert. Escape is hand-rolled (line 122-141), a Radix Dialog already exists in the codebase and was applied to the storefront drawer for exactly this reason in the 10-17 review fix.

**Why it matters**: While the drawer is open, Tab walks straight through the overlay into the page behind it; closing returns focus to body instead of the button that opened it. This is the same defect class fixed for the storefront drawer, so the codebase now carries two divergent mobile-drawer implementations instead of one.

**Suggested fix**: Model the admin mobile drawer on `MobileNavDrawer` (Radix Dialog with `onCloseAutoFocus` returning focus to the trigger), or minimally add an explicit focus-in/focus-restore sequence and `aria-modal` semantics. Then the duplicated Escape `useEffect` can be deleted.

### 🟡 Admin shell is still fixed to `h-screen` — `apps/web/src/components/admin-layout.tsx:165`

**Problem**: Unresolved finding from the 2026-10-17 review: `h-screen` fixes the shell to `100vh`, which overshoots the visible viewport when mobile browser chrome is expanded and ignores dynamic viewport changes; `docs/specs/0003-design-system/verify.md` records no fix for it.

**Why it matters**: On mobile the admin content can start partially below the fold and the fixed sidebar can be taller than the visible viewport, making the panel feel clipped.

**Suggested fix**: Use `h-dvh` (Tailwind v4 ships it) — the browser support caveat is negligible for this stack; verify the mobile drawer overlay still spans correctly at 320-640px.

### 🟡 StarRating displays and announces the rounded value, not the real rating — `apps/web/src/components/star-rating.tsx:40-49, 78-80`

**Problem**: The 10-17 fix correctly rounds the _visual_ star counts before deriving fills so the graphic can't contradict the accessible name. But the fix went further: `aria-label` (line 49) and the `showValue` readout (line 80) both use the _rounded_ value. A product rated 4.8 is announced and displayed as "5.0 out of 5"; 4.25 renders as "4.5". The rounding operation silently overwrites the actual average rating the design system is supposed to convey to customers.

**Why it matters**: The accessible name for a rating is supposed to report the rating; rounding it to a fake value misleads both screen-reader and sighted users about review quality (worst near the 4.75 threshold, which displays "5.0"). Future features may also read `showValue` as the product's rating.

**Suggested fix**: Keep the visual rounding, but announce/render the true value (e.g. `aria-label="4.8 out of 5 stars"` with the graphic rounded, or aria-valuetext on a semantically richer role) and document the display-rounding rule in `design.md`. The precondition for the 10-17 fix (graphic and label must not contradict each other) is also satisfied by rounding the graphic only, if the label is described as "rounds to 5 stars".

### 🟡 PriceDisplay puts `aria-label` on non-interactive spans — `apps/web/src/components/price-display.tsx:77, 84`

**Problem**: `aria-label` on a plain `<span>` with no role has no reliable screen-reader mapping (WebAIM Screen Reader Survey / ARIA in HTML both flag it as ignored in most AT), so "Price: ৳1,200" is not announced; the visible text is read instead, and for the strike-through line the word "Original" is never announced, only the amount.

**Why it matters**: The strikethrough compare-at price is a sale signal conveyed purely visually; non-sighted users can't tell the new price from the old one.

**Suggested fix**: Render the compare-at price as `<del>` (with `<ins>` or visible discount for the current price) or add an sr-only "original price:" label; drop the unsupported `aria-label`s.

### 🟡 ErrorBoundary swallows errors unless `onError` is passed — `apps/web/src/components/error-boundary.tsx:39-41`

**Problem**: `componentDidCatch` only forwards to the optional `onError` prop; there is no default logging. In production every crashed child tree is reduced to the fallback string with no server/console trace unless the caller remembers to pass `onError`.

**Why it matters**: Silent-failure errors are the classic unresolved production bug: the UI shows "Something went wrong" with the raw child message (which is itself plausible to leak internals, see below) while operators have nothing to search for.

**Suggested fix**: `console.error(error, errorInfo.componentStack)` by default before calling `onError`, and consider rendering `error.message` only outside production (or a generic message in prod) so internal error text isn't surfaced to shoppers.

### 🟡 Test files are excluded from `tsc`, so tests are never typechecked — `apps/web/tsconfig.json:36`

**Problem**: The 10-18 fix added devDependencies by excluding `**/*.test.ts(x)` from the production tsconfig, but no test tsconfig exists; the only typecheck (`npm run typecheck --workspace=@crochet-peakz/web`) now skips all three web test files entirely. Vitest transpiles without typechecking, so type errors in tests surface only as confusing runtime failures.

**Why it matters**: The web test suite can drift (wrong props, renamed exports) with no gate noticing — the exact failure class the last review's blocker was about.

**Suggested fix**: Add a checked-in `tsconfig.test.json` extending the main config that re-includes the test files and run it in the workspace `typecheck` script (or root `typecheck:tests`).

### 🟡 Unused individual `@radix-ui/react-*` dependencies shipped in deps — `apps/web/package.json:24-32`

**Problem**: All eight ui primitives import from the umbrella `radix-ui` package; a source grep for `@radix-ui/react-` returns zero matches, yet seven individual packages (`react-avatar`, `react-checkbox`, `react-dialog`, `react-dropdown-menu`, `react-select`, `react-slot`, `react-switch`) are declared as runtime dependencies (plus a near-duplicate contributing to the ~6k-line lockfile churn).

**Why it matters**: Dead runtime dependencies inflate install time and CI, and invite the next shadcn patch to reintroduce mixed import styles across files.

**Suggested fix**: Remove the seven individual `@radix-ui/react-*` entries (keep `radix-ui`), regenerate the lock, and add a note in the web AGENTS.md/ui convention that primitives import from the umbrella.

## Nits

- ⚪ `apps/web/src/components/ui/button.tsx:27-29`, comment claims the base `min-h-11/min-w-11` "guarantees a 44px touch target" for all sizes — the classes are `pointer-coarse:`-prefixed, so fine-pointer users get 32px on `icon-sm`; reword to match `design.md`'s pointer-coarse convention.
- ⚪ `apps/web/src/components/form-field.tsx:39`, `peer-disabled:cursor-not-allowed peer-disabled:opacity-70` on a label with no `peer` sibling — dead classes copied from Shadcn upstream.
- ⚪ `apps/web/src/components/product-card.tsx:111-117`, sale-badge condition computed in an inline IIFE inside JSX — hoist `hasSale` next to `badgeConfig` for readability and easier unit testing.
- ⚪ `apps/web/src/components/file-upload-zone.tsx:166-172`, Space is preventDefault'd on `keyup` only, so holding Space scrolls the page before the picker opens (implicit buttons prevent it on `keydown`); also `processFiles` (line 137) re-selecting the same file appends duplicates with no dedupe.
- ⚪ `apps/web/src/components/footer.tsx:90`, `new Date().getFullYear()` in a server-rendered component freezes the year at build time and re-hydrates mismatched around New Year; hoist to the policy-constant list.
- ⚪ `docs/scope/scope.md:98`, milestone sub-checklist (AC-1…AC-12 items) collapsed into one bullet — broken markdown formatting from the status update.
- ⚪ `apps/web/src/components/divider.tsx:33`, `role="separator"` on a semantic `<hr>` (already separator semantics); drop the role.
- ⚪ `nextStep.txt` still tracked in git — workflow scratch file churn on every task; keep it untracked.

## Strengths

- The latest uncommitted drawer fix addresses the real root cause (the shared centered `DialogContent` translate/`sm:max-w-lg` leaking into the drawer class) rather than patching symptoms, and it locked in a regression test (`header.test.tsx:204-221`) plus true behavioral coverage of the focus trap, Escape, and focus restoration (`header.test.tsx:135-148, 167-187`).
- The `ThemeToggle` hydration guard (useSyncExternalStore with a neutral pre-hydration accessible name, with the icon swap left to pure CSS) is a genuinely elegant fix for a subtle next-themes hydration-mismatch trap, clearly explained at `header.tsx:55-66`.
- Every finding from both prior reviews was concretely resolved and re-verified (rounding, sale-badge currency, coarse-pointer targets, declared test dependencies), and all gates are green today: `tsc` clean, ESLint clean, 36 web tests pass.

## Test coverage

Covered well: StarRating threshold/edge behavior (rounding, clamping, NaN, fractional `maxStars`), AdminSidebar collapse/labels and the mobile drawer lifecycle (open/close, Escape, `toggleLabel`), and the storefront header/drawer incl. focus management. Gaps: FileUploadZone has the branchiest logic in the feature (accept matching, size validation, multiple/single accumulation, remove-file list) and zero tests; PriceDisplay currency/discount branching, ProductCard (incl. the sale-badge currency fix from 10-17), QuantityStepper bounds, and the ErrorBoundary fallback/retry are likewise untested. The star-rating RTL tests partially assert implementation details (SVG counts via `.fill-accent.text-accent` class name queries) rather than only behavior — they do also assert `aria-label`/values, so it's a mixed but acceptable pattern. Note also that test files are excluded from typecheck (see Minor above), which weakens the drift protection the 10-18 fix intends.
