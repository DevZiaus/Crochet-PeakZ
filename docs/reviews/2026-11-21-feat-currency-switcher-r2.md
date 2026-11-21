# Review: currency switcher (spec 0007)

**Reviewed by**: deepseek-v4.1-flash, run inline in the same session that wrote the code
**Scope**: 43 files on `feat/currency-switcher` against `main` (merge base `6393998`), all under `apps/web` plus `e2e/` and two `package.json` files
**Verdict**: Approve with nits

## Reviewer note (please read first)

This review is degraded. The `check` skill wants a different model than the author, and none was available in this run (no Gemini, no other usable model). So I reviewed the diff inline on the same model that wrote it, which means I share the author's blind spots. Treat the findings as useful but not independent. A review on a genuinely different model is still worth doing before merge if you can get one.

I also want to be clear about what is NOT in this report. An earlier review of this branch (`2026-11-21-feat-currency-switcher.md`) listed several problems that no longer exist in the current tree. I re-checked each one against the code as it stands now: the `server-only` and `cache()` calls are present, the parent remount keys are gone, the double live region is gone (one target announces at a time, and a test locks that in), the axe dependency is committed, and there is no contact work and no API change on this branch. None of those old findings are repeated below.

## Summary

The currency switcher is in good shape. The change set is small and well scoped: a server cookie reader, a server action that validates input, a client provider that owns the switch round trip, two presentation controls (a header dropdown and a drawer radio group), plus a small helper that strips price filters from the `/shop` URL. The layering is clean, the old currency module is deleted with no shim left behind, validation reuses the shared schema, and the tests are broad, covering cookie attributes, exhaustive bad input, accessibility, and the full switch flow in Playwright. I found no blockers and no majors. What remains is a handful of minor points and nits.

## Minor

**M1. The shared `DropdownMenuRadioItem` indicator changed for this feature, and `design.md` was not updated.**
The diff changes `apps/web/src/components/ui/dropdown-menu.tsx` so the radio indicator is a `CheckIcon className="size-4"` instead of the previous `CircleIcon className="size-2 fill-current"` (and the checkbox item uses `CheckIcon size-4` too). This is an app wide design system primitive, edited to suit one feature. Today the switcher is the only consumer of `DropdownMenuRadioItem`, and `DropdownMenuCheckboxItem` has no consumers at all, so nothing else breaks right now. The concern is forward looking: the next feature that reaches for a radio menu item gets the changed look, and the change is not recorded in the design system. Either revert the primitive to its old indicator and style the switcher locally, or keep it and note the new indicator in `design.md`. Low urgency, low risk.

**M2. Keyboard focus is dropped while the control is disabled during the switch.**
While a switch is in flight, the header trigger is `disabled={isPending}` and the drawer fieldset is `disabled={isPending}`. A disabled element cannot hold focus, so a keyboard user who triggers the switch loses focus during the round trip; the provider restores it afterward through the focus restore effect. The end state is right, but the gap is real and can read as a jump. A common fix is `aria-disabled="true"` with a guarded handler that ignores clicks while pending, so focus stays put. This is a quality point, not a correctness bug, and the tests do cover the restore behavior.

**M3. The branch has drifted from its remote and carries one unrelated commit.**
`git rev-list --left-right --count feat/currency-switcher...origin/feat/currency-switcher` reports 3 ahead and 4 behind, and the branch includes `2e65120 added 3 new todo in personal notes`, which only touches `personalNotes.txt`. That file belongs to the repo owner and is tracked on purpose, so this is not a code problem, but it is unrelated work riding along with the feature. Before opening the PR, rebase on the current remote and decide whether that note commit should be part of this feature branch.

## Nits

- **N1.** `e2e/currency.spec.ts` calls `addCookies` with `url: baseURL ?? ""`. When Playwright has no base URL configured this passes an empty string, which can make the cookie sit on the wrong origin. Prefer a real URL, or assert that `baseURL` is set.
- **N2.** In the same file, `signIn` sets a random `x-forwarded-for` through `setExtraHTTPHeaders`, which replaces the context headers rather than adding to them. It works today because nothing else sets headers, but it is a trap for the next change.
- **N3.** `DropdownMenuContent` in `currency-switcher.tsx` passes `animateClose={false}`, so the currency menu loses its closing animation while other menus keep theirs. Deliberate or not, it is a visible inconsistency; worth a comment saying why.
- **N4.** The provider's context value is a fresh object on every render, so every consumer re-renders on any provider state change (including the announcement state). A small `useMemo` keyed on the value fields would avoid that. Performance only.
- **N5.** `getActiveCurrency` wraps the cookies read in `cache()`. `cookies()` is already memoized per request, and this function only reads one cookie, so the `cache()` wrapper is redundant. Harmless, but it implies a cost that is not there.
- **N6.** `useOptimistic` shows the new currency immediately, then the optimistic value can snap back to the old one for a moment before the server render commits. That is inherent to the pattern and the spec accepts it, but it can flash. Worth confirming it looks acceptable in a slow connection.
- **N7.** If `router.replace(cleaned)` throws, it is caught by the same `catch` as the action, so the user sees "Could not change currency" even though the cookie was set successfully. Narrow edge, but the message would be misleading.

## Strengths

- **Server side validation done right.** `setCurrency` reuses the shared `currencySchema`, reads the input defensively, and returns `INVALID_CURRENCY` without writing a cookie on any bad input. The unit tests are exhaustive (wrong code, empty, lowercase, padded, missing, non string, array, null, undefined), which is exactly the input surface a server action needs.
- **The shared primitive change is opt in.** By defaulting `animateClose` to true, the dropdown edit leaves `AuthMenu` and every other existing menu untouched. That is the careful version of editing a shared component.
- **One live region at a time.** The provider announces to the header region or the drawer region, never both, and a test asserts a single announcement. This directly closes the double announce risk.
- **Clean layer split and a clean removal.** `server-only` guards the server reader, the client code cannot import it by accident, and the old `lib/catalog/currency.ts` is deleted with no re-export shim and with all importers repointed.
- **Strong end to end coverage.** The Playwright suite checks the things that actually matter here: no full page reload on switch, cookie attributes (path, httpOnly, SameSite, expiry), JSON-LD price currency flipping BDT to USD, no control on `/login`, `/register`, or `/admin`, persistence across browser contexts and across sign in and sign out, an invalid EUR cookie falling back to BDT, no request when re choosing the active currency, URL replace against push with Back returning to `/`, filter inputs emptying after the price filter reset, axe WCAG 2.1 AA checks, and focus restore.

## Test coverage

Tests are configured for this repo (Vitest, with Playwright for end to end). Coverage of this change is strong and I found no material gap. Unit tests cover the cookie helpers, the action's validation and cookie attributes (including Secure only in production and a propagated cookie store rejection), the label copy, and every provider and control behavior. End to end tests cover the full user visible flow on both desktop and mobile projects. `npm run typecheck` is clean and the currency unit tests pass (56 tests across 4 files).
