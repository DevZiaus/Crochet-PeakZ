# Review, feat/design-system-ui-foundation, 2026-10-24

**Reviewed by**: GLM-5.3-Flash (fresh reviewer, did not author the code)
**Scope**: 59 files, branch vs merge base 82e1d99 (53 tracked files in review focus + 6 untracked)
**Verdict**: Changes requested

## Summary

Spec 0003 is implemented almost completely: tokens, fonts, next-themes, all 13 Shadcn primitives (via the `radix-ui` umbrella, CVA + `cn`), all 15 composed components, storefront/admin shells, showcase routes, `design.md`, and a genuinely good Vitest/RTL suite. Accessibility engineering is above average (focus restoration, honest ARIA ratings, coarse-pointer targets, measured contrast tables). One real functional bug survives in `FileUploadZone` (`multiple={false}` is bypassed by drag-and-drop), and there is a handful of smaller adherence gaps where components diverge from the project's own documented rules in `design.md` (Badge focus ring, Switch width, unused `--primary-hover` token). Nothing is blocking on security or data-integrity grounds.

## Blockers

None.

## Major

### 🟠 `multiple={false}` is not enforced on drag-and-drop, `apps/web/src/components/file-upload-zone.tsx:123`

**Problem**: In `processFiles`, the non-multi path is `if (!multiple) { commitSelection(processed); return; }` — `processed` contains every file passed in. The native picker limits selection to one file (`multiple={false}` on the input), but `handleDrop` feeds `e.dataTransfer.files` straight into `processFiles`, and a multi-file drag bypasses that limit entirely: drop 3 files onto a single-file zone and all 3 are listed and forwarded via `onFiles([f1, f2, f3])`.

**Why it matters**: `FileUploadZone` is the base upload primitive the spec hands to the upcoming admin features (single product image, avatar, digital asset). Callers contractually receive more files than the component promised to allow, and the file list renders rows for files the zone was configured to reject. This is precisely the kind of latent contract break this foundation exists to prevent. No test covers the `multiple=false` drop path.

**Suggested fix**: In `processFiles`, when `!multiple`, keep only one file from the incoming batch (e.g. the last dropped, matching single-file picker semantics) before `commitSelection`, and drop the rest; add a regression test that drops two `File`s with `multiple={false}` and asserts `onFiles` received exactly one.

## Minor

### 🟡 Badge `destructive` focus ring violates the project's own rule, `apps/web/src/components/ui/badge.tsx:15`

**Problem**: `focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40` keeps the upstream alpha-tinted ring. `apps/web/design.md` (Accessibility rule 1) says "Every variant keeps the token ring… never tinted: a 20% alpha ring measures about 1.15:1 … far below the 3:1", and `button.tsx:12-18` documents removing this exact override from Button for that reason. Badge is the one place it survived.

**Why it matters**: A badge rendered as a link (`asChild`, e.g. a destructive filter chip) is interactive and gets a near-invisible focus indicator — an AC-9 miss committed straight into the pattern library every later feature copies. Inconsistent with the fixed Button.

**Suggested fix**: Delete the two alpha-ring utilities so the destructive badge inherits the token ring, mirroring button.tsx.

### 🟡 FormField does not wire `aria-describedby`/`aria-invalid`, and label association is optional, `apps/web/src/components/form-field.tsx:26-61`

