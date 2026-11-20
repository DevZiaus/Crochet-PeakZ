/**
 * Tests for the storefront Header and its mobile navigation drawer (AC-8).
 *
 * The drawer is built on the shared DialogContent, which centers itself with
 * `left-[50%]` and `translate-x-[-50%] translate-y-[-50%]`. The drawer must
 * override those utilities, otherwise it renders half above the viewport and
 * its close button is unreachable. The class assertion below guards that CSS
 * cascade fix; the rest of the suite checks the behaviour a shopper relies on.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname } from "next/navigation";
import { Currency } from "@crochet-peakz/shared";
import { CurrencyProvider } from "./currency/currency-provider";
import { Header, MobileNavDrawer, navLinks } from "./header";
import { mockDesktopBreakpoint } from "../test/match-media";

// The account control reads the session with `useSession`, which would call
// `/api/auth/me`. Stub it to the signed out state so the suite stays offline
// and deterministic, and so the account control renders its real signed out
// link instead of waiting on a request.
vi.mock("../lib/auth/use-session", () => ({
  useSession: () => ({
    user: null,
    loading: false,
    signOut: () => Promise.resolve({ success: true as const }),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(usePathname).mockReturnValue("/");
});

describe("Header", () => {
  it("renders the home link and every main navigation link", () => {
    render(<Header />);

    expect(
      screen.getByRole("link", { name: "Crochet PeakZ home" }),
    ).toHaveAttribute("href", "/");

    const mainNavigation = screen.getByRole("navigation", {
      name: "Main navigation",
    });

    for (const link of navLinks) {
      expect(
        within(mainNavigation).getByRole("link", { name: link.label }),
      ).toHaveAttribute("href", link.href);
    }
  });

  it("renders the navigation without duplicate React keys", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      render(<Header />);
      render(<MobileNavDrawer open onClose={() => undefined} />);

      const duplicateKeyWarnings = consoleError.mock.calls.filter((call) =>
        String(call[0]).includes("same key"),
      );
      expect(duplicateKeyWarnings).toHaveLength(0);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("marks the current route and its child routes as the active page", () => {
    vi.mocked(usePathname).mockReturnValue("/shop/hats");
    render(<Header />);

    const mainNavigation = screen.getByRole("navigation", {
      name: "Main navigation",
    });

    expect(
      within(mainNavigation).getByRole("link", { name: "Shop" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(mainNavigation).getByRole("link", { name: "Blog" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("gives every header action an accessible name and shows the currency switcher inside CurrencyProvider", () => {
    render(
      <CurrencyProvider currency={Currency.BDT}>
        <Header />
      </CurrencyProvider>,
    );

    for (const name of ["Search products", "Shopping cart", "Open menu"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }

    expect(
      screen.getByRole("link", { name: "Sign in to your account" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Switch to dark mode" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Currency: ৳ BDT" }),
    ).toBeEnabled();
  });

  it("hides the currency control when rendered outside CurrencyProvider (auth and admin layouts, AC-1)", () => {
    render(<Header />);

    expect(
      screen.queryByRole("button", { name: /Currency:/ }),
    ).not.toBeInTheDocument();
  });

  it("opens the mobile drawer with the same navigation links and a close button", async () => {
    const user = userEvent.setup();
    render(<Header />);

    await user.click(screen.getByRole("button", { name: "Open menu" }));

    const drawer = await screen.findByRole("dialog", {
      name: "Mobile navigation",
    });
    const mobileNavigation = within(drawer).getByRole("navigation", {
      name: "Mobile navigation",
    });

    for (const link of navLinks) {
      expect(
        within(mobileNavigation).getByRole("link", { name: link.label }),
      ).toBeInTheDocument();
    }
    expect(
      within(drawer).getByRole("button", { name: "Close menu" }),
    ).toBeInTheDocument();
  });

  it("renders one dialog overlay and hides it at the large breakpoint", async () => {
    const user = userEvent.setup();
    render(<Header />);

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await screen.findByRole("dialog", { name: "Mobile navigation" });

    expect(
      document.querySelectorAll('[data-slot="dialog-overlay"]'),
    ).toHaveLength(1);

    const overlay = document.querySelector<HTMLElement>(
      '[data-slot="dialog-overlay"]',
    );
    if (!overlay) throw new Error("dialog overlay missing");
    expect(overlay).toHaveClass("lg:hidden");
  });

  it("closes the mobile drawer with its close button", async () => {
    const user = userEvent.setup();
    render(<Header />);

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const drawer = await screen.findByRole("dialog", {
      name: "Mobile navigation",
    });
    await user.click(
      within(drawer).getByRole("button", { name: "Close menu" }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Mobile navigation" }),
      ).not.toBeInTheDocument();
    });
  });

  it("closes the mobile drawer when Escape is pressed", async () => {
    const user = userEvent.setup();
    render(<Header />);

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await screen.findByRole("dialog", { name: "Mobile navigation" });
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Mobile navigation" }),
      ).not.toBeInTheDocument();
    });
  });

  it("returns focus to the menu button after the drawer closes", async () => {
    const user = userEvent.setup();
    render(<Header />);

    const menuButton = screen.getByRole("button", { name: "Open menu" });
    menuButton.focus();
    await user.click(menuButton);
    await screen.findByRole("dialog", { name: "Mobile navigation" });
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(menuButton).toHaveFocus();
    });
  });

  it("closes the drawer when the viewport crosses the desktop breakpoint", async () => {
    const media = mockDesktopBreakpoint();

    try {
      const user = userEvent.setup();
      render(<Header />);

      await user.click(screen.getByRole("button", { name: "Open menu" }));
      await screen.findByRole("dialog", { name: "Mobile navigation" });

      media.crossToDesktop();

      await waitFor(() => {
        expect(
          screen.queryByRole("dialog", { name: "Mobile navigation" }),
        ).not.toBeInTheDocument();
      });
    } finally {
      media.restore();
    }
  });

  it("returns focus to the home link when the breakpoint hides the hamburger", async () => {
    // The hamburger is `lg:hidden`, so at desktop width it cannot take focus.
    // Restoring focus to it would drop focus on `body`; the drawer must hand it
    // to the always-rendered home link instead.
    const media = mockDesktopBreakpoint();

    try {
      const user = userEvent.setup();
      render(<Header />);

      const menuButton = screen.getByRole("button", { name: "Open menu" });
      await user.click(menuButton);
      await screen.findByRole("dialog", { name: "Mobile navigation" });

      media.crossToDesktop();

      await waitFor(() => {
        expect(
          screen.queryByRole("dialog", { name: "Mobile navigation" }),
        ).not.toBeInTheDocument();
      });

      const homeLink = screen.getByRole("link", {
        name: "Crochet PeakZ home",
      });
      await waitFor(() => {
        expect(homeLink).toHaveFocus();
      });
      expect(menuButton).not.toHaveFocus();
      expect(document.activeElement).not.toBe(document.body);
    } finally {
      media.restore();
    }
  });

  it("closes the mobile drawer after a navigation link is chosen", async () => {
    const user = userEvent.setup();
    render(<Header />);

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const drawer = await screen.findByRole("dialog", {
      name: "Mobile navigation",
    });
    await user.click(within(drawer).getByRole("link", { name: "Shop" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Mobile navigation" }),
      ).not.toBeInTheDocument();
    });
  });

  it("moves focus into the drawer and keeps Tab inside it while open", async () => {
    const user = userEvent.setup();
    render(<Header />);

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const drawer = await screen.findByRole("dialog", {
      name: "Mobile navigation",
    });
    const closeButton = within(drawer).getByRole("button", {
      name: "Close menu",
    });

    await waitFor(() => {
      expect(closeButton).toHaveFocus();
    });

    for (let step = 0; step < 8; step += 1) {
      await user.tab();
      expect(drawer.contains(document.activeElement)).toBe(true);
    }
  });
});

describe("MobileNavDrawer", () => {
  it("marks the current route as the active page inside the drawer", () => {
    vi.mocked(usePathname).mockReturnValue("/collections/spring");
    render(<MobileNavDrawer open onClose={() => undefined} />);

    const mobileNavigation = screen.getByRole("navigation", {
      name: "Mobile navigation",
    });

    expect(
      within(mobileNavigation).getByRole("link", { name: "Collections" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("overrides the centered dialog positioning so the drawer sits on screen", () => {
    render(<MobileNavDrawer open onClose={() => undefined} />);

    const drawer = screen.getByRole("dialog", { name: "Mobile navigation" });

    expect(drawer).toHaveClass(
      "left-auto",
      "translate-x-0",
      "translate-y-0",
      "sm:max-w-xs",
    );
    expect(drawer).not.toHaveClass(
      "left-[50%]",
      "translate-x-[-50%]",
      "translate-y-[-50%]",
      "sm:max-w-lg",
    );
  });
});
