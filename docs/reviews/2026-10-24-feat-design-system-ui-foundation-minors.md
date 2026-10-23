# Review, feat/design-system-ui-foundation, 2026-10-24 (round 6, minor-fix follow-up)

**Reviewed by**: GLM-5.3-Flash (fresh reviewer, did not author the code)
**Scope**: 59 tracked files vs merge base 82e1d99 (branch vs main), plus 17 untracked files read in full; focus on the round-6 delta (three round-5 minor fixes + their tests), with a fresh pass over the rest of the branch
**Verdict**: Approve

## Summary

Spec 0003 remains complete and this round closes it out. All three round-5 minors are fixed exactly as recommended and verified at source level and by running the gates myself: the admin drawer closes when a nav item is chosen (`onNavigate` wired only on the mobile drawer instance), the disabled `FileUploadZone` exposes `aria-disabled` while the enabled zone omits it, and the previously uncovered `removeFile` and disabled-guard paths now have regression tests — including the active-route drawer case and a spy-based picker guard with a positive control. Re-run independently: 88/88 tests pass across 10 files, `typecheck` (production + `tsconfig.test.json`) passes, `eslint` passes. What remains is two small nits (one a recurrence of a known doc-count error class) and the intentionally deferred nits from earlier rounds, unchanged. No blockers, no majors.

## Round-5 minors — verification

**1. Admin drawer nav links now dismiss the drawer — fixed, `apps/web/src/components/admin-layout.tsx:64,124,222`.** `AdminSidebar` gained the optional `onNavigate?: () => void` prop with accurate JSDoc, invoked via `onClick={onNavigate}` on every nav `<Link>` (line 124). The mobile drawer passes `onNavigate={closeMobile}` (line 222). The desktop instance (line 187) passes nothing, so `onClick` is `undefined` and desktop behavior is untouched by construction — it does not fire there. The storefront/header and admin shells now behave identically for the same action, resolving the round-5 asymmetry.

**2. Disabled drop zone is now announced — fixed, `apps/web/src/components/file-upload-zone.tsx:226`.** `aria-disabled={disabled || undefined}`. When `disabled` is false the expression is `undefined` and React omits the attribute entirely, so the enabled case is unbroken (verified in the "enabled zone exposes neither" browser check in verify.md and consistent with the attribute semantics). Combined with the pre-existing `tabIndex={-1}`, AT users get role + disabled state and keyboard users get correct reachability. Matches the round-5 suggested fix verbatim.

**3. New regression tests — present and meaningful:**

- `file-upload-zone.test.tsx:130` removes the first of two files, asserting both the list shrinks to one row _and_ `onFiles` was re-emitted with the remainder — the exact desync the round-5 minor worried about.
- `file-upload-zone.test.tsx:150` (remove last, emits `[]`) and `:169` (remove a rejected file that was never forwarded) close out the remaining `removeFile` branches, including the re-emission-an-empty-array path rather than only checking the list disappeared.
- `file-upload-zone.test.tsx:206` (disabled click guard) and `:223` (enabled click) use `vi.spyOn(HTMLInputElement.prototype, "click")`. The spy is NOT a leaky test smell here: it is restored in `finally` (and vitest isolates environments per file — 10 environments, one per file, observed in the run), and — the important part — the enabled test acts as a positive control (`toHaveBeenCalledTimes(1)`), so the disabled assertion cannot pass vacuously through a broken spy. `fireEvent` dispatches directly to the zone, correctly exercising the JS guard (`!disabled && inputRef.current?.click()`) rather than the untestable-in-happy-dom CSS `pointer-events-none`. This is the honest way to assert "no picker opened" without a native file dialog.
- `admin-layout.test.tsx:380` (drawer closes on nav item chosen) and `:411` (drawer closes even on the _active_ item). The second test is the well-built one: it mocks `usePathname` to `/admin` so the clicked link carries `aria-current="page"`, and clicking the current route performs no navigation — meaning the only mechanism that can close the drawer is `onNavigate` itself. Both tests therefore pass for the right reason, not incidentally.

No new problems were introduced by the fixes: the desktop sidebar is behaviorally identical, the enabled upload zone is unchanged, and none of the eight new tests assert unreachable behavior or depend on mock leakage.

## Nits

- ⚪ `docs/specs/0003-design-system/verify.md:7`, the debug-round paragraph says "the full suite pass (10 files and 83 tests)" — the suite now runs **88** tests (measured this round). Second occurrence of the same error class the round-5 review flagged at `verify.md:76` ("74 tests" vs 79). The verification record keeps drifting from the suite; either echo the count from the runner output when writing the record or drop counts from prose.
- ⚪ `apps/web/src/components/admin-layout.tsx:118`, the active-route check uses `pathname.startsWith(item.href)` without the trailing-slash guard `header.tsx:171` uses (`startsWith(link.href + "/")`), so a hypothetical future `/admin/products-archive` route would wrongly mark "Products" active. Pre-existing (survived five rounds unflagged), no current route collides — worth aligning with the header's logic next time the file is touched.
- Prior rounds' deferred nits remain, unchanged and still intentional: `use-close-on-desktop` listener race, dialog close `focus:ring-2`, Select `item-aligned`, dropdown 150ms animation floor, Skeleton `style` spread, EmptyState unconditional `<h3>`, `CardTitle` as `div`, Input `pointer-coarse:mb-[-4px]`, ProductCard `sizes` 25vw, exported internal constants, dual hit-area conventions, primitive TSDoc, `useRouter` mock shape, root `eslint.config.mjs` PascalCase function selector, Breadcrumbs no-href `aria-current`. None re-listed as findings per the follow-up brief.

## Strengths

- The active-item drawer test (`admin-layout.test.tsx:411`) targets the root cause rather than a symptom: by mocking the pathname so navigation cannot fire, it proves the dismissal comes from `onNavigate` — the exact failure mode round 5 described.
- The click-spy pairing in `file-upload-zone.test.tsx` (negative + positive control + `finally` restore) is a textbook way to make a "should not be called" assertion trustworthy.
- All three fixes landed in the precise shape the prior review suggested, with the desktop instance untouched by construction, and the JSDoc on `onNavigate` documents why the desktop sidebar passes nothing.
- Gates re-verified by execution this round: 88/88 tests, `tsc --noEmit` (production and test tsconfigs), and `eslint` all clean.
- The round-5→6 delta also shows good hygiene outside the fixes: `star-rating.test.tsx` moved to `getAttribute("class")` (SVG `className` is an `SVGAnimatedString`), and the new `design-system/layout.tsx` centralizes the `noindex` requirement with a JSDoc that points at the scope-tracked removal.

## Test coverage

Configured (Vitest + RTL, happy-dom; **10 files / 88 tests, all passing** — run independently for this review; typecheck and eslint re-run clean). The round-5 leave-list is now fully closed: `removeFile` (all three removal shapes, including re-emitting an empty array and removing a never-emitted rejected file), the disabled click/drop guards, and the disabled `aria-disabled` state each have a regression test. Remaining untested branches are unchanged from round 5 and small: the Space keyup activation path in `file-upload-zone.tsx:212-219` (only keyDown's `preventDefault` is tested), the `defaultDescription` accept-label formatting, and the Breadcrumbs last-item/no-href branches. Theme persistence and real pointer behavior rest on `/check verify` (E2E is `none-by-design`), which verify.md records as driven in headless Chromium for this round's behaviors.
