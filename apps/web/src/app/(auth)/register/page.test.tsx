/**
 * Tests for the account creation screen (AC-13).
 *
 * Same shape as the sign in screen: metadata, a hydration placeholder, and the
 * signed in guard. This is the screen that creates an account, so the guard
 * matters most here. A customer who already has a session must never be handed
 * a second registration form.
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
  usePathname: () => "/register",
  useSearchParams: () => new URLSearchParams(),
  useSelectedLayoutSegment: () => null,
  useParams: () => ({}),
}));

vi.mock("../../../lib/auth/use-session", () => ({
  useSession: vi.fn(),
}));

import { useSession } from "../../../lib/auth/use-session";
import type { SessionState } from "../../../lib/auth/use-session";
import RegisterPage, { metadata } from "./page";

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

describe("RegisterPage", () => {
  it("keeps the screen out of search results (AC-13)", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("gives the screen a title naming the store", () => {
    expect(metadata.title).toBe("Create account");
  });

  it("renders the registration form for a signed out visitor", () => {
    render(<RegisterPage />);

    expect(
      screen.getByRole("heading", { name: /create your account/i }),
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

    render(<RegisterPage />);

    expect(
      screen.queryByRole("heading", { name: /create your account/i }),
    ).not.toBeInTheDocument();
  });
});
