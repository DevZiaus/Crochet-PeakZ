# Design System Reference: Crochet PeakZ

> Visual language, tokens, components, and accessibility rules for the Crochet PeakZ storefront and admin panel. Every developer (or AI agent) building a feature reads this file to know what colors, fonts, spacing, and components are available and how to use them.

**Spec**: [0003-design-system](../../docs/specs/0003-design-system/index.md)
**Tokens source of truth**: [`src/app/globals.css`](src/app/globals.css)

---

## Character

Warm, artisanal, and premium. The visual personality blends the handcrafted feel of crochet with a clean, modern e-commerce experience. Deep teal conveys trust and sophistication; warm gold adds a handmade luxury accent; rose/coral highlights bring energy to sale and attention states. DM Sans keeps the UI clean and readable; Playfair Display on headings adds editorial elegance.

## Build mandate

Every page and component must:

1. Use only design token CSS custom properties for colors, never raw hex values or Tailwind default colors.
2. Meet WCAG 2.1 AA contrast (4.5:1 normal text, 3:1 large text) in both light and dark themes.
3. Render correctly in both light and dark modes without any per feature effort (tokens switch automatically via `next-themes`).
4. Honor `prefers-reduced-motion: reduce` on all animations and transitions.
5. Provide 44px minimum touch targets on all interactive elements.

---

## Color palette

All colors are CSS custom properties defined in `:root` (light) and `[data-theme="dark"]` (dark). Tailwind utilities like `bg-primary`, `text-accent` resolve to these.

### Semantic tokens

| Token                    | Light                 | Dark                   | Usage                                    |
| ------------------------ | --------------------- | ---------------------- | ---------------------------------------- |
| `--primary`              | `#0f5c5c` (deep teal) | `#5fb8b3` (light teal) | Primary actions, links, active states    |
| `--primary-foreground`   | `#ffffff`             | `#0e1a1a`              | Text on primary backgrounds              |
| `--primary-hover`        | `#0b4a4a`             | `#7ccbc6`              | Hover state for primary buttons          |
| `--accent`               | `#b07d22` (deep gold) | `#e0b563`              | Star ratings, badges, premium indicators |
| `--accent-foreground`    | `#1a1408`             | `#1a1408`              | Text on accent backgrounds               |
| `--highlight`            | `#b0445a` (rose)      | `#d9707f`              | Sale prices, attention badges            |
| `--highlight-foreground` | `#ffffff`             | `#1a0a0e`              | Text on highlight backgrounds            |

### Surface tokens

| Token                    | Light                      | Dark                  | Usage                                                                           |
| ------------------------ | -------------------------- | --------------------- | ------------------------------------------------------------------------------- |
| `--background`           | `#fbf8f3` (warm off white) | `#0e1a1a` (dark teal) | Page background                                                                 |
| `--foreground`           | `#1f2a2a`                  | `#edf3f1`             | Primary text                                                                    |
| `--card`                 | `#ffffff`                  | `#152424`             | Card, header, popover backgrounds                                               |
| `--card-foreground`      | `#1f2a2a`                  | `#edf3f1`             | Text inside cards                                                               |
| `--secondary`            | `#e7efee`                  | `#1d3131`             | Secondary button backgrounds, alternating rows                                  |
| `--secondary-foreground` | `#0f3b3b`                  | `#d4ebe7`             | Text on secondary                                                               |
| `--muted`                | `#efebe3`                  | `#1b2b2b`             | Disabled backgrounds, skeleton base                                             |
| `--muted-foreground`     | `#5b6666`                  | `#a3b3b1`             | Secondary text, descriptions                                                    |
| `--surface`              | `#f4f0e8`                  | `#122020`             | Subtle background differentiation                                               |
| `--border`               | `#ddd6c8`                  | `#2a3d3d`             | Borders, dividers                                                               |
| `--input`                | `#857c6c`                  | `#6a8786`             | Input borders and control boundaries (3:1 for non text elements in both themes) |
| `--ring`                 | `#0f5c5c`                  | `#5fb8b3`             | Focus rings                                                                     |
| `--overlay`              | `rgb(31 42 42 / 0.55)`     | `rgb(0 0 0 / 0.7)`    | Modal, drawer, and mobile menu backdrop scrims                                  |

### Status tokens

