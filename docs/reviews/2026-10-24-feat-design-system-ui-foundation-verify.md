# Review, feat/design-system-ui-foundation, 2026-10-24 (verify round 5)

**Reviewed by**: GLM-5.3-Flash (fresh reviewer, did not author the code)
**Scope**: 59 tracked files vs merge base 82e1d99, plus the 16 untracked files (branch vs main); the uncommitted round-4/5 fix diff and all new tests read in full
**Verdict**: Approve with nits

## Summary

Spec 0003 is complete and now clean across five review rounds. This pass verified the fourth round's fixes against the actual code rather than the claims: the `multiple={false}` drag-and-drop bypass is enforced in `processFiles`, the Radix Dialog rebuild of both drawers gives real `aria-modal`/inerting with `useCloseOnDesktop` closing them across the `lg` breakpoint (with reason-aware focus restoration), `FormField` clones `id`/`aria-describedby`/`aria-invalid`/`aria-required` onto its control, `Switch` reaches 44×44 on coarse pointers via padding + a `::before` hit area, the PRE_ORDER/CUSTOM overlay badges use solid `secondary` fills, Button/Badge hover on the `--primary-hover` token, destructive Badge lost the alpha ring, and the showcase routes are `noindex` with the removal tracked in scope. I ran the suite myself: 79/79 tests pass across 10 files, `typecheck` (production + `tsconfig.test.json`) passes, `eslint` passes. What remains is three small minors (an admin-drawer navigation papercut, an untested remove path in `FileUploadZone`, and one ARIA state gap in the same component) and the intentionally deferred nits from earlier rounds. No blockers, no majors.

## Blockers

None.

## Major

None. All four majors from the previous rounds are verifiably fixed (details under Strengths/Test coverage).

## Minor

### 🟡 Admin drawer nav links navigate but leave the modal open, `apps/web/src/components/admin-layout.tsx:206-210`

**Problem**: Inside the mobile drawer, `AdminSidebar` is rendered with `onToggle={closeMobile}` — which only wires the sidebar's collapse button ("Close admin navigation"). The nav `<Link>`s (`admin-layout.tsx:110-127`) have no dismiss behavior. Tapping "Products" on mobile performs the client navigation with the page behind inert (Radix keeps `aria-modal`, focus trapping, and the scroll lock), and the drawer stays on top until the user finds the toggle. The storefront drawer closes on every link (`header.tsx:176`, `onClick={onClose}`), so the two navigation shells behave differently for the same action.

**Why it matters**: The admin sidebar is the base shell every Slice 1+ admin page assembles on; the first real mobile admin navigation will surprise users. It also silently breaks the tab-invariant focus story the tests assert — after navigation the focus trap still holds focus in a drawer describing a stale route.

**Suggested fix**: Give `AdminSidebar` an optional `onNavigate?: () => void` prop invoked on each link click, and pass `closeMobile` from the mobile drawer instance only (the desktop sidebar passes nothing); assert "choosing a nav item closes the drawer" in the drawer test.

### 🟡 `FileUploadZone` disabled state is invisible to assistive technology, `apps/web/src/components/file-upload-zone.tsx:199-232`

