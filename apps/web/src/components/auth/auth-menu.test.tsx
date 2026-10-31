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

const { pathname, routerReplace, routerRefresh, signOut } = vi.hoisted(() => ({
  pathname: { current: "/shop/hats" },
  routerReplace: vi.fn(),
  routerRefresh: vi.fn(),
  signOut: vi.fn(() => Promise.resolve()),
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
  useSearchParams: () => new URLSearchParams(),
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
    refresh: vi.fn(),
    signOut,
    ...overrides,
  };
}

beforeEach(() => {
  pathname.current = "/shop/hats";
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
});
