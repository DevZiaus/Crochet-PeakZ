# Review, feat/currency-switcher, 2026-11-21

**Reviewed by**: deepseek-v4.1-flash (author on deepseek-v4.1-flash, reviewed inline, no second model was available)
**Scope**: 78 files, feat/currency-switcher vs main plus uncommitted working tree
**Verdict**: Changes requested

## Summary

The currency switcher itself is well built. One server reader, one client hook, a validated server action, an HttpOnly cookie, and real accessibility work, all covered by passing unit and Playwright tests. The issues are not in the feature logic. They are: the branch is not isolated to the currency switcher (an unrelated contact and storefront commit plus uncommitted contact work sit on it), and a shared dropdown primitive was changed app wide to serve this one feature. Fix those and the rest is small.

## Major

### 🟠 Shared dropdown primitive changed for one feature, `apps/web/src/components/ui/dropdown-menu.tsx:12-23,62`

**Problem**: `DropdownMenu` now defaults `modal` to `false`, and `DropdownMenuContent` lost its close animation classes (`data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95`). The comment explains the reason as a Radix focus and aria hidden concern tied to the currency switcher, but the change lands on every dropdown in the app.

**Why it matters**: `apps/web/src/components/auth/auth-menu.tsx` uses `DropdownMenu`, so the signed in account menu silently becomes non modal and loses its close animation. Any other menu in the catalog or admin shares the same fate. A design system primitive changed for one feature, with no update to the design spec and no test on the other consumers, is the kind of change that bites later when someone relies on the old behavior.

**Suggested fix**: Prefer the fix at the call site. Pass `modal={false}` from the currency switcher where the a11y problem actually appears, and leave the shared default alone. If the change really belongs to the whole design system, record it as a deliberate decision, update the design spec, and cover `AuthMenu` so its new behavior is intentional and tested, not a side effect.

### 🟠 Branch is not isolated to the currency switcher, commit `a078f2c` and uncommitted contact work

**Problem**: `feat/currency-switcher` carries the unrelated commit `a078f2c` "feat(storefront): fix about, contact, privacy, and data-deletion pages and contact API" (about 2975 insertions, touching the API contact domain, the Resend email path, the `/api/contact` route, the web contact form, and the shared contact module) sitting between the currency commits. On top of that, the working tree holds uncommitted contact form and contact page edits, and an uncommitted `@axe-core/playwright` devDependency in `package.json` and `package-lock.json` that only `e2e/currency.spec.ts` uses.

**Why it matters**: The diff against main is 78 files and 5802 insertions, and most of it is contact work, not the currency switcher. Whoever reviews or merges the currency change is really reviewing a second, unreviewed feature. A rollback of the currency switcher would also drag the contact work with it. This breaks the project's own per milestone commit expectation in `AGENTS.md`.

**Suggested fix**: Land the contact and storefront work on its own branch with its own spec and review, then rebase the currency commits so the currency change stands alone. Commit the `@axe-core/playwright` dependency together with the e2e test that needs it, or drop it until then.

## Minor

### 🟡 Spec asks for `server-only`, the file does not import it, `apps/web/src/lib/currency/server.ts:1`

**Problem**: The spec 0007 code layout lists `server.ts` with a `server-only` import. The file has no such import.

**Why it matters**: `getActiveCurrency` reads cookies and must never run on the client. Without the guard, a client component that imports it fails at runtime with a confusing error instead of failing at build time.

**Suggested fix**: Add the `server-only` import at the top of the file.

### 🟡 Redundant remount key on the catalog filter form, `apps/web/src/components/catalog/filter-sidebar.tsx`, `apps/web/src/components/catalog/mobile-filter-drawer.tsx`, and `apps/web/src/components/catalog/filter-form.tsx:35,38`

**Problem**: Both parents key `<CatalogFilterForm>` by currency and href, and the form inside `filter-form.tsx` keys its `<form>` element by the same value. Either key alone remounts the uncontrolled price inputs.

**Why it matters**: Two owners for one remount. It works today, but it is easy to break or to double render when one side changes and the other does not.

**Suggested fix**: Keep the inner form key, which is co located with the state it protects, and drop the parent keys. Or the reverse, but pick one.

### 🟡 Two live regions can announce the same switch twice, `apps/web/src/components/currency/currency-provider.tsx:126-133` and `apps/web/src/components/currency/currency-radio.tsx:73-80`

**Problem**: The provider renders a polite status region, and the drawer radio renders its own polite status region with the same message. When the mobile drawer is open, both hold the announcement for one switch.

**Why it matters**: A screen reader may read the currency change twice, which is noisy and undermines the careful a11y work elsewhere.

**Suggested fix**: Let the provider own the announcement for the whole app, or keep the drawer region and suppress the provider one while the drawer is open. One announcement per switch.

## Nits

- ⚪ `apps/web/src/components/ui/dropdown-menu.tsx:120`, the `DropdownMenuCheckboxItem` indicator is a bare `CheckIcon` without `aria-hidden`, while the sibling radio indicator at line 155 now has it. Make them match.
- ⚪ `apps/web/src/lib/currency/server.ts:8`, `getActiveCurrency` is not wrapped in React `cache()`. The storefront layout and each catalog page await `cookies()` separately within one request. A small `cache()` wrapper removes the repeats.
- ⚪ `apps/web/src/components/catalog/mobile-filter-drawer.tsx`, `showCloseButton={false}` arrived with this change and has nothing to do with currency. Fold it into the filter drawer work or note why it is here.

## Strengths

- Validation is server side and only server side. `setCurrency` reuses the shared `currencySchema`, so nothing but `BDT` or `USD` can be stored, and the cookie is written only after validation passes.
- The cookie test is thorough: attributes, including `Secure` only under production, plus every rejection path (non string, lowercase, padded, array, null, `EUR`) asserted to write no cookie and never redirect.
- The accessibility work is genuine and verified, not decorative. Focus returns to the control after a switch, `aria-busy` and `disabled` cover the pending state, and the Playwright suite runs axe against WCAG 2.1 AA.
- Clean layer split: one server reader, one client hook, and the old `src/lib/catalog/currency.ts` is deleted with no re-export shim, exactly as the spec required.
- `withoutPriceFilters` changes only the one URL shape that needs it (the shop page with price filters) and leaves every other URL alone, with tests for the edges.

## Test coverage

TESTS = configured (Vitest). Coverage is strong. 466 web tests pass and typecheck is clean across api, web, shared, and e2e. Every piece of new branching or error logic has a test: the server action validation and cookie attributes, the provider switch flow including the optimistic value and its revert, the focus restore, the URL reset on the shop page, and the cookie parsing fallbacks. `e2e/currency.spec.ts` adds desktop and mobile flows, persistence, and the invalid cookie fallback. The only gap worth naming is not the switcher itself: the shared dropdown change has no test on the other consumer, `AuthMenu`, which is part of the first Major finding.