**Problem**: The drop zone advertises `role="button"`, but when `disabled` it only sets `tabIndex={-1}`, `pointer-events-none`, and opacity. No `aria-disabled="true"` (or `aria-hidden`) is exposed, so a screen reader announces an enabled button that does nothing; keyboard users get no signal either (focus simply skips it.

**Why it matters**: This is the base upload primitive the spec hands to admin features; WCAG 2.1 AA 4.1.2 (name/role/value) is the project's stated baseline, and state is exactly what it covers. The hidden native input carrying the real semantics makes it easy to forget the visible control.

**Suggested fix**: Set `aria-disabled={disabled || undefined}` on the role="button" div (keeps it discoverable, unlike `aria-hidden`), and add a one-line test that the attribute flips with the prop while you are in the file.

### 🟡 `FileUploadZone.removeFile` and the disabled guards are the only uncovered new logic, `apps/web/src/components/file-upload-zone.tsx:181-186`

**Problem**: The round-4 test additions cover selection limits, dedupe, type/wildcard validation, size boundaries, and Space semantics — good. Remaining uncovered: `removeFile` (the only code path that shrinks the list and re-emits `onFiles`), the disabled click/drop guards, and the `defaultDescription` accept-label formatting. `removeFile` is stateful branching logic by the review bar.

**Why it matters**: The admin features will build file management on this list (remove, re-order, replace); a regression in the remove path would silently desync `onFiles` from what the list shows, and nothing in CI would catch it.

**Suggested fix**: Two cheap tests: click "Remove yarn.png" after selecting two files and assert one list item plus `onFiles` called with the remainder; render with `disabled` and assert drop/change are ignored.

## Nits

- ⚪ `apps/web/src/hooks/use-close-on-desktop.ts:30-42`, the `change` listener subscribes one render after `open` becomes true; a viewport crossing landing in that window re-creates the invisible-modal state (Escape-only recovery). Acceptable race, worth a comment or listening immediately.
- ⚪ `apps/web/design.md:248-251`, accessibility rule 3 says targets are "reached with padding so the visual size stays" — literally true for Button/Input/Select but not for Switch (its track grows to 44px tall on coarse pointers) or Checkbox (`-m-3.5` size growth). Document the two techniques so the next control doesn't pick a third.
- ⚪ `apps/web/src/components/ui/dialog.tsx:76`, the dialog close button still uses `focus:ring-2` where every other control uses the `focus-visible:` convention (deferred from round 4).
- ⚪ `apps/web/src/components/ui/select.tsx:57`, default `position="item-aligned"` still diverges from Shadcn's `popper`, and the scroll buttons render for both positions (deferred).
- ⚪ `apps/web/src/components/ui/dropdown-menu.tsx:44`, `animate-in/out` still runs at tw-animate's 150ms default; design.md's floor is 200ms (deferred).
- ⚪ `apps/web/src/components/ui/skeleton.tsx:19-24`, inline `style` still precedes `{...props}`, so a caller's `style` replaces the shimmer gradient instead of merging (deferred).
- ⚪ `apps/web/src/components/empty-state.tsx:49`, always renders `<h3>`; used directly under an h1 it skips a heading level (deferred).
- ⚪ `apps/web/src/components/ui/card.tsx:30`, `CardTitle` still renders a `div` — no heading semantics in fixture cards (deferred).
- ⚪ `apps/web/src/components/ui/input.tsx:15`, `pointer-coarse:mb-[-4px]` magic-number compensation still shifts form rhythm 4px on touch (deferred).
- ⚪ `apps/web/src/components/product-card.tsx:98`, `sizes` still claims 25vw at ≥1024px where design.md's grid is 3 columns at `lg` (deferred).
- ⚪ `apps/web/src/components/header.tsx:355` (also `admin-layout.tsx:244`, `product-card.tsx:156`): internal constants (`navLinks`, `adminNavItems`, `productTypeBadge`) remain exported — now load-bearing test imports, but still part of the public API (deferred).
- ⚪ Hit-area conventions are two coexisting systems: hardcoded `min-h-[44px] min-w-[44px]` (header/admin/footer/upload) versus the documented `pointer-coarse:` technique (Button/Input/Select). Consolidate when the next control lands (deferred).
- ⚪ `apps/web/src/components/ui/*.tsx`, primitives still carry no TSDoc while composed components are exemplary (deferred).
- ⚪ `apps/web/src/test/setup.ts:7-14`, `useRouter` mock still returns fresh `vi.fn()`s per import; assertions on router calls would be brittle (deferred).
- ⚪ `eslint.config.mjs:56-58` (root), the new `function` naming selector allows PascalCase for _all_ functions, not just React components — camelCase for plain functions is no longer enforced. Narrow it if the intent was component-only.
- ⚪ `docs/specs/0003-design-system/verify.md:76` vs `:5`, the fourth-review-fixes line says "74 tests" while the final count (and reality) is 79 — stale copy inside the same document.
- ⚪ `apps/web/src/components/breadcrumbs.tsx:54-58`, a mid-trail item without `href` gets `aria-current="page"` alongside the true current page; the JSDoc condones it but ARIA allows one current page.

## Strengths

- The round-4 fixes are root-cause fixes, not symptom patches: the single-file limit lives in `processFiles` with a comment explaining _why_ the picker alone is insufficient; the breakpoint close is a shared, documented hook (`useCloseOnDesktop`) whose `CloseReason` cleanly drives the focus-restore fallback (hamburger vs home link vs `main`) instead of a visibility heuristic.
- Verification by execution this round: 79/79 tests pass, `tsc --noEmit` for both production and test tsconfigs passes, `eslint` passes — all invoked in a clean checkout state.
- Test suite quality grew with the code: every reviewed branch now has a regression test (multi-file drop onto a single-file zone keeps exactly one; dedupe by name/size/lastModified; wildcard `image/*`; over-size rejected, exactly-at-limit accepted; FormField id/`aria-describedby` merge preserving caller-supplied hints; stepper clamps an out-of-range value; both drawers close on the breakpoint cross _and_ land focus on a visible target).
- `StarRating` now tells the truth: the graphic rounds to the nearest half, but the accessible name and readout carry the real average (4.8/4.25/4.75 all tested) — the honest-rating principle is encoded in the component's contract and in design.md.
- The tooling hole closed this round is significant: test files are now typechecked (`tsconfig.test.json` wired into `typecheck` and into ESLint's `project`), so future test drift is caught at the gate, not in review.
- `verify.md` continues to be a model record — this round's browser checks include a scratch harness exercising `FileUploadZone multiple={false}` prop combinations no route renders, at three widths with coarse pointer, reduced motion, and both themes.

## Test coverage

Configured (Vitest + RTL, happy-dom; 10 files / 79 tests, all passing; run independently for this review). Covered this round: single-file drop limiting, duplicate suppression, type/wildcard/size validation incl. the exact boundary, `formatBytes` TB clamp, Space scroll prevention, FormField ARIA wiring incl. caller-value merging and the required flag, QuantityStepper bounds and clamping, both drawers' breakpoint close + focus restoration (trigger and fallback targets), overlay count and `lg:hidden` class guards, drawer position-cascade regression, Badge/Button token variants (hover + focus ring), ErrorBoundary logging/`onError`/production copy gating/retry, StarRating true-value labels at both rounding thresholds, ProductCard badge map incl. PRE_ORDER and solid-fill contract, PriceDisplay `<del>` semantics and currency pinning. Not covered: `FileUploadZone.removeFile` and disabled guards (Minor above), Breadcrumbs last-item/no-href branches (unchanged, noted in prior rounds). Theme persistence and real pointer behavior rest on `/check verify` (E2E is `none-by-design`), which this round's verify.md records as done.
