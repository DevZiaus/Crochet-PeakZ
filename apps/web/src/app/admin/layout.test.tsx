/**
 * Tests for the admin area shell.
 *
 * The admin guard must reject a caller before anything is rendered, not after.
 * A browser side check is too late: by then the server has already put the admin
 * markup into the response, so an anonymous caller or a CUSTOMER could read it
 * from the page source. These tests lock the server side decision in place.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AuthUser } from "@crochet-peakz/shared";
import type { SessionState } from "../../lib/auth/use-session";

const { redirectMock } = vi.hoisted(() => ({
  // Next.js signals a redirect by throwing, so the mock must throw too.
  redirectMock: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  usePathname: () => "/admin",
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("../../lib/auth/session", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("../../lib/auth/use-session", () => ({
  useSession: vi.fn(),
}));

import { getSessionUser } from "../../lib/auth/session";
import { useSession } from "../../lib/auth/use-session";
import AdminLayout from "./layout";

const mockedGetSessionUser = vi.mocked(getSessionUser);
const mockedUseSession = vi.mocked(useSession);

const admin: AuthUser = {
  id: "user-2",
  name: "PeakZ Admin",
  email: "admin@crochetpeakz.com",
  role: "ADMIN",
  avatarUrl: null,
  emailVerified: true,
};

const customer: AuthUser = {
  ...admin,
  id: "user-1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  role: "CUSTOMER",
};

function clientSession(overrides: Partial<SessionState>): SessionState {
  return {
    user: null,
    loading: false,
    refresh: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  };
}

/** Renders the shell the way the server would, children included. */
function renderShell() {
  return AdminLayout({ children: <p>Store dashboard</p> });
}

beforeEach(() => {
  redirectMock.mockClear();
  mockedGetSessionUser.mockReset();
  mockedUseSession.mockReturnValue(clientSession({ user: admin }));
});

describe("AdminLayout", () => {
  it("sends an anonymous caller to sign in instead of rendering", async () => {
    mockedGetSessionUser.mockResolvedValue(null);

    await expect(renderShell()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith("/login?next=%2Fadmin");
  });

  it("sends a customer to the storefront instead of rendering", async () => {
    mockedGetSessionUser.mockResolvedValue(customer);

    await expect(renderShell()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("renders the admin content for a proven admin", async () => {
    mockedGetSessionUser.mockResolvedValue(admin);

    render(await renderShell());

    expect(redirectMock).not.toHaveBeenCalled();
    expect(screen.getByText("Store dashboard")).toBeInTheDocument();
  });

  it("never puts admin markup in the output for a non admin", async () => {
    mockedGetSessionUser.mockResolvedValue(customer);

    const rendered = await renderShell().then(
      (element) => element,
      () => null,
    );

    expect(rendered).toBeNull();
  });
});
