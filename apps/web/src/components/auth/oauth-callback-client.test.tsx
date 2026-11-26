/**
 * Tests for the OAuth result screen.
 *
 * The API has already set the session cookies before this page renders. The
 * page only decides where to go on success and shows readable recovery actions
 * on failure, without exposing provider detail.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { routerReplace, routerRefresh, searchParams } = vi.hoisted(() => ({
  routerReplace: vi.fn(),
  routerRefresh: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: routerReplace,
    refresh: routerRefresh,
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => searchParams,
  usePathname: () => "/auth/callback",
  useSelectedLayoutSegment: () => null,
  useParams: () => ({}),
}));

import { OAuthCallbackClient } from "./oauth-callback-client";

beforeEach(() => {
  routerReplace.mockClear();
  routerRefresh.mockClear();
  for (const key of [...searchParams.keys()]) {
    searchParams.delete(key);
  }
});

describe("OAuthCallbackClient", () => {
  it("moves a successful sign in to the signed next path", () => {
    searchParams.set("provider", "google");
    searchParams.set("status", "success");
    searchParams.set("next", "/orders");

    render(<OAuthCallbackClient />);

    expect(
      screen.getByRole("heading", { name: "You are signed in" }),
    ).toBeInTheDocument();
    expect(routerReplace).toHaveBeenCalledWith("/orders");
    expect(routerRefresh).toHaveBeenCalled();
  });

  it("sanitizes an external or auth screen next on success", () => {
    searchParams.set("provider", "facebook");
    searchParams.set("status", "success");
    searchParams.set("next", "https://evil.example/steal");

    render(<OAuthCallbackClient />);

    expect(routerReplace).toHaveBeenCalledWith("/");

    searchParams.set("next", "/auth/callback");
    render(<OAuthCallbackClient />);
    expect(routerReplace).toHaveBeenLastCalledWith("/");
  });

  it("shows a readable message and recovery links after access denied", () => {
    searchParams.set("provider", "google");
    searchParams.set("error", "access_denied");
    searchParams.set("next", "/orders");

    render(<OAuthCallbackClient />);

    expect(
      screen.getByRole("heading", {
        name: "Could not sign in with Google",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/You cancelled the sign in/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/api/auth/google?next=%2Forders",
    );
    expect(
      screen.getByRole("link", { name: "Sign in with email" }),
    ).toHaveAttribute("href", "/login?next=%2Forders");
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it("shows a generic failure when the result is incomplete", () => {
    searchParams.set("provider", "facebook");

    render(<OAuthCallbackClient />);

    expect(
      screen.getByRole("heading", {
        name: "Could not sign in with Facebook",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/The sign in did not finish/)).toBeInTheDocument();
  });

  it("shows readable guidance and recovery links when linking is disallowed", () => {
    searchParams.set("provider", "facebook");
    searchParams.set("error", "link_failed");
    searchParams.set("next", "/orders");

    render(<OAuthCallbackClient />);

    expect(
      screen.getByRole("heading", {
        name: "Could not sign in with Facebook",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/We could not link that provider to your account/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/api/auth/facebook?next=%2Forders",
    );
    expect(
      screen.getByRole("link", { name: "Sign in with email" }),
    ).toHaveAttribute("href", "/login?next=%2Forders");
  });
});