| Token                      | Light     | Dark      | Usage                               |
| -------------------------- | --------- | --------- | ----------------------------------- |
| `--destructive`            | `#b42318` | `#f97066` | Error states, delete actions        |
| `--destructive-foreground` | `#ffffff` | `#1a0606` | Text on destructive                 |
| `--success`                | `#2f7d4f` | `#6fcf97` | Success states, in stock indicators |
| `--success-foreground`     | `#ffffff` | `#0b1f12` | Text on success                     |

### Color usage guide

Use this table to choose a color role. Each role is a token pair: the fill and the text or icon that sits on it.

| Role        | Token           | When to use                                                  | Text safe on page background?                                                                                                   |
| ----------- | --------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Primary     | `--primary`     | Main calls to action, links, active navigation, focus ring   | Yes                                                                                                                             |
| Accent      | `--accent`      | Decorative emphasis: star ratings, premium or special badges | No in light theme (about 3.4:1, a non text fill only). Use `--accent-foreground` text on accent fills. Dark theme is text safe. |
| Secondary   | `--secondary`   | Quiet buttons and soft fills that should not pull attention  | Use `--secondary-foreground` text                                                                                               |
| Highlight   | `--highlight`   | Sale prices and attention badges only                        | Yes (about 5.2:1 on the light background). Use `--highlight-foreground` text on highlight fills.                                |
| Destructive | `--destructive` | Errors and delete actions only                               | Yes                                                                                                                             |
| Success     | `--success`     | Confirmations and in stock indicators                        | Yes                                                                                                                             |

Rules of thumb:

- Choose primary for anything the shopper should click. Do not use it for prices.
- Choose highlight for sale prices. Do not use accent for sale prices.
- Choose accent for decoration, not for information the shopper must read. Star ratings are the one current use, and they also expose the value through `aria-label`.
- Do not use `--accent` as text color on light backgrounds. Star fills in light theme measure about 3.4:1 against the page background and about 3.6:1 against white cards, which meets the 3:1 guideline for non text elements.

### Elevation (shadows)

| Token            | Value                        | Usage                     |
| ---------------- | ---------------------------- | ------------------------- |
| `--elevation-sm` | `0 1px 2px` with low opacity | Cards at rest, inputs     |
| `--elevation-md` | `0 4px 12px`                 | Cards on hover, dropdowns |
| `--elevation-lg` | `0 12px 28px`                | Modals, drawers           |

### Radius

| Token           | Value     | Usage                      |
| --------------- | --------- | -------------------------- |
| `--radius-sm`   | `0.25rem` | Small badges, chips        |
| `--radius-md`   | `0.5rem`  | Inputs, small cards        |
| `--radius-lg`   | `0.75rem` | Cards, modals              |
| `--radius-xl`   | `1rem`    | Large cards, hero sections |
| `--radius-full` | `9999px`  | Avatars, round buttons     |

---

## Typography

### Fonts

| Variable          | Font family      | Loaded via         | Usage                                  |
| ----------------- | ---------------- | ------------------ | -------------------------------------- |
| `--font-dm-sans`  | DM Sans          | `next/font/google` | Body text, UI controls                 |
| `--font-playfair` | Playfair Display | `next/font/google` | Headings (h1 through h4), display text |

Tailwind mappings: `font-sans` resolves to DM Sans, `font-heading` resolves to Playfair Display.

### Type scale

| Size   | Font size       | Line height | Letter spacing | Usage                    |
| ------ | --------------- | ----------- | -------------- | ------------------------ |
| `xs`   | 0.75rem (12px)  | 1rem        | 0.02em         | Captions, fine print     |
| `sm`   | 0.875rem (14px) | 1.25rem     | 0.01em         | Labels, descriptions     |
| `base` | 1rem (16px)     | 1.5rem      | 0              | Body text                |
| `lg`   | 1.125rem (18px) | 1.75rem     | 0              | Subheadings, card titles |
| `xl`   | 1.25rem (20px)  | 1.75rem     | -0.01em        | Section headings         |
| `2xl`  | 1.5rem (24px)   | 2rem        | -0.015em       | Page subheadings         |
| `3xl`  | 1.875rem (30px) | 2.25rem     | -0.02em        | Page titles (h1)         |

Use Tailwind classes: `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`.

---

## Spacing system

Uses Tailwind's default spacing scale (4px base, so `p-4` = 16px, `gap-6` = 24px). No custom spacing tokens beyond the scale.

Key conventions:

