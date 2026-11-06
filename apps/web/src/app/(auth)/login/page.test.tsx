/**
 * Tests for the sign in screen (AC-13).
 *
 * The page itself is thin: it sets the metadata, reserves a calm placeholder
 * while the form hydrates, and wraps the form in the signed in guard. Those are
 * exactly the parts that would silently regress, so they are pinned here with
 * the real guard in place. The form's own behavior is covered beside the form
 * component.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/login",
  useSearchParams: () => new URLSearchParams(),
  useSelectedLayoutSegment: () => null,
  useParams: () => ({}),
}));

vi.mock("../../../lib/auth/use-session", () => ({
  useSession: vi.fn(),
}));

import { useSession } from "../../../lib/auth/use-session";
import type { SessionState } from "../../../lib/auth/use-session";
import LoginPage, { metadata } from "./page";

const mockedUseSession = vi.mocked(useSession);

function session(overrides: Partial<SessionState> = {}): SessionState {
  return {
    user: null,
    loading: false,
    signOut: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mockedUseSession.mockReturnValue(session());
});

describe("LoginPage", () => {
  it("keeps the screen out of search results (AC-13)", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("gives the screen a title naming the store", () => {
    expect(metadata.title).toBe("Sign in | Crochet PeakZ");
  });

  it("renders the sign in form for a signed out visitor", () => {
    render(<LoginPage />);

    expect(
      screen.getByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
  });

  it("does not render the form for an account that already has a session", () => {
    mockedUseSession.mockReturnValue(
      session({
        user: {
          id: "user-1",
          name: "Ada Lovelace",
          email: "ada@example.com",
          role: "CUSTOMER",
          avatarUrl: null,
          emailVerified: true,
        },
      }),
    );

    render(<LoginPage />);

    expect(
      screen.queryByRole("heading", { name: "Welcome back" }),
    ).not.toBeInTheDocument();
  });
});
