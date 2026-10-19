"use client";

import { type ReactNode, useState, useCallback, useEffect } from "react";
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
import { Button } from "@/components/ui/button";

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
}

/**
 * Collapsible admin sidebar with icon + label navigation items.
 * Highlights the active route. Supports collapsed (icon only) and expanded modes.
 */
function AdminSidebar({ collapsed, onToggle, toggleLabel }: AdminSidebarProps) {
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
          <span className="font-heading text-lg font-bold text-foreground">
            Admin
          </span>
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
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 motion-reduce:transition-none",
                "min-h-[44px]",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                collapsed && "justify-center px-2",
              )}
              aria-current={isActive ? "page" : undefined}
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

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const toggleMobile = useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  // Close mobile drawer on Escape key
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        toggleMobile();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
    };
  }, [mobileOpen, toggleMobile]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <AdminSidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-overlay lg:hidden"
            onClick={toggleMobile}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <AdminSidebar
              collapsed={false}
              onToggle={toggleMobile}
              toggleLabel="Close admin navigation"
            />
          </div>
        </>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header bar */}
        <div className="flex h-16 items-center gap-4 border-b border-border px-4 lg:hidden">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleMobile}
            aria-label="Open admin navigation"
          >
            <Menu className="size-5" />
          </Button>
          <span className="font-heading text-lg font-bold text-foreground">
            Admin
          </span>
        </div>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

export { AdminLayout, AdminSidebar, adminNavItems };
export type { AdminLayoutProps, AdminNavItem };
