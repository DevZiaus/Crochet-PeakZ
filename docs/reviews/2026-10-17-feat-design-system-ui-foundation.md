# Review, feat/design-system-ui-foundation, 2026-10-17

**Reviewed by**: GPT-5 (author on deepseek-v4.1 / `sonnet`)
**Scope**: 51 files, feat/design-system-ui-foundation vs main (branch diff only; no uncommitted changes present in the review checkout)
**Verdict**: Changes requested

## Summary

The change establishes a broad token system, UI primitives, storefront/admin components, and a design-system showcase route. The structure is generally coherent and makes useful use of Radix primitives, but several implementation details do not fulfill the stated accessibility and component behavior contracts. In particular, star ratings are incorrect for values rounded to whole stars, currency sale indicators can disagree with the displayed currency, and mobile/admin layouts expose interaction and viewport issues.

## Major

### 🟠 Star rating rounding drops a star, `apps/web/src/components/star-rating.tsx:37`

**Problem**: The half-star rule excludes fractional values from `0.75` upward, while `fullStars` remains `Math.floor(clampedRating)`. A value such as 4.8 therefore renders four filled stars and no half star (the remaining slot is empty), despite the accessible label saying 4.8/5. Similar threshold gaps affect values such as 1.8.
**Why it matters**: Product reviews are visually understated and the graphic contradicts its accessible name, misrepresenting customer ratings.
**Suggested fix**: Round the rating to the supported half-star increment before deriving full, half, and empty counts, or use explicit thresholds that correctly round values >= .75 to the next full star.

### 🟠 Sale badge uses BDT prices regardless of selected currency, `apps/web/src/components/product-card.tsx:110`

**Problem**: The Sale badge condition compares `compareAtBdt` with `priceBdt` even when `activeCurrency` is USD. If the product's USD compare-at price is greater than its USD price while BDT prices are equal/lower (or vice versa), the sale badge disagrees with the price actually displayed.
**Why it matters**: Catalog customers can be told an item is on sale when the displayed currency has no discount, or not told about a real discount.
**Suggested fix**: Select both current and compare-at amounts using `activeCurrency` before deciding whether to show the badge, matching `PriceDisplay`'s currency selection.

### 🟠 Small button variants miss the specified touch target, `apps/web/src/components/ui/button.tsx:7`

**Problem**: Only `pointer-coarse` devices receive 44px minimum dimensions, and size variants set fixed heights as low as 24px/32px. These compact variants are used by interactive controls throughout the new components; the requirement calls for all interactive controls to provide a minimum 44px target, not only coarse-pointer devices.
**Why it matters**: Users on touch devices with fine-pointer reporting, and users of compact buttons, can encounter targets below the acceptance criterion and harder to activate controls.
**Suggested fix**: Ensure every interactive button has at least one 44px dimension irrespective of pointer media query, or explicitly document and constrain any compact exceptions so they are not used as touch targets.

## Minor

### 🟡 Mobile navigation dialog has no focus management, `apps/web/src/components/header.tsx:65`

**Problem**: The drawer is given `role="dialog"` and `aria-modal="true"` but is not built on a dialog primitive and does not move focus into the open drawer, trap focus, or restore focus to the opener on close. `inert` hides the closed drawer, but does not provide those modal behaviors while open.
**Why it matters**: Keyboard and screen reader users can tab into page content behind a modal navigation drawer and lose their place when closing it, despite the modal semantics promising that background interaction is unavailable.
**Suggested fix**: Use the existing Radix Dialog primitive for the mobile drawer, or implement equivalent focus capture/trapping/restoration and background inertness before retaining `aria-modal`.

### 🟡 Admin shell fixes height to the layout viewport, `apps/web/src/components/admin-layout.tsx:124`

**Problem**: `h-screen` fixes the shell to `100vh`, which on mobile browsers can exceed the visible viewport when browser chrome is expanded and does not account for dynamic viewport resizing.
**Why it matters**: Admin content can be clipped or require awkward nested scrolling on mobile, particularly when the browser's visible viewport changes.
**Suggested fix**: Use a dynamic viewport-aware minimum/fixed height strategy (for example `100dvh` with an appropriate fallback) and verify the mobile overlay remains within that viewport.

### 🟡 Star rating accepts non-finite or invalid max values without a defined fallback, `apps/web/src/components/star-rating.tsx:35`

**Problem**: `NaN` ratings propagate into the ARIA text and produce invalid array lengths; `maxStars` is not validated as a positive integer, so negative, fractional, or non-finite values can likewise produce nonsensical output.
**Why it matters**: Ratings sourced from persisted or aggregate data can unexpectedly render invalid semantics or throw at runtime if values are malformed.
**Suggested fix**: Normalize or reject non-finite ratings and ensure `maxStars` is a positive integer before computing star counts.

## Nits

(none from this reviewer pass)

## Strengths

- Design tokens are centralized and exposed through Tailwind v4's theme mapping, with separate light and dark palettes.
- Radix-based primitives provide a sound foundation for keyboard and ARIA behavior, and the composed components consistently use shared tokens and `cn()`.

## Test coverage

The project has Vitest configured, but the branch adds no tests for the new components or their behavior. The spec's verify document lists manual scenarios, but it is a checklist rather than executable coverage. The untested branching behavior in rating rendering, file validation, and currency-dependent display warrants focused behavioral tests, particularly around threshold and alternate-currency cases.
