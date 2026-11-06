/**
 * Tests for the signed in guard on the sign in and register screens.
 *
 * The guard must not render the forms for an account that already has a
 * session, and it must send that account to a safe relative `next` or its role
 * default. A signed out visitor still gets the form.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { AuthUser } from "@crochet-peakz/shared";
import type { SessionState } from "../../lib/auth/use-session";

const { routerReplace, searchParams } = vi.hoisted(() => ({
  routerReplace: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: routerReplace,
    push: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => searchParams,
  usePathname: () => "/login",
  useSelectedLayoutSegment: () => null,
  useParams: () => ({}),
}));

vi.mock("../../lib/auth/use-session", () => ({
  useSession: vi.fn(),
}));

import { useSession } from "../../lib/auth/use-session";
import { RequireGuest } from "./require-guest";

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

function session(overrides: Partial<SessionState>): SessionState {
  return {
    user: null,
    loading: false,
    signOut: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  routerReplace.mockClear();
  searchParams.delete("next");
  mockedUseSession.mockReturnValue(session({}));
});

describe("RequireGuest", () => {
  it("renders the form for a signed out visitor", () => {
    render(
      <RequireGuest>
        <div>Sign in form</div>
      </RequireGuest>,
    );

    expect(screen.getByText("Sign in form")).toBeInTheDocument();
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it("shows a status while the session is checked", () => {
    mockedUseSession.mockReturnValue(session({ loading: true }));

    render(
      <RequireGuest>
        <div>Sign in form</div>
      </RequireGuest>,
    );

    expect(screen.getByText("Checking your session…")).toBeInTheDocument();
    expect(screen.queryByText("Sign in form")).not.toBeInTheDocument();
  });

  it("sends a signed in customer to the role default", async () => {
    mockedUseSession.mockReturnValue(session({ user: customer }));

    render(
      <RequireGuest>
        <div>Sign in form</div>
      </RequireGuest>,
    );

    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith("/");
    });
    expect(screen.queryByText("Sign in form")).not.toBeInTheDocument();
    expect(screen.getByText("Taking you to your account…")).toBeInTheDocument();
  });

  it("keeps a safe relative next for an admin", async () => {
    searchParams.set("next", "/admin/products");
    mockedUseSession.mockReturnValue(session({ user: admin }));

    render(
      <RequireGuest>
        <div>Sign in form</div>
      </RequireGuest>,
    );

    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith("/admin/products");
    });
  });

  it("ignores an auth screen as next and uses the role default", async () => {
    searchParams.set("next", "/auth/callback");
    mockedUseSession.mockReturnValue(session({ user: admin }));

    render(
      <RequireGuest>
        <div>Sign in form</div>
      </RequireGuest>,
    );

    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith("/admin");
    });
  });
});
