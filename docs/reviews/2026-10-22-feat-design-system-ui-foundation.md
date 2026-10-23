# Review, feat/design-system-ui-foundation, 2026-10-22

**Reviewed by**: MiniMax M3.1 Flash Free (author on DeepSeek V4.1 Flash Free)
**Scope**: 67 files (59 modified + 8 new), branch vs base (`main` @ `82e1d99`)
**Verdict**: Changes requested

## Summary

This branch builds the design system and UI foundation for spec 0003: a full CSS token system with light/dark themes, the 13 Shadcn/Radix primitives, 17 composed components, the storefront and admin shells, `design.md`, and the Vitest + Testing Library harness. The foundation is well executed — the token layer is thorough, the theme toggle handles its hydration correctly, the contrast work is honest (the failing `--accent` pair is documented rather than hidden), and the tests that exist assert real behaviour (focus trap, focus restoration, `<del>` semantics, dedupe). Two defects stand in the way of merge: both mobile drawers render their dialog overlay twice, which double-dims every backdrop and leaves a full-viewport invisible scrim above `lg`, and the collapsed admin sidebar renders navigation links with no accessible name at all. Below those, the gaps are smaller: touch targets that never grow on hybrid devices, a drag highlight that flickers, a partly unmet AC-7, and untested branching logic.

## Major

### 🟠 Mobile drawers render the dialog overlay twice, `apps/web/src/components/header.tsx:123`, `apps/web/src/components/admin-layout.tsx:178`

**Problem**: `DialogContent` in `apps/web/src/components/ui/dialog.tsx:59-60` already renders its own portal and overlay:

```jsx
<DialogPortal data-slot="dialog-portal">
  <DialogOverlay />
  <DialogPrimitive.Content ...>
```

Both drawers wrap `DialogContent` in _another_ `DialogPortal` and render an additional `<DialogOverlay className="lg:hidden" />` of their own. Radix's `DialogOverlay` renders whenever the dialog is open (modal mode), so opening either drawer puts **two** `fixed inset-0 z-50 bg-overlay` scrims on the page, and two nested portal containers in `document.body`.

**Why it matters**: `--overlay` is `rgb(31 42 42 / 0.55)` in light and `rgb(0 0 0 / 0.7)` in dark. Stacked, that is `1-(0.45 x 0.45) = 0.80` and `1-(0.3 x 0.3) = 0.91` — the backdrop behind every mobile drawer is far darker than the token specifies, in both themes, on every open. The second overlay is also the one _without_ `lg:hidden`, so if the drawer is open when the viewport crosses the `lg` breakpoint (tablet rotation, window drag, devtools resize) the panel is hidden by `lg:hidden` while that overlay stays full-screen: the page is dimmed, unclickable, and shows no drawer. The nested `DialogPortal` inside `DialogPortal` is redundant on top of that.

**Suggested fix**: Render exactly one overlay. Drop the manual `DialogPortal` + `DialogOverlay` from both call sites and give `DialogContent` a way to control its own overlay (for example an `overlayClassName` or `showOverlay` prop) so the drawer can hide the scrim at the same breakpoint as the panel — or gate the drawer on the viewport so it is never open at `lg`. A regression test asserting exactly one overlay element while the drawer is open would pin this.

### 🟠 Collapsed admin sidebar links have no accessible name, `apps/web/src/components/admin-layout.tsx:111`

**Problem**: `AdminSidebar` renders each nav item as an icon plus a conditional label:

```jsx
<item.icon className="size-5 shrink-0" aria-hidden="true" />;
{
  !collapsed && <span>{item.label}</span>;
}
```

In collapsed mode the text is removed and the only child is an `aria-hidden` SVG, so the link has no text and no accessible name. The collapse control is a one-click button, so this state is one interaction away.

**Why it matters**: Screen reader users get a list of unnamed links ("link", "link", "link", ...) in the admin panel, and voice-control users cannot say "click Products" — WCAG 2.1 AA failure (4.1.2 Name, Role, Value; 2.4.4 Link Purpose). AC-9 requires every interactive component to meet WCAG 2.1 AA, and the admin sidebar is the primary navigation of the admin panel.

