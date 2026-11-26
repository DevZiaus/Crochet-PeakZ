"use client";

import { type ReactNode, useState, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  CreditCard,
  Settings,
  Tags,
  FileText,
  Users,
  ChevronLeft,
  ChevronRight,
  Menu,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useCloseOnDesktop,
  type CloseReason,
} from "@/hooks/use-close-on-desktop";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface AdminNavItem {
  /** The visible label. */
  label: string;
  /** The route path. */
  href: string;
  /** The Lucide icon component. */
  icon: LucideIcon;
}

const adminNavItems: AdminNavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Products", href: "/admin/products", icon: Package },
  { label: "Orders", href: "/admin/orders", icon: ShoppingCart },
  { label: "Customers", href: "/admin/customers", icon: Users },
  { label: "Payments", href: "/admin/payments", icon: CreditCard },
  { label: "Coupons", href: "/admin/coupons", icon: Tags },
  { label: "Blog", href: "/admin/blog", icon: FileText },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

interface AdminSidebarProps {
  /** Whether the sidebar is collapsed to icon only mode. */
  collapsed: boolean;
  /** Toggle callback for collapse state. */
  onToggle: () => void;
  /**
   * Accessible name for the toggle button. Defaults to expand or collapse
   * wording; the mobile overlay passes a close label, because there the button
   * dismisses the drawer instead of collapsing the sidebar.
   */
  toggleLabel?: string;
  /**
   * Called when a navigation item is chosen. The mobile drawer passes its close
   * handler so choosing a link dismisses the drawer; the desktop sidebar passes
   * nothing, because there is no drawer to close.
   */
  onNavigate?: () => void;
}

/**
 * Collapsible admin sidebar with icon + label navigation items.
 * Highlights the active route. Supports collapsed (icon only) and expanded modes.
 */
function AdminSidebar({
  collapsed,
  onToggle,
  toggleLabel,
  onNavigate,
}: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border bg-card transition-[width] duration-200 motion-reduce:transition-none",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <Image
              src="/logo.webp"
              alt=""
              width={28}
              height={28}
              sizes="28px"
              className="size-7 shrink-0 rounded-full object-cover"
            />
            <span className="font-heading text-lg font-bold text-foreground">
              Admin
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggle}
          aria-label={
            toggleLabel ?? (collapsed ? "Expand sidebar" : "Collapse sidebar")
          }
          className={cn(collapsed && "mx-auto")}
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 space-y-1 overflow-y-auto p-2"
        aria-label="Admin navigation"
      >
        {adminNavItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 motion-reduce:transition-none",
                "min-h-[44px]",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                collapsed && "justify-center px-2",
              )}
              aria-current={isActive ? "page" : undefined}
              aria-label={collapsed ? item.label : undefined}
            >
              <item.icon className="size-5 shrink-0" aria-hidden="true" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

interface AdminLayoutProps {
  /** The main content. */
  children: ReactNode;
}

/**
 * Full width fluid admin layout with a collapsible sidebar.
 * The sidebar persists collapse state in local component state.
 * Uses design tokens for all colors and spacing.
 */
function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [closeReason, setCloseReason] = useState<CloseReason>("interaction");
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

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
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <AdminSidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      </div>

      {/* Mobile sidebar drawer. Radix Dialog supplies the focus trap,
          `aria-modal`, Escape handling, and background inerting; focus is
          restored to the hamburger explicitly because it opens the dialog from
          outside a Radix trigger. */}
      <Dialog
        open={mobileOpen}
        onOpenChange={(open) => {
          if (!open) closeMobile();
        }}
      >
        <DialogContent
          overlayClassName="lg:hidden"
          className="fixed top-0 bottom-0 left-0 right-auto z-50 w-64 max-w-xs translate-x-0 translate-y-0 border-none bg-card p-0 shadow-lg outline-none sm:max-w-xs lg:hidden"
          aria-label="Admin navigation"
          aria-modal="true"
          showCloseButton={false}
          onCloseAutoFocus={(event) => {
            const target =
              closeReason === "breakpoint"
                ? mainRef.current
                : menuButtonRef.current;

            if (target) {
              event.preventDefault();
              target.focus();
            }
          }}
        >
          <AdminSidebar
            collapsed={false}
            onToggle={closeMobile}
            toggleLabel="Close admin navigation"
            onNavigate={closeMobile}
          />
        </DialogContent>
      </Dialog>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header bar */}
        <div className="flex h-16 items-center gap-4 border-b border-border px-4 lg:hidden">
          <Button
            ref={menuButtonRef}
            variant="ghost"
            size="icon-sm"
            onClick={toggleMobile}
            aria-label="Open admin navigation"
          >
            <Menu className="size-5" />
          </Button>
          <div className="flex items-center gap-2.5">
            <Image
              src="/logo.webp"
              alt=""
              width={28}
              height={28}
              sizes="28px"
              className="size-7 shrink-0 rounded-full object-cover"
            />
            <span className="font-heading text-lg font-bold text-foreground">
              Admin
            </span>
          </div>
        </div>

        <main
          ref={mainRef}
          tabIndex={-1}
          className="flex-1 overflow-y-auto p-6 outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export { AdminLayout, AdminSidebar, adminNavItems };
export type { AdminLayoutProps, AdminNavItem };
