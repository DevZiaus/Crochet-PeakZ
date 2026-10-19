# Review, feat/design-system-ui-foundation, 2026-10-18

**Reviewed by**: fable/gpt-6-luna (author on deepseek-v4.1)
**Scope**: 52 files, branch vs base (`daee7f78611790a08c13a6fc64152b069e839d57`)
**Verdict**: Changes requested

## Summary

This branch adds the token system, next-themes integration, Shadcn/Radix primitives, storefront/admin layout components, commerce/form components, and design-system documentation. The implementation has a coherent token-driven structure and the later fixes improve star-rating semantics, drawer behavior, focus rings, and coarse-pointer sizing. The target revision still cannot pass the web typecheck/build because the committed web tests import undeclared Testing Library packages, and several interactive links/controls remain below the explicit 44px WCAG touch-target requirement.

## Major

### 🟠 Web typecheck and production build fail because test dependencies are undeclared, `apps/web/src/components/star-rating.test.tsx:1`

**Problem**: The committed web test imports `@testing-library/react` and references `@testing-library/jest-dom`, but neither package is declared in `apps/web/package.json` (the file's devDependencies end at `typescript-eslint`). The web `tsconfig.json` includes all `**/*.ts` and `**/*.tsx`, so the test is included in `tsc` and Next's production typecheck.

**Why it matters**: `npm run typecheck --workspace=apps/web` fails before the app can ship, and `npm run build --workspace=apps/web` also fails during its TypeScript phase. This violates the spec's required typecheck/build gates and blocks deployment even though the app compiles before type checking.

**Suggested fix**: Add the React Testing Library and jest-dom packages (plus their required types/configuration) to the web workspace and ensure the Vitest setup is included by the workspace test command, or exclude tests from the production TypeScript project while providing a separate test tsconfig that is checked in CI. Then run the documented root typecheck and build commands from a clean install.

### 🟠 Required 44px touch targets are still missing from footer, breadcrumb, dialog, and file-list controls, `apps/web/src/components/footer.tsx:119`

**Problem**: Several focusable controls use dimensions smaller than the design-system contract: footer social links use `size-10` (40px) at `footer.tsx:119`; footer and breadcrumb text links only have line-height plus small padding at `footer.tsx:138` and `breadcrumbs.tsx:36,64`; the default dialog close button has only an icon and no minimum dimensions at `ui/dialog.tsx:73`; and the file-upload remove button uses `size="icon-xs"` (24px visual size) at `file-upload-zone.tsx:242-250`. These controls do not receive the Button component's coarse-pointer minimum because the footer/breadcrumb links are plain anchors and the dialog close is a raw Radix button.

**Why it matters**: These are user-facing interactive elements in the shared foundation, so they fail AC-9 and the documented accessibility rule that every interactive element has a 44px target. This affects keyboard/touch navigation across the footer, breadcrumbs, dialogs, and file upload workflow, not an isolated showcase case.

**Suggested fix**: Give every interactive link/close/remove control a 44px hit area while preserving the visual size, for example with `min-h-11`/`min-w-11` and suitable padding or an equivalent wrapper. Apply the same rule to all footer/legal links and any other plain anchors, and verify the computed dimensions at coarse and fine pointer breakpoints.

## Minor

## Nits

## Strengths

- The token source of truth is centralized in `globals.css`, mapped through Tailwind v4 `@theme inline`, and documented in `apps/web/design.md`; the light/dark semantic roles and typography scale are easy for later features to consume.
- The debug fixes materially improve behavior: StarRating rounds its visual output and accessible label consistently, ProductCard selects the compare-at price in the active currency, and the mobile navigation uses Radix Dialog focus management rather than a hand-rolled drawer.

## Test coverage

The repository has a configured Vitest runner and the shared-package suite passes (34 tests in the target checkout), but the web workspace has no `test` script and its committed component tests cannot typecheck because their Testing Library dependencies are missing. The only design-system behavior tests are StarRating and AdminLayout tests; the broader component inventory, theme switching, touch targets, reduced-motion behavior, file validation, and ErrorBoundary states remain untested by executable web tests. The first major finding must be resolved before the web test/build signal is reliable.