**Suggested fix**: Keep the label in the accessibility tree when collapsed — an `aria-label={item.label}` on the link, or an `sr-only` span alongside the icon (and drop `aria-hidden` from the icon if the label is rendered as text). The existing test in `admin-layout.test.tsx` should assert an accessible name for each collapsed link, not just the link count.

## Minor

### 🟡 Touch targets never grow on hybrid pointer devices, `apps/web/src/components/ui/button.tsx:7`

**Problem**: The 44px rule is implemented with Tailwind's `pointer-coarse:` variant, which compiles to `@media (pointer: coarse)` — the _primary_ pointing device. On a touch laptop, an iPad with a trackpad, or a Windows convertible in tablet mode, the primary pointer is `fine`, so `pointer-coarse:min-h-11` never applies and `Button` stays at `h-9` (36px), `Input` at 36px, `Checkbox` at 16px.

**Why it matters**: AC-9 asks for a 44px minimum touch target. On exactly the devices where a touch user is also using a mouse, the target silently stays at the compact visual size, and the finger hits a 36px (or 16px) control. The same pattern is in `input.tsx:15`, `select.tsx:41`, `switch.tsx:22` and `checkbox.tsx:19`.

**Suggested fix**: Use the `any-pointer-coarse:` variant (Tailwind 4.3 ships it) or add an equivalent `@media (any-pointer: coarse)` rule, so the enlarged hit area applies whenever touch is available, not only when touch is the only pointer. Update the matching wording in `design.md` accessibility rule 3.

### 🟡 Drop-zone drag highlight flickers while the pointer moves over child elements, `apps/web/src/components/file-upload-zone.tsx:150`

**Problem**: `handleDragLeave` unconditionally clears `isDragOver`. `dragleave` also fires when the pointer moves from the drop zone onto one of its own children (the icon or the description text), so the "border-primary bg-primary/5" highlight switches off and back on while the file is still over the zone.

**Why it matters**: The primary affordance of the drop zone — the visual confirmation that a file will be dropped — stutters for the entire drag. It also misleads the user about whether the drop will register.

**Suggested fix**: Ignore the leave event when the pointer is still inside the zone, for example by checking `e.currentTarget.contains(e.relatedTarget as Node)` before clearing the state.

### 🟡 AC-7 is only partly met: two primitives size themselves outside CVA, `apps/web/src/components/ui/select.tsx:26`, `apps/web/src/components/ui/switch.tsx:7`

**Problem**: AC-7 says each Shadcn primitive uses CVA for its variant definitions. `Button` and `Badge` do. `SelectTrigger` and `Switch` expose a `size` variant as a plain prop with hand-written `data-[size=sm]:*` selectors, so their variant maps cannot be composed, inspected, or extended the way the other two are. The remaining primitives have no variants at all, which is fine, but the two that do are inconsistent with the pattern AC-7 names.

**Why it matters**: A future feature that adds a third size to `Select` or `Switch` has to hand-edit class strings in two places instead of adding one entry to a variant map, and the two primitives no longer behave like the rest of the library.

**Suggested fix**: Define the `size` variants for `SelectTrigger` and `Switch` with `cva` (a `variants` map with `default`/`sm`) and drive the `data-size` attribute from the resolved variant, the way `Button` and `Badge` do. If the deviation is deliberate, record the exception in the spec or `design.md`.

### 🟡 Dropdown menu items are the only focusable primitive without a teal focus ring, `apps/web/src/components/ui/dropdown-menu.tsx:76`

**Problem**: `DropdownMenuItem` uses `outline-hidden` plus `focus:bg-accent focus:text-accent-foreground`. That is a legitimate focus indicator (the accent fill measures about 3.6:1 against the popover surface, above the 3:1 WCAG 2.2 focus-appearance threshold), but it is not the 2px teal ring that AC-9 and `design.md` accessibility rule 1 promise for _every_ focusable element. `design.md:241-244` enumerates the primitives that drop the outline for the ring and does not mention the dropdown menu, so the doc and the code disagree.

**Why it matters**: The design system is the contract for every later feature. A contributor reading `design.md` will assume every focusable element carries the teal ring and will not notice that the one dropdown in the app behaves differently.

