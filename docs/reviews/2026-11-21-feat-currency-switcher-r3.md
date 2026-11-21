# Review, feat/currency-switcher, 2026-11-21

**Reviewed by**: GLM-5.3-Flash (author on deepseek v4.1 flash)
**Scope**: 43 files, feat/currency-switcher vs main (merge base 6393998), branch mode
**Verdict**: Approve with nits

## Summary

Third review round of the currency switcher, and the first on a genuinely different model: round 2 ran inline on the author model, so this run supplies the cross model guarantee. The change is a cookie backed BDT/USD switcher: a Server Action writes the cookie, an async storefront layout reads it once into CurrencyProvider, and two controls (header dropdown, drawer radio row) drive it, with URL cleanup of price filters on /shop. No blockers or majors were found. Two minors carried from round 2 remain open, both accessibility and design system polish. I verified independently: typecheck clean on both tsconfigs, and 93 unit and component tests in the currency scope pass on this tree.

## Minor

### 🟡 design.md still describes the old radio item indicator, `apps/web/src/components/ui/dropdown-menu.tsx:148`

**Problem**: The shared primitive's `DropdownMenuRadioItem` indicator changed from `CircleIcon size-2 fill-current` to `CheckIcon size-4` for this feature, and `animateClose` was added as an opt in prop. The design system reference, `apps/web/design.md`, was not updated.
**Why it matters**: design.md is the design system source of truth per the web AGENTS.md. The next feature reaching for a radio menu item inherits the new look and the new prop without the reference recording either.
**Suggested fix**: Add a short note to design.md's dropdown section covering the new indicator and the `animateClose` prop, or revert the primitive change and style the switcher's items locally.

### 🟡 Focus is dropped while the control is disabled during a switch, `apps/web/src/components/currency/currency-switcher.tsx:45`, `apps/web/src/components/currency/currency-radio.tsx:33`

**Problem**: The trigger and the radio fieldset use `disabled={isPending}`. A disabled element cannot hold focus, so keyboard focus falls to the document body for the length of the action round trip. The provider does restore focus to the right target after pending ends (currency-provider.tsx, the restore effect), so the end state is correct.
**Why it matters**: A keyboard or screen reader user hears focus vanish mid interaction and reappear after. The jump is disorienting on a slow connection where the switch takes a second or more.
**Suggested fix**: Keep the element enabled and use `aria-disabled` plus a guard in the handler that ignores clicks while pending. Focus then never leaves the control.

## Nits

- ⚪ `e2e/currency.spec.ts:297`, `addCookies` passes `url: baseURL ?? ""`. An empty string URL can place the cookie on a wrong origin if baseURL were ever unset, and the test would fail for a confusing reason. Use a real URL or assert baseURL exists.
- ⚪ `e2e/currency.spec.ts:48`, `setExtraHTTPHeaders` replaces the whole context header set with `x-forwarded-for`. A trap for the next test that adds a header. Consider `contextOptions.extraHTTPHeaders` or a merge.
- ⚪ `apps/web/src/components/currency/currency-switcher.tsx:59`, `animateClose={false}` has no comment at the call site. The why lives only on the primitive's JSDoc (dropdown-menu.tsx:36).
- ⚪ `apps/web/src/components/currency/currency-provider.tsx:144`, the context value is a fresh object on every render, so every consumer re renders on any provider state change. A useMemo keyed on the fields would avoid it. Purely a performance point at this scale.
- ⚪ `apps/web/src/lib/currency/server.ts:17`, the `cache()` wrapper is redundant because `cookies()` is already memoized per request. Harmless, and it documents intent.
- ⚪ `apps/web/src/components/currency/currency-provider.tsx:124`, if `router.replace(cleaned)` throws after a successful action, the catch shows the failure toast although the cookie was written. The message is misleading in that rare path.
- ⚪ Announcement state is set in the action callback rather than when the re render commits, which is the ordering the spec describes. React batches the update into the transition's commit, so observable behavior matches the spec in practice.
- ⚪ The branch carries unrelated commits: two personalNotes.txt commits (2e65120, e861a8a) and a two line `showCloseButton={false}` tweak in mobile-filter-drawer.tsx. The notes file is the owner's tracked file, but none of it belongs to this feature.

## Strengths

- `setCurrency` validates with the shared zod schema, reads its input defensively against null, undefined, and tampered payloads, and never writes the cookie or redirects on bad input. The unit suite covers nine bad input shapes, Secure only in production, and a propagated cookie store rejection.
- Clean layering holds: `server-only` guards the one server reader, `React.cache` dedupes per request, the module moved to lib/currency with no shim and every importer repointed. A grep confirms no stale imports of the old path.
- One live region announces at a time (provider page region vs drawer region, chosen by target), and a test locks that contract.
- The e2e suite covers the production relevant surfaces: no reload on switch, cookie attributes, JSON-LD currency flip, no control on /login, /register, or /admin, persistence across contexts and sign in/out, invalid cookie fallback, replace rather than push with Back keeping filters cleared, keyboard operability, and an axe WCAG 2.1 AA pass.
- The dropdown primitive edit is opt in: `animateClose` defaults true so existing menus are untouched, and the JSDoc explains exactly when to opt out.
- The filter form remount key (currency plus serialized filter state) implements the price input reset cleanly without touching input logic.

## Test coverage

Configured (vitest beside source, Playwright for e2e). Strong for this change: 93 unit and component tests across the currency scope pass on my run, and typecheck is clean on both tsconfigs. Action validation and cookie attributes, provider hooks and the switch flow, both controls, URL cleanup, label copy, placement gating, and e2e flows including axe are all covered. The 887 line switcher test file is large, but its tests assert behavior (announcements, focus, requests, URLs) rather than implementation details, which is the right kind of coverage.
