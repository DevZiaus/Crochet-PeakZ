/// <reference types="@testing-library/jest-dom" />

/**
 * Tests for AdminSidebar and AdminLayout components.
 * Covers:
 * - Navigation item rendering (AC-8)
 * - Collapsible sidebar state (AC-8)
 * - Mobile drawer accessible label toggle (AC-8)
 * - Escape key closes mobile drawer (lint fix verification)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock next/navigation
const mockUsePathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

// Import after mock
import { AdminSidebar, AdminLayout, adminNavItems } from "./admin-layout";

describe("AdminSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue("/admin");
  });

  describe("navigation items", () => {
    it("renders all navigation items with correct labels", () => {
      render(<AdminSidebar collapsed={false} onToggle={vi.fn()} />);

      // Check nav items from the constants
      adminNavItems.forEach((item) => {
        expect(screen.getByText(item.label)).toBeInTheDocument();
      });
    });

    it("marks active route correctly", () => {
      mockUsePathname.mockReturnValue("/admin/products");
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

      // When collapsed, nav item labels are also hidden (only icons show)
      // The nav links are still present but without text
      const dashboardLinks = screen.getAllByRole("link");
      expect(dashboardLinks.length).toBe(adminNavItems.length);
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
    mockUsePathname.mockReturnValue("/admin");
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
    mockUsePathname.mockReturnValue("/admin");
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
    mockUsePathname.mockReturnValue("/admin");

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

  it("mobile drawer toggle button closes drawer when clicked", async () => {
    const user = userEvent.setup();
    mockUsePathname.mockReturnValue("/admin");

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
    mockUsePathname.mockReturnValue("/admin");
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
});
