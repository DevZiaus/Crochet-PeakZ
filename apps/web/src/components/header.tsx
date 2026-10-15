"use client";

import { useState, useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag, User, Sun, Moon, Menu, X, Search } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/container";

interface NavLink {
  /** The visible label. */
  label: string;
  /** The route path. */
  href: string;
}

const navLinks: NavLink[] = [
  { label: "Shop", href: "/shop" },
  { label: "Collections", href: "/collections" },
  { label: "Custom Orders", href: "/custom" },
  { label: "Patterns", href: "/patterns" },
  { label: "Blog", href: "/blog" },
];

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
 * Mobile navigation drawer. Slides in from the right on small screens.
 * Includes nav links, theme toggle, and close button.
 */
function MobileNavDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-overlay backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full max-w-xs bg-card shadow-lg transition-transform duration-300 ease-in-out motion-reduce:transition-none lg:hidden",
          open ? "translate-x-0" : "translate-x-full",
        )}
        inert={!open}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
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
            <X className="size-5" />
          </Button>
        </div>

        <nav className="flex flex-col gap-1 p-4" aria-label="Mobile navigation">
          {navLinks.map((link) => {
            const isActive =
              pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
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

        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <span className="text-sm text-muted-foreground">Theme</span>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Storefront header with logo, desktop nav links, currency switcher placeholder,
 * theme toggle, cart icon placeholder, and auth placeholder.
 * Responsive: shows hamburger menu on mobile.
 */
function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleMobile = useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  const closeMobile = useCallback(() => {
    setMobileOpen(false);
  }, []);

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
              href="/"
              className="flex items-center gap-2 transition-opacity duration-200 hover:opacity-80 motion-reduce:transition-none"
              aria-label="Crochet PeakZ home"
            >
              <span className="font-heading text-xl font-bold text-primary">
                Crochet PeakZ
              </span>
            </Link>

            {/* Desktop navigation */}
            <nav
              className="hidden items-center gap-1 lg:flex"
              aria-label="Main navigation"
            >
              {navLinks.map((link) => {
                const isActive =
                  pathname === link.href ||
                  pathname.startsWith(link.href + "/");
                return (
                  <Link
                    key={link.href}
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
              {/* Currency switcher placeholder */}
              <Button
                variant="ghost"
                size="sm"
                className="hidden text-xs font-semibold text-muted-foreground sm:inline-flex min-h-[44px]"
                aria-label="Switch currency (coming soon)"
                disabled
              >
                ৳ BDT
              </Button>

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

              {/* Cart */}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Shopping cart"
                className="relative min-h-[44px] min-w-[44px]"
              >
                <ShoppingBag className="size-5" />
              </Button>

              {/* Auth */}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Account"
                className="min-h-[44px] min-w-[44px]"
              >
                <User className="size-5" />
              </Button>

              {/* Mobile hamburger */}
              <Button
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
      <MobileNavDrawer open={mobileOpen} onClose={closeMobile} />
    </>
  );
}

export { Header, ThemeToggle, MobileNavDrawer, navLinks };
export type { NavLink };
