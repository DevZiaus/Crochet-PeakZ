"use client";

import {
  useState,
  useCallback,
  useSyncExternalStore,
  useRef,
  type RefObject,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag, Sun, Moon, Menu, XIcon, Search } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import {
  useCloseOnDesktop,
  type CloseReason,
} from "@/hooks/use-close-on-desktop";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { Container } from "@/components/container";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AuthMenu } from "@/components/auth/auth-menu";
import { useOptionalCart } from "@/components/cart/cart-provider";
import { useOptionalCurrency } from "@/components/currency/currency-provider";
import { CurrencyRadio } from "@/components/currency/currency-radio";
import { CurrencySwitcher } from "@/components/currency/currency-switcher";
import {
  formatCartBadgeCount,
  getCartButtonAriaLabel,
} from "@/lib/cart/labels";

interface NavLink {
  /** The visible label. */
  label: string;
  /** The route path. */
  href: string;
  /** Path prefix used for active matching. Defaults to `href`; `null` disables active matching. */
  matchPath?: string | null;
}

const navLinks: NavLink[] = [
  { label: "Shop", href: "/shop" },
  { label: "Collections", href: "/collections" },
  { label: "Custom Orders", href: "/shop", matchPath: null },
  { label: "Patterns", href: "/patterns" },
  { label: "Blog", href: "/blog" },
];

/**
 * Returns whether a navigation link should be marked active for `pathname`.
 */
function isNavLinkActive(link: NavLink, pathname: string): boolean {
  const target = link.matchPath === undefined ? link.href : link.matchPath;
  if (target === null) {
    return false;
  }
  return pathname === target || pathname.startsWith(`${target}/`);
}

/**
 * Resolves to `false` during server render and the hydration pass, then `true`
 * once the client is live. `next-themes` cannot know the theme until the client
 * reads localStorage, so anything rendered from the resolved theme has to wait
 * for this before it may differ from the server output.
 */
const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * Theme toggle button using next-themes. Switches between light and dark.
 * Renders a sun or moon icon depending on the current theme.
 *
 * The accessible name stays neutral until hydration finishes. `useTheme`
 * returns an unresolved theme during server render (the choice lives in
 * localStorage), so deriving the label from it on the first render makes the
 * server emit `Switch to dark mode` while a dark client emits
 * `Switch to light mode`, which React reports as a hydration mismatch. The icon
 * swap itself is pure CSS (`dark:` variants), so it needs no such guard.
 */
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {
        setTheme(isDark ? "light" : "dark");
      }}
      aria-label={
        hydrated
          ? `Switch to ${isDark ? "light" : "dark"} mode`
          : "Switch color theme"
      }
      className="min-h-[44px] min-w-[44px]"
    >
      <Sun className="size-5 scale-100 rotate-0 transition-transform duration-200 motion-reduce:transition-none dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute size-5 scale-0 rotate-90 transition-transform duration-200 motion-reduce:transition-none dark:scale-100 dark:rotate-0" />
    </Button>
  );
}

/**
 * Mobile navigation drawer built on the Radix Dialog primitive.
 * Slides in from the right on small screens. Includes nav links,
 * theme toggle, and close button. Radix handles the focus trap and
 * Escape. Focus restoration is wired explicitly because the drawer is
 * opened by a button outside the Radix trigger.
 *
 * The hamburger carries `lg:hidden`. When the drawer closes because the
 * viewport crossed `lg`, the button is display:none and cannot take focus, so
 * focus goes to the home link instead. That is keyed off the close reason
 * rather than a visibility read, which is not reliable across environments.
 */
