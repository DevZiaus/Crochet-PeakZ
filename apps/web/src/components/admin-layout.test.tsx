/**
 * Tests for AdminSidebar and AdminLayout components.
 * Covers:
 * - Navigation item rendering (AC-8)
 * - Collapsible sidebar state (AC-8)
 * - Mobile drawer accessible label toggle (AC-8)
 * - Escape key closes mobile drawer (lint fix verification)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname } from "next/navigation";
import { AdminSidebar, AdminLayout, adminNavItems } from "./admin-layout";
import { mockDesktopBreakpoint } from "../test/match-media";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(usePathname).mockReturnValue("/admin");
});

describe("AdminSidebar", () => {
  describe("navigation items", () => {
    it("renders all navigation items with correct labels", () => {
      render(<AdminSidebar collapsed={false} onToggle={vi.fn()} />);

      // Check nav items from the constants
      adminNavItems.forEach((item) => {
        expect(screen.getByText(item.label)).toBeInTheDocument();
      });
    });

    it("marks active route correctly", () => {
      vi.mocked(usePathname).mockReturnValue("/admin/products");
      render(<AdminSidebar collapsed={false} onToggle={vi.fn()} />);

      const productsLink = screen.getByText("Products").closest("a");
      expect(productsLink).toHaveAttribute("aria-current", "page");
    });
  });

  describe("collapse state", () => {
    it("shows label when expanded", () => {
      render(<AdminSidebar collapsed={false} onToggle={vi.fn()} />);

      // The "Admin" text appears only in the header, not in nav items
      const adminLabel = screen.getByText("Admin");
      expect(adminLabel).toBeInTheDocument();
      expect(adminLabel.closest(".font-heading")).toBeInTheDocument();
    });

    it("hides label when collapsed", () => {
      render(<AdminSidebar collapsed={true} onToggle={vi.fn()} />);

      // When collapsed, the header text "Admin" is hidden
      const adminLabel = screen.queryByText("Admin");
      expect(adminLabel).not.toBeInTheDocument();

      // When collapsed, the visible labels are gone but each link keeps its
      // accessible name, so screen readers and voice control can still use it.
      const dashboardLinks = screen.getAllByRole("link");
      expect(dashboardLinks.length).toBe(adminNavItems.length);
      adminNavItems.forEach((item) => {
        expect(
          screen.getByRole("link", { name: item.label }),
        ).toBeInTheDocument();
      });
    });

    it("toggle button has correct aria-label when expanded", () => {
      render(<AdminSidebar collapsed={false} onToggle={vi.fn()} />);

      const toggleButton = screen.getByRole("button", {
        name: "Collapse sidebar",
      });
      expect(toggleButton).toBeInTheDocument();
    });

    it("toggle button has correct aria-label when collapsed", () => {
      render(<AdminSidebar collapsed={true} onToggle={vi.fn()} />);

      const toggleButton = screen.getByRole("button", {
        name: "Expand sidebar",
      });
      expect(toggleButton).toBeInTheDocument();
    });
  });

  describe("toggleLabel prop (mobile drawer)", () => {
    it("uses toggleLabel for aria-label when provided", () => {
      render(
        <AdminSidebar
          collapsed={false}
          onToggle={vi.fn()}
          toggleLabel="Close admin navigation"
        />,
      );

      const toggleButton = screen.getByRole("button", {
        name: "Close admin navigation",
      });
      expect(toggleButton).toBeInTheDocument();
    });

    it("falls back to expand/collapse wording when toggleLabel not provided", () => {
      render(<AdminSidebar collapsed={false} onToggle={vi.fn()} />);

      const toggleButton = screen.getByRole("button", {
        name: "Collapse sidebar",
      });
      expect(toggleButton).toBeInTheDocument();
    });
  });
});

describe("AdminLayout", () => {
  it("renders children in main content area", () => {
    render(
      <AdminLayout>
        <div data-testid="test-child">Test Content</div>
      </AdminLayout>,
    );

    expect(screen.getByTestId("test-child")).toBeInTheDocument();
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  it("shows mobile hamburger button", () => {
    vi.mocked(usePathname).mockReturnValue("/admin");
    render(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>,
    );

    const hamburgerButton = screen.getByRole("button", {
      name: "Open admin navigation",
    });
    expect(hamburgerButton).toBeInTheDocument();
  });

  it("has desktop sidebar visible", () => {
    vi.mocked(usePathname).mockReturnValue("/admin");
    render(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>,
    );

    // The sidebar (aside) should be rendered - check for a navigation item
    // that only exists in the sidebar, not the mobile header
    const dashboardLinks = screen.getAllByRole("link", { name: "Dashboard" });
    expect(dashboardLinks.length).toBeGreaterThan(0);
  });

  it("toggles mobile drawer when hamburger clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(usePathname).mockReturnValue("/admin");

    render(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>,
    );

    const hamburgerButton = screen.getByRole("button", {
      name: "Open admin navigation",
    });

    await user.click(hamburgerButton);

    // Drawer toggle button inside should now say "Close admin navigation"
    expect(
      screen.getByRole("button", { name: "Close admin navigation" }),
    ).toBeInTheDocument();
  });

  it("renders one dialog overlay for the mobile drawer", async () => {
    const user = userEvent.setup();
    render(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>,
    );

    await user.click(
      screen.getByRole("button", { name: "Open admin navigation" }),
    );
    await screen.findByRole("dialog", { name: "Admin navigation" });

    expect(
      document.querySelectorAll('[data-slot="dialog-overlay"]'),
    ).toHaveLength(1);

    const overlay = document.querySelector<HTMLElement>(
      '[data-slot="dialog-overlay"]',
    );
    if (!overlay) throw new Error("dialog overlay missing");
    expect(overlay).toHaveClass("lg:hidden");
  });

  it("mobile drawer toggle button closes drawer when clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(usePathname).mockReturnValue("/admin");

    render(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>,
    );

    // Open the drawer
    const hamburgerButton = screen.getByRole("button", {
      name: "Open admin navigation",
    });
    await user.click(hamburgerButton);

    // Close the drawer via the toggle button inside
    const closeButton = screen.getByRole("button", {
      name: "Close admin navigation",
    });
    await user.click(closeButton);

    // Should be back to hamburger
    expect(
      screen.getByRole("button", { name: "Open admin navigation" }),
    ).toBeInTheDocument();
  });

  it("Escape key closes mobile drawer (lint fix verification)", async () => {
    vi.mocked(usePathname).mockReturnValue("/admin");
    const user = userEvent.setup();

    render(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>,
    );

    // Get the hamburger button to open drawer
    const hamburgerButton = screen.getByRole("button", {
      name: "Open admin navigation",
    });

    // Click to open drawer
    await user.click(hamburgerButton);

    // Verify drawer is open
    expect(
      screen.getByRole("button", { name: "Close admin navigation" }),
    ).toBeInTheDocument();

    // Simulate Escape key
    await user.keyboard("{Escape}");

    // Verify drawer is closed (back to hamburger)
    expect(
      screen.getByRole("button", { name: "Open admin navigation" }),
    ).toBeInTheDocument();
  });

  it("exposes the mobile drawer as a modal dialog and traps focus", async () => {
    const user = userEvent.setup();
    render(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>,
    );

    const hamburgerButton = screen.getByRole("button", {
      name: "Open admin navigation",
    });
    await user.click(hamburgerButton);

    const drawer = await screen.findByRole("dialog", {
      name: "Admin navigation",
    });
    expect(drawer).toHaveAttribute("aria-modal", "true");

    const closeButton = within(drawer).getByRole("button", {
      name: "Close admin navigation",
    });
    await waitFor(() => {
      expect(closeButton).toHaveFocus();
    });

    for (let step = 0; step < 10; step += 1) {
      await user.tab();
      expect(drawer.contains(document.activeElement)).toBe(true);
    }
  });

  it("closes the mobile drawer when the viewport crosses the desktop breakpoint", async () => {
    const media = mockDesktopBreakpoint();

    try {
      const user = userEvent.setup();
      render(
        <AdminLayout>
          <div>Content</div>
        </AdminLayout>,
      );

      await user.click(
        screen.getByRole("button", { name: "Open admin navigation" }),
      );
      await screen.findByRole("dialog", { name: "Admin navigation" });

      media.crossToDesktop();

      await waitFor(() => {
        expect(
          screen.queryByRole("dialog", { name: "Admin navigation" }),
        ).not.toBeInTheDocument();
      });
    } finally {
      media.restore();
    }
  });

  it("returns focus to the main content when the breakpoint hides the hamburger", async () => {
    // The admin hamburger lives in an `lg:hidden` bar, so at desktop width it
    // cannot take focus. The drawer hands focus to the main region instead, so
    // it never lands on `body`.
    const media = mockDesktopBreakpoint();

    try {
      const user = userEvent.setup();
      render(
        <AdminLayout>
          <div>Content</div>
        </AdminLayout>,
      );

      const hamburgerButton = screen.getByRole("button", {
        name: "Open admin navigation",
      });
      await user.click(hamburgerButton);
      await screen.findByRole("dialog", { name: "Admin navigation" });

      media.crossToDesktop();

      await waitFor(() => {
        expect(
          screen.queryByRole("dialog", { name: "Admin navigation" }),
        ).not.toBeInTheDocument();
      });

      const main = document.querySelector("main");
      if (!main) throw new Error("main region missing");
      await waitFor(() => {
        expect(main).toHaveFocus();
      });
      expect(hamburgerButton).not.toHaveFocus();
      expect(document.activeElement).not.toBe(document.body);
    } finally {
      media.restore();
    }
  });

  it("returns focus to the hamburger after the drawer closes", async () => {
    const user = userEvent.setup();
    render(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>,
    );

    const hamburgerButton = screen.getByRole("button", {
      name: "Open admin navigation",
    });
    await user.click(hamburgerButton);
    await screen.findByRole("dialog", { name: "Admin navigation" });
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(hamburgerButton).toHaveFocus();
    });
  });

  it("closes the mobile drawer when a navigation item is chosen", async () => {
    // The storefront drawer closes on every link click (`header.tsx`), and the
    // admin drawer must behave the same, or mobile navigation leaves the page
    // inert behind an open modal.
    const user = userEvent.setup();
    render(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>,
    );

    await user.click(
      screen.getByRole("button", { name: "Open admin navigation" }),
    );
    const drawer = await screen.findByRole("dialog", {
      name: "Admin navigation",
    });

    const link = drawer.querySelector<HTMLAnchorElement>(
      'a[href="/admin/products"]',
    );
    if (!link) throw new Error("admin nav link missing");
    await user.click(link);

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Admin navigation" }),
      ).not.toBeInTheDocument();
    });
  });

  it("closes the drawer even when the active navigation item is chosen", async () => {
    // Choosing the current route does not navigate, so the drawer must still
    // dismiss from its own handler, not from the route change.
    vi.mocked(usePathname).mockReturnValue("/admin");
    const user = userEvent.setup();
    render(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>,
    );

    await user.click(
      screen.getByRole("button", { name: "Open admin navigation" }),
    );
    const drawer = await screen.findByRole("dialog", {
      name: "Admin navigation",
    });

    const activeLink = drawer.querySelector<HTMLAnchorElement>(
      'a[href="/admin"][aria-current="page"]',
    );
    if (!activeLink) throw new Error("active admin nav link missing");
    await user.click(activeLink);

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Admin navigation" }),
      ).not.toBeInTheDocument();
    });
  });
});