**Problem**: The wrapper renders `description` and `error` purely visually; neither is linked to the control via `aria-describedby`, and nothing sets `aria-invalid` (so the Input's `aria-invalid:border-destructive` styling never triggers unless the caller remembers). `htmlFor` is optional — if the caller omits it, the `<label>` is associated with nothing, silently. The JSDoc claims it "Associates the label with the input via htmlFor for accessibility", which is only true when the caller passes the id.

**Why it matters**: Every Slice 1 form assembles on this wrapper; screen readers won't announce descriptions, error text is only half-associated (`role="alert"` is present, good), and the easiest correct path produces implicit label association.

**Suggested fix**: Require `htmlFor` (every form control in this system has an id), and document (or provide via render-slot props) the `aria-describedby`/`aria-invalid` contract the caller must pass; at minimum correct the JSDoc to state the caller's obligations.

### 🟡 Switch stays 32px wide on touch, below the documented 44×44 target, `apps/web/src/components/ui/switch.tsx:19-22`

**Problem**: The coarse-pointer override grows the height (`pointer-coarse:h-11`) but keeps `data-[size=default]:w-8` (32px) and `data-[size=sm]:w-6`. `design.md` (Accessibility rule 3) commits to "44px in both dimensions for anything interactive". Checkbox solved the same problem on the width axis with `pointer-coarse:-m-3.5`.

**Why it matters**: The switch is the one control whose hit area contradicts the documented baseline; thumb-accuracy on a 32px-wide moving target is exactly what the rule guards.

**Suggested fix**: Extend the hit box horizontally on coarse pointers (padding + negative margin, or `pointer-coarse:w-11 pointer-coarse:-mx-1.5` with the thumb track unchanged), or explicitly document why switches are exempt.

### 🟡 Unlabeled-by-test branching logic in two commerce primitives

**Problem**: `QuantityStepper`'s min/max clamping (`quantity-stepper.tsx:35-36,52,73`) and `FileUploadZone.validateFile`'s accept-type and size-limit branches (`file-upload-zone.tsx:87-106`) have no unit tests. The suite covers shells, star rating, price, error boundary, dedupe, and the Space key — but not the two stateful components' core branch logic.

**Why it matters**: Per the review bar, new branching logic without coverage is a finding; these are the components admin features will convene on first, and both have already been reworked once across review rounds (which is how the `multiple=false` bug above slipped through).

**Suggested fix**: `/test` should add table-driven cases: stepper at `min`/`max`/`value < min`, and validation for accept-mismatch, wildcard `image/*`, over-size, and exactly-at-limit files.

### 🟡 `outline` product-type badges render transparent over arbitrary photos, `apps/web/src/components/product-card.tsx:107-111` + `apps/web/src/components/ui/badge.tsx:17`

**Problem**: `PRE_ORDER` and `CUSTOM` map to Badge `outline`, whose background is transparent with `text-foreground`; ProductCard absolutely positions these on top of the product image.

**Why it matters**: Near-black text over an unpredictable photo fails WCAG 1.4.3 whenever the image is dark or busy — the badges are machine-positioned overlays, not designer-planned, so contrast is unbounded. Sold Out/Sale/secondary/default variants have solid fills and are fine.

**Suggested fix**: Give the overlay badges a solid token fill (e.g. `bg-card` + border, or map both types to `secondary`) inside ProductCard, keeping `outline` for inline use on flat surfaces, or reserve the overlay slot for solid token pairs only.

### 🟡 Drawer left open across the `lg` breakpoint becomes an invisible modal, `apps/web/src/components/header.tsx:112-131` and `apps/web/src/components/admin-layout.tsx:168-193`

**Problem**: Both drawers are dialogs whose content and overlay are hidden with `lg:hidden`, but nothing closes the dialog when the viewport crosses 1024px. If a user opens the menu and then widens the window, the Radix dialog is still open: background is inert (`aria-modal` + scroll lock/`pointer-events: none` applied by Radix), focus is trapped inside an element that is `display: none`.

**Why it matters**: The page appears frozen — clicks are swallowed by the scroll lock and keyboard focus is invisible — with Escape as the only recovery. An edge case, but a nasty one, and it affects both shells.

**Suggested fix**: Close the drawer on breakpoint change (a `matchMedia("(min-width: 1024px)")` listener calling `onClose`, or a responsive `opts.matchMedia`-driven dismissal), mirroring the pattern Radix itself recommends.

### 🟡 `--primary-hover` token is defined and documented but never used, `apps/web/src/app/globals.css:9,65` and `apps/web/design.md:36`

**Problem**: Both themes define `--primary-hover` (AC-1 token), `@theme` maps it (`globals.css:99`), `design.md` documents it as "Hover state for primary buttons" — yet Button (`button.tsx:11`) and Badge use `hover:bg-primary/90` (opacity blend instead of the darker/lighter token).

**Why it matters**: First token-coherence crack in the system the spec calls "the single reference": a dead token invites future authors to pick again, and `/90` over the light `#0f5c5c` produces a lighter, lower-contrast hover rather than the documented deep-teal one.

**Suggested fix**: Either use `hover:bg-primary-hover` (preferable — matches design.md, and dark theme gets the brightened variant it was designed for) or remove the token and its doc row.

### 🟡 Temporary fixture routes ship publicly to production, `apps/web/src/app/design-system/page.tsx:126` and `apps/web/src/app/design-system/admin/page.tsx:71`

**Problem**: Both showcase routes are documented "Remove this route before … ships", but they merge into `main` now and will be publicly prerendered and routable (`poweredByHeader: false` notwithstanding) for however long that takes.

**Why it matters**: Public fixture pages (containing the deliberate non-token hex fixtures and an on-demand error thrower) on the production storefront, plus an as-yet-unlinked `/design-system` destination that real users can reach; removal-at-launch is an implicit promise nobody tracks.

**Suggested fix**: Add the removal as a tracked follow-up in the scope (or an env guard / `robots` exclusion until the real pages replace them), and keep the verify.md instructions for driving the routes from a branch.

## Nits

- ⚪ `apps/web/src/components/ui/select.tsx:57`, default `position="item-aligned"` diverges from Shadcn's `popper`; the popper classes and scroll buttons are dead weight for the default — confirm the overlay behavior is intentional.
- ⚪ `apps/web/src/components/ui/dialog.tsx:76`, close button uses `focus:ring-2` where every other control uses the `focus-visible:` convention.
- ⚪ `apps/web/src/components/ui/dropdown-menu.tsx:44`, `animate-in/out` runs at tw-animate-css's 150ms default; design.md's transition floor is 200ms (add `duration-200` alongside the base `duration-200` used in dialog.tsx:67).
- ⚪ `apps/web/src/components/header.tsx:85,142,254,266,281,291,303` (and quantity-stepper.tsx:56,77, file-upload-zone.tsx:294): hardcoded unconditional `min-h-[44px] min-w-[44px]` instead of the documented `pointer-coarse:` / `min-h-11` technique — more conservative than the doc, but now two hit-area conventions coexist.
- ⚪ `apps/web/src/components/ui/input.tsx:15`, `pointer-coarse:mb-[-4px]` half-compensates the +8px height with a magic number and shifts form rhythm by 4px on touch — brittle; document or center with `pointer-coarse:flex` instead.
- ⚪ `apps/web/src/components/product-card.tsx:96`, `sizes` claims 25vw at ≥1024px but design.md's own grid is 3 columns at `lg` (~33vw) and 4 at `xl` inside a 1280px container (≤320px actual) — images under-sized in the lg band and over-fetched above 1280px; suggest `(max-width: 1280px) 33vw, 320px` style sizes.
- ⚪ `apps/web/src/components/product-card.tsx:154` (also `admin-layout.tsx:219`, `header.tsx:322`): exporting internal constants (`productTypeBadge`, `adminNavItems`, `navLinks`) widens the public API; tests can exercise via rendering.
- ⚪ `apps/web/src/components/ui/skeleton.tsx:19-23`, the inline `style` precedes `{...props}`, so a caller-supplied `style` replaces the shimmer gradient entirely instead of merging.
- ⚪ `apps/web/src/components/empty-state.tsx:49`, always renders `<h3>`; used directly under an h1 it skips a heading level — consider `headingLevel` prop or `<p role="heading">`.
- ⚪ `apps/web/src/components/ui/card.tsx:30`, `CardTitle` renders a `div`; cards with titles have no heading semantics (default Shadcn behavior, but admin fixture cards are effectively unlabelled sections).
- ⚪ `apps/web/src/components/ui/*.tsx`, generated primitives carry no TSDoc while every composed component thoroughly documents — the "document all public APIs" rule is relaxed in practice (return types only) for `ui/`; acceptable, but a header line per file (`# Generated by shadcn, customized to tokens`) would help future merges from upstream.
- ⚪ `apps/web/src/test/setup.ts:7-17`, hand-written router mocks; `vitest` module-mock of only what's used (`usePathname`) would drift less, and `useRouter` returning fresh `vi.fn()`s per import can surprise future tests asserting call counts.

## Strengths

- `apps/web/design.md` is a genuinely exceptional reference: a measured contrast table that _documents the failing tokens_ (`--accent` 3.4:1 as non-text-only) rather than pretending they pass, per-surface usage rules, and hit-area technique per control kind.
- Accessibility groundwork that usually gets skipped is present and tested: focus returned to the opening hamburger with a regression test, tab-invariant focus traps in both drawers, `useSyncExternalStore` guarding ThemeToggle's label against hydration mismatch, truthful star-rating ARIA labels (graphic rounds, label doesn't), Space/Enter semantics on the drop zone.
- Test suite quality is high where it exists — the admin/header drawer tests assert the real contract (overlay count, `aria-modal`, focus containment, focus restoration, the CSS-cascade drawer-position bug from the earlier round), and `product-card.test.tsx` documents the PRE_ORDER contract regression it guards.
- Token hygiene verified end-to-end: hard-coded color grep documented in verify.md, `@theme inline` wiring matches `design.md` (spot-checked, values are identical), reduced-motion handled both globally and per-animation.
- `verify.md` is a model verification record: multiple re-verification passes, browser checks at real breakpoints with a coarse pointer, and every review round's fixes enumerated.

## Test coverage

Configured (Vitest + RTL, `happy-dom`, 7 files / 59 tests — all pass on this branch; `typecheck` passes for both production and test tsconfigs, also both run in CI-equivalent `npm run typecheck`). Well covered: both navigation shells incl. drawers/focus/Escape, star-rating rounding/clamping edge cases, price display sale semantics and currency pinning, error boundary incl. production-copy env stubbing, file dedupe and Space handling, product-type badge contract. Not covered (beyond the Major/minors above): `QuantityStepper` clamps, `FileUploadZone.validateFile` and its `multiple=false` drop path, `Breadcrumbs` last-item/no-href logic, `ProductCard` sold-out/sale branches. E2E is `none-by-design` per the project, so browser-level flows (theme persistence, scroll reveal, real drag-and-drop) rest on `/check verify` — noted, not counted against the suite.