**Suggested fix**: Either add the teal ring to the menu items (and keep the accent fill as the hover state), or amend `design.md` accessibility rule 1 to state that dropdown menu items indicate focus with a background fill instead of a ring.

### 🟡 New branching logic has no test coverage, `apps/web/src/components/quantity-stepper.tsx:35`, `apps/web/src/components/file-upload-zone.tsx:87`

**Problem**: The test suite (7 files, 57 tests) covers the header drawer, the admin layout, the error boundary, `PriceDisplay`, `ProductCard` badges, `StarRating`, and part of `FileUploadZone`. It does not cover: `QuantityStepper`'s min/max clamping and its disabled states, `FileUploadZone`'s type and size validation (the error row and the exclusion of invalid files from `onFiles`), the remove-file flow, `FormField`'s error and required rendering, or `Breadcrumbs`' last-item and `showHome` handling.

**Why it matters**: The validation branch in `FileUploadZone` is the part that decides what a user is allowed to upload, and the stepper's bounds decide what quantity reaches the cart. Both are simple enough to be correct by inspection today, but a later edit to `maxSize` semantics or to the min/max logic would ship without a failing test.

**Suggested fix**: Add focused tests for the `QuantityStepper` bounds (buttons disabled at min and max, values clamped on click), for `FileUploadZone` validation (a wrong MIME type and an oversized file produce an error row and are excluded from `onFiles`), and for the remove-file path. The two Majors above would also have been caught by adding an overlay-count assertion and an accessible-name assertion to the existing drawer and sidebar tests.

### 🟡 The showcase fixture routes ship unguarded in production, `apps/web/src/app/design-system/page.tsx:119`, `apps/web/src/app/design-system/admin/page.tsx:64`

**Problem**: `/design-system` and `/design-system/admin` are built into the production bundle (the build output lists both as static routes) and are publicly reachable. Their doc comments say "Remove this route before the storefront ships", but that follow-up is tracked nowhere: `docs/scope/scope.md` marks the feature done with only "Document it" open, and `nextStep.txt` does not mention it. The routes also hardcode raw hex values in inline SVG data URIs, which the spec's colour invariant forbids everywhere else.

**Why it matters**: A temporary fixture that renders internal components, a fake admin dashboard, and hardcoded palette hexes is a small but real leak of unreleased surface area into production, and the removal task has no owner because it is not in the scope file.

**Suggested fix**: Add the removal to `docs/scope/scope.md` as an explicit follow-up item, and either gate the routes behind a build-time flag or delete them before the storefront ships.

### 🟡 `FormField` never conveys the required state to assistive tech, `apps/web/src/components/form-field.tsx:42`

**Problem**: The `required` prop renders an asterisk inside `<span aria-hidden="true">`. The label text itself is unchanged, and because the control is passed as `children`, `FormField` cannot set `required`/`aria-required` on it either.

**Why it matters**: A screen reader user is not told that the field is mandatory, while a sighted user sees the asterisk. For a form-heavy admin panel this is a WCAG 3.3.2 (Labels or Instructions) gap that every future form inherits by default.

**Suggested fix**: Either include the requirement in the accessible label text (for example append a visually hidden "required"), or document in `design.md` that the consumer must set `required` on the control as well as passing `required` to `FormField`.

## Nits

