# Review, feat/design-system-ui-foundation, 2026-10-21 (re-review r2)

**Reviewed by**: GLM-5.3-Flash Free (author on DeepSeek V4.1 Flash Free)
**Scope**: 60 files (excluding package-lock.json, + 3 untracked files), branch vs base (`82e1d991`) including uncommitted working-tree changes
**Verdict**: Approve with nits

## Summary

This re-review confirms the previous review's one major is genuinely resolved: `ProductCard` now imports `ProductType` and `CurrencyCode` from `@crochet-peakz/shared`, `productTypeBadge` is an exhaustive `Record<ProductType, …>` with `PRE_ORDER → "Pre-order"`, `MADE_TO_ORDER` is gone from all code, `PriceDisplay` dropped its local currency union, and a new untracked test renders all five canonical product types and asserts each badge. The fix is complete and the test would have caught the old defect. No new majors and no new minors were introduced. All seven minors from the prior review remain open (none were addressed in this round, none regressed further); they are carried forward below unchanged in substance.

## Major

(none — the previous major, ProductCard's divergent product-type union, is resolved; verified against `packages/shared/src/types/index.ts:29-38`, which is exactly the union the component now consumes)

## Minor

### 🟡 Admin mobile drawer has no focus management — `apps/web/src/components/admin-layout.tsx:172-186` (carry-over)

**Problem**: Unchanged since the last review. At mobile widths the admin drawer is still a plain conditional block: a click-to-dismiss overlay plus a fixed-position `AdminSidebar`. No focus trap, no focus-in on open, no focus restore to the hamburger on close, no `aria-modal`, background content not inert. Escape is hand-rolled at lines 168-179 while a Radix Dialog already exists in the codebase and was applied to the storefront drawer for exactly this reason.

**Why it matters**: Tab walks through the overlay into the page behind the open drawer; closing returns focus to body. The codebase now carries two divergent mobile-drawer implementations for the same defect class.

**Suggested fix**: Model the admin mobile drawer on `MobileNavDrawer` (Radix Dialog with `onCloseAutoFocus` restoring focus to the trigger), then delete the duplicated Escape `useEffect`.

### 🟡 Admin shell is still fixed to `h-screen` — `apps/web/src/components/admin-layout.tsx:165` (carry-over)

**Problem**: Unresolved from the 2026-10-17 review and still unrecorded as fixed in `docs/specs/0003-design-system/verify.md`. `h-screen` pins the shell to `100vh`, which overshoots the visible viewport when mobile browser chrome is expanded and ignores dynamic viewport changes.

**Why it matters**: On mobile the admin content can start below the fold and the fixed sidebar can be taller than the visible viewport.

**Suggested fix**: Use `h-dvh` (Tailwind v4 ships it); re-verify the mobile overlay at 320-640px afterwards.

### 🟡 StarRating displays and announces the rounded value, not the real rating — `apps/web/src/components/star-rating.tsx:49, 84` (carry-over)

**Problem**: The visual rounding fix is right, but `aria-label` (line 49) and the `showValue` readout (line 84) both emit the rounded value: 4.8 is announced and shown as "5 out of 5 stars"; 4.25 shows "4.5". The true average rating never reaches the customer.

**Why it matters**: The rating signal is silently distorted near thresholds (4.75+ displays a perfect 5.0); future features reading `showValue` inherit the fake value.

**Suggested fix**: Keep the graphic rounding, announce/render the true value, and document the display-rounding rule in `design.md`.

### 🟡 PriceDisplay puts `aria-label` on non-interactive spans — `apps/web/src/components/price-display.tsx:76, 83` (carry-over)

**Problem**: `aria-label` on a plain `<span>` with no role has no reliable screen-reader mapping, so "Price: …" and especially "Original price: …" (the strike-through compare-at price) are never announced.

**Why it matters**: The sale signal conveyed by the strikethrough is purely visual; non-sighted shoppers cannot distinguish the old price from the current one.

**Suggested fix**: Render the compare-at price as `<del>` (or add an sr-only "original price" label) and drop the unsupported `aria-label`s.

### 🟡 ErrorBoundary swallows errors unless `onError` is passed — `apps/web/src/components/error-boundary.tsx:39-40, 72` (carry-over)

**Problem**: `componentDidCatch` forwards only to the optional `onError`; there is no default logging. The fallback also renders raw `error.message` (line 72) to end users.

**Why it matters**: In production a crashed child tree shows "Something went wrong" with potentially internal error text, while operators have no console/server trace to search for.

**Suggested fix**: `console.error(error, errorInfo.componentStack)` by default before calling `onError`, and render a generic message in production, reserving `error.message` for development.

### 🟡 Test files are excluded from typecheck and lint — `apps/web/tsconfig.json:36`, `apps/web/eslint.config.mjs` (globalIgnores) (carry-over)

**Problem**: Unchanged from the last review and now more consequential: the web suite has grown to 4 test files (41 tests) and every one of them is skipped by `tsc --noEmit` and ignored by ESLint. Vitest transpiles without typechecking, so type errors in tests surface only as confusing runtime failures.

**Why it matters**: The suite is the regression guard for contract fixes like this round's ProductType change — but nothing gates those test files from drifting (renamed exports, wrong props) except running them.

**Suggested fix**: Add a checked-in `tsconfig.test.json` re-including the test files and run it in the workspace `typecheck` script; un-ignore tests in ESLint or justify the exclusion.

### 🟡 Unused individual `@radix-ui/react-*` dependencies shipped in deps — `apps/web/package.json:17-23` (carry-over)

**Problem**: Re-verified: all eight UI primitives import from the umbrella `radix-ui` package; a source grep for `@radix-ui/react-` returns zero matches, yet seven individual packages remain declared as runtime dependencies.

**Why it matters**: Dead runtime dependencies inflate install time and CI, and invite the next Shadcn patch to reintroduce mixed import styles.

**Suggested fix**: Remove the seven individual `@radix-ui/react-*` entries (keep `radix-ui`), regenerate the lock, and note the umbrella-import convention in `apps/web/AGENTS.md`.

## Nits

Carry-over from the prior review (all re-verified as still present):

- ⚪ `apps/web/src/components/ui/button.tsx:27-29`, the comment still claims the base `min-h-11/min-w-11` "guarantees a 44px touch target" for all sizes — the classes are `pointer-coarse:`-prefixed; reword to match the `design.md` pointer-coarse convention.
- ⚪ `apps/web/src/components/form-field.tsx:39`, `peer-disabled:…` on a label with no `peer` sibling — dead Shadcn-upstream classes.
- ⚪ `apps/web/src/components/product-card.tsx:109-117`, sale-badge condition still computed in an inline IIFE inside JSX — hoist `hasSale` beside `badgeConfig`.
- ⚪ `apps/web/src/components/file-upload-zone.tsx:166-172`, Space is preventDefault'd on `keyup` only (holding Space scrolls the page first); `processFiles` (line 96) also re-selecting the same file appends duplicates with no dedupe.
- ⚪ `apps/web/src/components/footer.tsx:90`, `new Date().getFullYear()` freezes the year at build time on server-rendered pages; hoist to the policy-constant list.
- ⚪ `apps/web/src/components/divider.tsx:31`, `role="separator"` on a semantic `<hr>`.
- ⚪ `docs/scope/scope.md:96-98`, the milestone sub-checklist is collapsed into one bullet — broken markdown from the status update.
- ⚪ `nextStep.txt` still tracked in git — scratch-file churn on every task.

New this round:

- ⚪ `apps/web/src/components/product-card.tsx:157` and `apps/web/src/components/price-display.tsx:93`, both re-export the shared types (`ProductType`, `CurrencyCode`) they just started importing — a second import path for types that `@crochet-peakz/shared` already owns per the AGENTS.md "import from shared" rule; import consumers from shared directly.
- ⚪ `apps/web/src/app/design-system/page.tsx:77-90`, the SVG data-URI fixtures hardcode raw hex values (`#e7efee`, `#0f5c5c`, `#b07d22`) — they mirror tokens but never adapt to dark theme; acceptable for the temporary showcase, worth a comment noting it.
- ⚪ `apps/web/src/components/file-upload-zone.tsx:14-16`, `formatBytes` renders 1 TB as "1024.0 B" (`units[4]` is undefined); drop `?? "B"` in favor of clamping the index.
- ⚪ `apps/web/src/components/admin-layout.test.tsx:18-21` declares a local `vi.mock("next/navigation")` with a hand-rolled indirection while `src/test/setup.ts` already provides a global `vi.fn()` mock that `header.test.tsx` relies on — pick one convention.

## Strengths

- The shared-type fix is correct and complete: `ProductCard` consumes the canonical `ProductType` union, the badge map is exhaustive over it (so the next enum addition in shared fails production typecheck rather than silently dropping a badge), `PRE_ORDER` maps to a real "Pre-order" badge, and `PriceDisplay`'s parallel fix removes the duplicated `BDT | USD` union at its source.
- The new `product-card.test.tsx` is exactly the right regression test: it drives all five badges with the canonical _value constants_ from `ProductType` itself, so it stays in sync if the enum changes, and it would have caught the old defect at runtime (a missing map entry silently renders no badge, and `screen.getByText("Pre-order")` fails).
- The header/drawer test suite asserts real shopper behavior (focus trap, Escape, focus restoration, drawer positioning regression guard explicitly documented as a CSS-cascade guard), and `verify.md` continues to be updated with honest root-cause notes for each fix round.

## Test coverage

Covered well: StarRating rounding/threshold/edge behavior (11 tests), AdminSidebar collapse/labels and the admin mobile drawer lifecycle (14 tests), storefront header + Radix drawer behaviors including the positioning regression guard (11 tests), and now the full ProductType badge contract (5 new tests, 41 web tests total, green alongside typecheck/lint/build).

Gaps (carried over): the sale-badge and currency-selection branching in `ProductCard` and `PriceDisplay` — including the 10-17 currency fix — remains untested; `FileUploadZone` still has zero tests despite being the branchiest logic in the feature (accept matching, size validation, multi/single accumulation, remove); `QuantityStepper` bounds and `ErrorBoundary` fallback/retry are likewise untested. The new badge test renders badges only — it does not exercise `inStock` or the Sale badge interaction with two badges stacking. Additionally, no test file is typechecked or linted (see the tsconfig/eslint minor), which weakens the drift protection these suites are meant to provide.