function MobileNavDrawer({
  open,
  onClose,
  triggerRef,
  fallbackRef,
  closeReason = "interaction",
}: {
  open: boolean;
  onClose: () => void;
  /** The button that opened the drawer. Focus returns here when it closes. */
  triggerRef?: RefObject<HTMLButtonElement | null>;
  /** Focus target used when the trigger is hidden at the closing breakpoint. */
  fallbackRef?: RefObject<HTMLAnchorElement | null>;
  /** Why the drawer last closed, which selects the focus restore target. */
  closeReason?: CloseReason;
}) {
  const pathname = usePathname();
  const activeCurrency = useOptionalCurrency();
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent
        overlayClassName="lg:hidden"
        className={cn(
          "fixed inset-y-0 right-0 left-auto z-50 w-full max-w-xs translate-x-0 translate-y-0 border-none bg-card p-0 shadow-lg outline-none sm:max-w-xs lg:hidden",
        )}
        aria-label="Mobile navigation"
        aria-modal="true"
        showCloseButton={false}
        onCloseAutoFocus={(event) => {
          const target =
            closeReason === "breakpoint"
              ? fallbackRef?.current
              : triggerRef?.current;

          if (target) {
            event.preventDefault();
            target.focus();
          }
        }}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-6">
          <span className="font-heading text-lg font-bold text-foreground">
            Menu
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close menu"
            className="min-h-[44px] min-w-[44px]"
          >
            <XIcon className="size-5" />
          </Button>
        </div>

        <nav className="flex flex-col gap-1 p-4" aria-label="Mobile navigation">
          {navLinks.map((link) => {
            const isActive = isNavLinkActive(link, pathname);
            return (
              <Link
                key={link.label}
                href={link.href}
                onClick={onClose}
                className={cn(
                  "flex items-center rounded-lg px-4 py-3 text-base font-medium transition-colors duration-200 motion-reduce:transition-none",
                  "min-h-[44px]",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-4 border-t border-border p-4">
          {activeCurrency !== null ? <CurrencyRadio /> : null}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <span className="text-sm text-muted-foreground">Theme</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Storefront header with logo, desktop nav links, currency switcher (on
 * storefront pages), theme toggle, cart icon placeholder, and auth control.
 * Responsive: shows hamburger menu on mobile.
 */
function Header() {
  const pathname = usePathname();
  const activeCurrency = useOptionalCurrency();
  const cart = useOptionalCart();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const cartButtonRef = useRef<HTMLButtonElement>(null);
  const homeLinkRef = useRef<HTMLAnchorElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [closeReason, setCloseReason] = useState<CloseReason>("interaction");
  const cartBadge = cart ? formatCartBadgeCount(cart.itemCount) : null;

  const toggleMobile = useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  const closeMobile = useCallback(() => {
    setCloseReason("interaction");
    setMobileOpen(false);
  }, []);

  const closeMobileAtBreakpoint = useCallback(() => {
    setCloseReason("breakpoint");
    setMobileOpen(false);
  }, []);

  useCloseOnDesktop(mobileOpen, closeMobileAtBreakpoint);

  return (
    // The drawer is a sibling of the header, not a child. `backdrop-blur-md`
    // makes the header the containing block for fixed children, which would
    // clip a fixed drawer to the header box and push it into the scroll width.
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md">
        <Container>
          <div className="flex h-16 items-center justify-between">
            {/* Logo / Wordmark */}
            <Link
              ref={homeLinkRef}
              href="/"
              className="flex min-h-11 items-center transition-opacity duration-200 hover:opacity-80 motion-reduce:transition-none"
              aria-label="Crochet PeakZ home"
            >
              <BrandLogo size="sm" />
            </Link>

            {/* Desktop navigation */}
            <nav
              className="hidden items-center gap-1 lg:flex"
              aria-label="Main navigation"
            >
              {navLinks.map((link) => {
                const isActive = isNavLinkActive(link, pathname);
                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 motion-reduce:transition-none",
                      "min-h-[44px] flex items-center",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-1">
              {/* Currency switcher (storefront only) */}
              {activeCurrency !== null ? <CurrencySwitcher /> : null}

              {/* Search */}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Search products"
                className="min-h-[44px] min-w-[44px]"
              >
                <Search className="size-5" />
              </Button>

              {/* Theme toggle */}
              <div className="hidden sm:block">
                <ThemeToggle />
              </div>

              {/* Cart (storefront only, omitted outside CartProvider) */}
              {cart !== null ? (
                <Button
                  ref={cartButtonRef}
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    cart.openDrawer(cartButtonRef.current);
                  }}
                  aria-label={getCartButtonAriaLabel(cart.itemCount)}
                  className="relative min-h-[44px] min-w-[44px]"
                >
                  <ShoppingBag className="size-5" aria-hidden="true" />
                  {cartBadge !== null ? (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1 right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-highlight px-1 text-xs font-semibold leading-none text-highlight-foreground"
                    >
                      {cartBadge}
                    </span>
                  ) : null}
                </Button>
              ) : null}

              {/* Auth */}
              <AuthMenu />

              {/* Mobile hamburger */}
              <Button
                ref={menuButtonRef}
                variant="ghost"
                size="icon"
                onClick={toggleMobile}
                aria-label="Open menu"
                className="min-h-[44px] min-w-[44px] lg:hidden"
              >
                <Menu className="size-5" />
              </Button>
            </div>
          </div>
        </Container>
      </header>

      {/* Mobile nav drawer */}
      <MobileNavDrawer
        open={mobileOpen}
        onClose={closeMobile}
        triggerRef={menuButtonRef}
        fallbackRef={homeLinkRef}
        closeReason={closeReason}
      />
    </>
  );
}

export { Header, ThemeToggle, MobileNavDrawer, navLinks };
export type { NavLink };