- ⚪ `apps/web/src/components/breadcrumbs.tsx:52`, the React key is the item label; two crumbs with the same label ("Products" then "Products") collide and warn. Key on label plus index, or on href.
- ⚪ `apps/web/src/components/admin-layout.tsx:92`, the drawer shows a "collapse" chevron for a button labelled "Close admin navigation". An X icon would match the action.
- ⚪ `apps/web/src/components/footer.tsx:97`, `role="contentinfo"` on a `<footer>` is redundant; it also duplicates the landmark if the footer is ever nested in another region.
- ⚪ `apps/web/src/components/footer.tsx:89`, the copyright year is frozen at module load, so a long-lived server shows the previous year after New Year until it restarts. The comment acknowledges it; computing it per render costs nothing.
- ⚪ `apps/web/src/components/header.tsx:129` and `apps/web/src/components/admin-layout.tsx:182`, the dialog and the `<nav>` inside it share the accessible name "Mobile navigation" / "Admin navigation". Differentiate them ("Mobile navigation menu", "Primary") so landmark lists stay unambiguous.
- ⚪ `apps/web/src/components/ui/skeleton.tsx:19`, the inline `style` is declared before `{...props}`, so a caller-supplied `style` silently replaces the shimmer gradient. Merge the styles instead.
- ⚪ `apps/web/src/components/ui/dialog.tsx:73`, the close button uses `focus:ring-2` rather than `focus-visible:`, so a mouse click leaves a visible ring on the close control.
- ⚪ `apps/web/src/components/ui/sonner.tsx:33`, `React.CSSProperties` is referenced without importing React; it resolves only through the UMD global that `@types/react` declares. Import the type explicitly.
- ⚪ `apps/web/src/components/ui/**`, the vendored Shadcn primitives carry no JSDoc, while `AGENTS.md` requires JSDoc on exported APIs. A one-line header noting they are vendored from shadcn would record the exception.
- ⚪ `apps/web/design.md:220`, the `MobileNavDrawer` props table omits `triggerRef`, which the component requires to restore focus.
- ⚪ `nextStep.txt`, `nextTask.txt`, scratch workflow state is committed at the repository root, and `nextStep.txt` now carries a stale review summary listing findings that are already fixed. Consider gitignoring these.

## Strengths

- The token layer is genuinely careful. `--accent` fails 4.5:1 as text in the light theme, and instead of quietly shipping it, `design.md` documents the failure, scopes the token to non-text use, and explains the 3.4:1 / 3.6:1 ratios. I re-derived the key ratios independently (ring 7.33:1, highlight 5.19:1, muted-foreground 5.60:1, accent 3.42:1) and they match the documented values.
- The theme toggle's hydration handling is correct and well explained: the accessible name stays neutral until `useSyncExternalStore` reports the client snapshot, so the server and client markup match while the icon swap stays pure CSS. This is a real bug most implementations ship, and it is avoided here.
- `StarRating` is honest. The graphic rounds to the nearest half star, but the accessible name and the optional readout always carry the true average, and twelve tests pin that behaviour across the rounding boundaries (4.25, 4.75, NaN, negative, non-integer `maxStars`).
- The tests that exist assert behaviour, not implementation: focus trapping, focus restoration to the opener, `aria-current` on the active route, `<del>` semantics with an `sr-only` "Original price", file dedupe, and production-safe error copy. The `ProductCard` badge test enumerates every `ProductType` from the shared package, which is the right way to pin a contract against a shared enum.
- The `pointer-coarse` touch-target strategy is a real design decision rather than a blanket `min-h-11`, and it survives the Tailwind cascade: I confirmed in the built CSS that `.pointer-coarse\:min-h-11` is emitted after `.h-9`, so the 44px floor actually wins.
- Conventions hold: every Radix import comes from the umbrella `radix-ui` package, the `src/components/ui` → `src/components` boundary has no reverse imports, all 13 required Shadcn primitives are present, and `typecheck`, `lint`, `format:check`, `test` and `build` all pass on this branch.

## Test coverage

Coverage is real but partial. 57 tests across 7 files, all green.

Covered with behaviour assertions: the storefront drawer's open/close/Escape/focus-trap/focus-restore behaviour and its route highlighting; the admin layout's sidebar collapse and mobile drawer focus management; `ErrorBoundary` logging, the `onError` hook, production copy, and retry recovery; `PriceDisplay` currency selection, discount detection and `<del>` semantics; `ProductCard` badge coverage for every `ProductType`; `StarRating` rounding, clamping and label honesty; `FileUploadZone` byte formatting, duplicate suppression and Space-key handling.

Not covered: `QuantityStepper`'s min/max clamping and disabled states; `FileUploadZone`'s type and size validation and the remove-file flow; `FormField`'s error and required rendering; `Breadcrumbs`' last-item and `showHome` branches; the composed `Footer`, `EmptyState`, `Divider`, `Container`, `Section` and `PageHeader`; the dark-mode token switch; and the two defects this review found — the number of overlays a dialog renders, and the accessible name of a collapsed sidebar link. Both of those are cheap assertions to add to the existing drawer and sidebar suites.
