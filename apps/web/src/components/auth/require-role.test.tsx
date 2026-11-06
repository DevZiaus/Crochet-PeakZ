/**
 * Tests for the client role guard.
 *
 * The guard runs on the client, so it is the last line of defence for a page
 * that the server already allowed through. These tests lock in where it sends
 * each kind of caller, and that a signed out visitor keeps the query string of
 * the page they asked for so the sign in returns them to the same view.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { AuthUser } from "@crochet-peakz/shared";
import { resolvePostSignInPath } from "@crochet-peakz/shared";
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
  usePathname: () => "/admin/orders",
  useSelectedLayoutSegment: () => null,
  useParams: () => ({}),
}));

vi.mock("../../lib/auth/use-session", () => ({
  useSession: vi.fn(),
}));

import { useSession } from "../../lib/auth/use-session";
import { RequireRole } from "./require-role";

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
  id: "user-2",
  name: "Grace Hopper",
  email: "grace@example.com",
  role: "ADMIN",
  avatarUrl: null,
  emailVerified: true,
};

/** Builds a session state with sensible defaults. */
function session(overrides: Partial<SessionState> = {}): SessionState {
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
  searchParams.delete("status");
  mockedUseSession.mockReturnValue(session({}));
});

describe("RequireRole", () => {
  it("keeps the query string when it sends a signed out visitor to sign in", async () => {
    searchParams.set("status", "open");

    render(
      <RequireRole role="ADMIN">
        <p>Admin only</p>
      </RequireRole>,
    );

    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith(
        "/login?next=%2Fadmin%2Forders%3Fstatus%3Dopen",
      );
    });
    expect(screen.queryByText("Admin only")).not.toBeInTheDocument();
  });

  it("offers the same sign in link in the fallback", () => {
    searchParams.set("status", "open");

    render(
      <RequireRole role="ADMIN">
        <p>Admin only</p>
      </RequireRole>,
    );

    expect(
      screen.getByRole("link", { name: "Sign in" }).getAttribute("href"),
    ).toBe("/login?next=%2Fadmin%2Forders%3Fstatus%3Dopen");
  });

  it("drops the query from the target when the page has none", async () => {
    render(
      <RequireRole role="ADMIN">
        <p>Admin only</p>
      </RequireRole>,
    );

    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith(
        "/login?next=%2Fadmin%2Forders",
      );
    });
  });

  it("carries the query on to the post sign in destination", () => {
    // The sign in form only reads `next`, so the guard has to fold the page
    // query into `next` for it to survive sign in.
    expect(resolvePostSignInPath("/admin/orders?status=open", "ADMIN")).toBe(
      "/admin/orders?status=open",
    );
  });

  it("shows the loading status while the session is still unknown", () => {
    mockedUseSession.mockReturnValue(session({ loading: true }));

    render(
      <RequireRole role="ADMIN">
        <p>Admin only</p>
      </RequireRole>,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Checking your access",
    );
    expect(screen.queryByText("Admin only")).not.toBeInTheDocument();
  });

  it("sends a signed in customer to their own home", async () => {
    mockedUseSession.mockReturnValue(session({ user: customer }));

    render(
      <RequireRole role="ADMIN">
        <p>Admin only</p>
      </RequireRole>,
    );

    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith("/");
    });
  });

  it("renders the protected children for a matching role", () => {
    mockedUseSession.mockReturnValue(session({ user: admin }));

    render(
      <RequireRole role="ADMIN">
        <p>Admin only</p>
      </RequireRole>,
    );

    expect(screen.getByText("Admin only")).toBeInTheDocument();
  });
});
