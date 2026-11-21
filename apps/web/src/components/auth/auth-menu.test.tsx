/**
 * Tests for the header account control.
 *
 * Signed out it has to offer sign in with the current page as `next`, so the
 * customer comes back to what they were reading. Signed in it has to show the
 * account, offer the admin area only to an admin, and sign out. The `next`
 * value is screened first, because a query parameter the browser builds from
 * the pathname is still a value the sign in screen will trust.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AuthUser } from "@crochet-peakz/shared";
import type { SessionState } from "../../lib/auth/use-session";

const { pathname, searchParams, routerReplace, routerRefresh, signOut } =
  vi.hoisted(() => ({
    pathname: { current: "/shop/hats" },
    searchParams: new URLSearchParams(),
    routerReplace: vi.fn(),
    routerRefresh: vi.fn(),
    signOut: vi.fn((): Promise<{ success: true } | { success: false }> =>
      Promise.resolve({ success: true }),
    ),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: routerReplace,
    push: vi.fn(),
    refresh: routerRefresh,
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => pathname.current,
  useSearchParams: () => searchParams,
  useSelectedLayoutSegment: () => null,
  useParams: () => ({}),
}));

vi.mock("../../lib/auth/use-session", () => ({
  useSession: vi.fn(),
}));

import { useSession } from "../../lib/auth/use-session";
import { AuthMenu } from "./auth-menu";

const mockedUseSession = vi.mocked(useSession);

const customer: AuthUser = {
  id: "user-1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  role: "CUSTOMER",
  avatarUrl: null,
  emailVerified: true,
};

const admin: AuthUser = {
  ...customer,
  id: "user-2",
  name: "PeakZ Admin",
  email: "admin@crochetpeakz.com",
  role: "ADMIN",
};

function session(overrides: Partial<SessionState> = {}): SessionState {
  return {
    user: null,
    loading: false,
    signOut,
    ...overrides,
  };
}

beforeEach(() => {
  pathname.current = "/shop/hats";
  for (const key of [...searchParams.keys()]) {
    searchParams.delete(key);
  }
  routerReplace.mockClear();
  routerRefresh.mockClear();
  signOut.mockClear();
  mockedUseSession.mockReturnValue(session());
});

describe("AuthMenu", () => {
  it("offers sign in to a signed out visitor", () => {
    render(<AuthMenu />);

    expect(
      screen.getByRole("link", { name: "Sign in to your account" }),
    ).toHaveAttribute("href", "/login?next=%2Fshop%2Fhats");
  });

  it("keeps a nested page as the destination after signing in", () => {
    pathname.current = "/shop/hats/wool-beanie";

    render(<AuthMenu />);

    expect(
      screen.getByRole("link", { name: "Sign in to your account" }),
    ).toHaveAttribute("href", "/login?next=%2Fshop%2Fhats%2Fwool-beanie");
  });

  it("keeps the query string as the destination after signing in", () => {
    searchParams.set("status", "open");
    searchParams.set("page", "2");

    render(<AuthMenu />);

    expect(
      screen.getByRole("link", { name: "Sign in to your account" }),
    ).toHaveAttribute(
      "href",
      "/login?next=%2Fshop%2Fhats%3Fstatus%3Dopen%26page%3D2",
    );
  });

  it("falls back to the storefront when the current path is an auth screen", () => {
    pathname.current = "/login";

    render(<AuthMenu />);

    expect(
      screen.getByRole("link", { name: "Sign in to your account" }),
    ).toHaveAttribute("href", "/login?next=%2F");
  });

  it("does not offer a sign in link while the session is being read", () => {
    mockedUseSession.mockReturnValue(session({ loading: true }));

    render(<AuthMenu />);

    expect(
      screen.queryByRole("link", { name: "Sign in to your account" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account" })).toBeDisabled();
  });

  it("names the account menu after the signed in customer", () => {
    mockedUseSession.mockReturnValue(session({ user: customer }));

    render(<AuthMenu />);

    expect(
      screen.getByRole("button", { name: "Account menu for Ada Lovelace" }),
    ).toBeInTheDocument();
  });

  it("shows the account name and email when the menu opens", async () => {
    const user = userEvent.setup();
    mockedUseSession.mockReturnValue(session({ user: customer }));

    render(<AuthMenu />);
    await user.click(
      screen.getByRole("button", { name: "Account menu for Ada Lovelace" }),
    );

    expect(await screen.findByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("does not offer the admin area to a customer", async () => {
    const user = userEvent.setup();
    mockedUseSession.mockReturnValue(session({ user: customer }));

    render(<AuthMenu />);
    await user.click(
      screen.getByRole("button", { name: "Account menu for Ada Lovelace" }),
    );
    await screen.findByText("ada@example.com");

    expect(
      screen.queryByRole("menuitem", { name: "Admin dashboard" }),
    ).not.toBeInTheDocument();
  });

  it("offers the admin area to an admin", async () => {
    const user = userEvent.setup();
    mockedUseSession.mockReturnValue(session({ user: admin }));

    render(<AuthMenu />);
    await user.click(
      screen.getByRole("button", { name: "Account menu for PeakZ Admin" }),
    );

    const adminLink = await screen.findByRole("menuitem", {
      name: "Admin dashboard",
    });
    expect(adminLink).toHaveAttribute("href", "/admin");
  });

  it("signs out and returns to the storefront", async () => {
    const user = userEvent.setup();
    mockedUseSession.mockReturnValue(session({ user: customer }));

    render(<AuthMenu />);
    await user.click(
      screen.getByRole("button", { name: "Account menu for Ada Lovelace" }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }));

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith("/");
    });
    expect(routerRefresh).toHaveBeenCalled();
  });

  it("stays put when the server did not revoke the session", async () => {
    const user = userEvent.setup();
    mockedUseSession.mockReturnValue(session({ user: customer }));
    signOut.mockResolvedValueOnce({ success: false });

    render(<AuthMenu />);
    await user.click(
      screen.getByRole("button", { name: "Account menu for Ada Lovelace" }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }));

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledTimes(1);
    });
    expect(routerReplace).not.toHaveBeenCalled();
    expect(routerRefresh).not.toHaveBeenCalled();
  });

  it("tells the customer when sign out failed and offers a retry", async () => {
    const user = userEvent.setup();
    mockedUseSession.mockReturnValue(session({ user: customer }));
    signOut.mockResolvedValueOnce({ success: false });

    render(<AuthMenu />);
    await user.click(
      screen.getByRole("button", { name: "Account menu for Ada Lovelace" }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }));

    // The menu stays open, the failure is announced, and a retry is offered as
    // a menu item so the arrow keys can reach it.
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We could not sign you out",
    );
    const retry = screen.getByRole("menuitem", { name: "Try again" });

    signOut.mockResolvedValueOnce({ success: true });
    await user.click(retry);

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith("/");
    });
  });

  it("forgets the failure once the menu closes", async () => {
    const user = userEvent.setup();
    mockedUseSession.mockReturnValue(session({ user: customer }));
    signOut.mockResolvedValueOnce({ success: false });

    render(<AuthMenu />);
    const trigger = screen.getByRole("button", {
      name: "Account menu for Ada Lovelace",
    });
    await user.click(trigger);
    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    await user.click(trigger);
    await screen.findByText("ada@example.com");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the modal default and close animation on the shared DropdownMenu", async () => {
    const user = userEvent.setup();
    mockedUseSession.mockReturnValue(session({ user: customer }));

    render(
      <>
        <button type="button">Outside action</button>
        <AuthMenu />
      </>,
    );

    const outsideControl = screen.getByRole("button", {
      name: "Outside action",
    });
    await user.click(
      screen.getByRole("button", { name: "Account menu for Ada Lovelace" }),
    );

    const menu = await screen.findByRole("menu");
    expect(menu).toHaveClass("data-[state=closed]:animate-out");
    expect(outsideControl.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