- Card internal padding: `p-4` to `p-6`
- Section vertical padding: `py-12` (mobile) / `py-16` (desktop)
- Container horizontal padding: `px-4` (mobile) / `px-6` (sm) / `px-8` (lg)
- Gap between grid items: `gap-4` to `gap-6`

---

## Layout

### Storefront layout

- **Container**: max width 1280px, centered, with responsive padding (`Container` component)
- **Header**: sticky, glassmorphic (`bg-card/80 backdrop-blur-md`), with nav, theme toggle, cart/auth icons
- **Footer**: four column link grid, brand column, social icons, legal links

### Admin layout

- **Full width fluid**: no max width container
- **Collapsible sidebar**: 256px expanded, 64px collapsed, with icon + label navigation
- **Mobile**: sidebar becomes an overlay drawer

---

## Component library

### Shadcn UI primitives (`src/components/ui/`)

All installed via `npx shadcn@latest` and customized to use project tokens. Use CVA variants for size and visual variant.

| Component          | Variants                                                                                                                   | Notes                                                                                                                                                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`           | variant: default, destructive, outline, secondary, ghost, link; size: default, xs, sm, lg, icon, icon-xs, icon-sm, icon-lg | Uses `asChild` for link buttons                                                                                                                                                                                                                          |
| `Input`            | —                                                                                                                          | 36px height (`h-9`). Border uses `--input`. On focus the native outline is removed (`outline-none`) and replaced by a 2px `--ring` ring (`focus-visible:ring-2`) with `focus-visible:border-ring`. Invalid state uses `aria-invalid:border-destructive`. |
| `Textarea`         | —                                                                                                                          | Same styling as Input                                                                                                                                                                                                                                    |
| `Select`           | —                                                                                                                          | Radix based, scrollable                                                                                                                                                                                                                                  |
| `Checkbox`         | —                                                                                                                          | Radix based, animated check                                                                                                                                                                                                                              |
| `Switch`           | —                                                                                                                          | Radix based, toggle                                                                                                                                                                                                                                      |
| `Badge`            | variant: default, secondary, destructive, outline                                                                          | For product types, status                                                                                                                                                                                                                                |
| `Card`             | Sub components: CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter                                | Main content container                                                                                                                                                                                                                                   |
| `Dialog`           | Sub components: DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose      | Modal dialogs                                                                                                                                                                                                                                            |
| `DropdownMenu`     | Full Radix menu with sub menus, checkboxes, radio groups                                                                   | Used for action menus                                                                                                                                                                                                                                    |
| `Avatar`           | Sub components: AvatarImage, AvatarFallback                                                                                | User avatars                                                                                                                                                                                                                                             |
| `Skeleton`         | —                                                                                                                          | Themed warm shimmer animation                                                                                                                                                                                                                            |
| `Toaster` (Sonner) | —                                                                                                                          | Toast notifications, themed                                                                                                                                                                                                                              |

### Composed components (`src/components/`)

| Component         | Props                                                                                                                                | Usage                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `Header`          | —                                                                                                                                    | Storefront header with nav, theme toggle, search, cart, auth, mobile drawer |
| `Footer`          | —                                                                                                                                    | Storefront footer with link columns, social, legal                          |
| `Breadcrumbs`     | `items: BreadcrumbItem[]`, `showHome?: boolean`                                                                                      | Page hierarchy navigation                                                   |
| `MobileNavDrawer` | `open: boolean`, `onClose: () => void`                                                                                               | Slide out mobile menu (used inside Header)                                  |
| `ThemeToggle`     | —                                                                                                                                    | Sun/moon toggle (used inside Header)                                        |
| `AdminLayout`     | `children: ReactNode`                                                                                                                | Full width admin shell with collapsible sidebar                             |
| `AdminSidebar`    | `collapsed: boolean`, `onToggle: () => void`                                                                                         | Collapsible icon + label nav                                                |
| `Container`       | `children`, `as?: "div" \| "section" \| "main" \| "article"`, `className?`                                                           | 1280px max width centered wrapper                                           |
| `Section`         | `children`, `id?`, `className?`                                                                                                      | Vertical section with `py-12/16`                                            |
| `PageHeader`      | `title: string`, `description?: string`, `children?`                                                                                 | h1 page title with action slot                                              |
| `Divider`         | `label?: string`, `className?`                                                                                                       | Horizontal rule, optionally labeled                                         |
| `ProductCard`     | `slug`, `title`, `imageUrl`, `priceBdt`, `priceUsd`, `activeCurrency?`, `averageRating?`, `reviewCount?`, `productType?`, `inStock?` | Product catalog grid card                                                   |
| `PriceDisplay`    | `priceBdt: number`, `priceUsd: number`, `activeCurrency?: "BDT" \| "USD"`, `compareAtBdt?`, `compareAtUsd?`, `size?`                 | Currency aware price with sale strikethrough                                |
| `QuantityStepper` | `value: number`, `onChange: (v: number) => void`, `min?`, `max?`, `disabled?`                                                        | Increment/decrement quantity                                                |
| `StarRating`      | `rating: number` (1 to `maxStars`), `maxStars?` (default 5), `size?: "sm" \| "md" \| "lg"`, `showValue?`                             | Display only star rating, 1 to 5 with half stars                            |
| `FormField`       | `label: string`, `description?`, `error?`, `required?`, `htmlFor?`, `children`                                                       | Label + error + description wrapper                                         |
| `FileUploadZone`  | `onFiles: (files: File[]) => void`, `accept?`, `maxSize?`, `multiple?`, `label?`, `description?`, `disabled?`                        | Drag and drop file upload with validation                                   |
| `EmptyState`      | `heading: string`, `description?`, `icon?`, `action?: {label, onClick}`, `children?`                                                 | Centered empty data placeholder                                             |
| `ErrorBoundary`   | `fallback?`, `onError?`, `children`, `className?`                                                                                    | React error boundary with retry                                             |

---

## Accessibility rules

1. **Focus ring**: 2px solid `--ring` color with 2px offset, applied globally via `:focus-visible` in `globals.css`. Inputs replace the outline with a 2px ring of the same color.
2. **Contrast**: Each foreground token meets WCAG 2.1 AA (4.5:1 normal text, 3:1 large text and non text elements) against the surface it is documented for, in both themes. Text safe tokens: `--foreground`, `--muted-foreground`, `--primary`, `--highlight`, and every `*-foreground` token on its matching fill. Two exceptions:
   - `--accent` fails as text on light backgrounds (about 3.4:1, below 4.5:1). It is safe only as a non text fill with `--accent-foreground` text, or as text in dark theme.
   - `--surface` and `--border` are decorative only (about 1.1:1 and 1.4:1 light, 1.1:1 and 1.55:1 dark). They fail the 3:1 rule for non text elements, so never use them alone to show an interactive boundary or state. Use `--input` for control boundaries.
3. **Touch targets**: All interactive elements (buttons, links, inputs) have a minimum of 44px in at least one dimension.
4. **Motion**: `prefers-reduced-motion: reduce` disables all animations and transitions via the global CSS guard in `globals.css`.
5. **ARIA**: Nav regions use `aria-label`, breadcrumbs use `aria-current="page"`, error messages use `role="alert"`, star ratings use `role="img"` with descriptive `aria-label`, quantity steppers use `aria-live="polite"`.
6. **Semantic HTML**: `<nav>`, `<main>`, `<header>`, `<footer>`, `<section>`, `<article>` used appropriately. Heading hierarchy (single h1 per page via PageHeader).

---

## Dark mode

Managed by `next-themes` with `attribute="data-theme"` on the `<html>` element.

- Default: system preference
- Manual override: via the ThemeToggle component (sun/moon icon in the header)
- No flash of wrong theme: `suppressHydrationWarning` on `<html>`, `disableTransitionOnChange` on the provider
- All tokens switch automatically; no per component dark mode logic needed

---

## Transition conventions

- Hover/focus/active state transitions: `duration-200` (the floor; never `duration-150`)
- Layout transitions (sidebar collapse, drawers): `duration-200` to `duration-300`
- Image hover zoom (ProductCard): `duration-300`
- All transitions include `motion-reduce:transition-none`

---

## Icon conventions

- **Icon library**: Lucide React (`lucide-react`)
- **Social brand icons**: Inline SVG components (FacebookIcon, InstagramIcon, YoutubeIcon) since Lucide does not include brand icons
- **Sizing**: Use Lucide's size prop or Tailwind `size-*` classes. Standard sizes: `size-4` (16px) in buttons, `size-5` (20px) in nav
- **Accessibility**: Decorative icons get `aria-hidden="true"`. Standalone interactive icons (icon buttons) get an `aria-label` on the button
