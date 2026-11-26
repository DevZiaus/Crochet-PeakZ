/**
 * Tests for the auth layout shell currency placement rules (AC-1).
 *
 * Sign in, registration, and password reset screens use `AuthLayout` without a
 * `CurrencyProvider`, so neither the header nor the mobile drawer may render a
 * currency control there.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname } from "next/navigation";
import AuthLayout from "./layout";

vi.mock("../../lib/auth/use-session", () => ({
  useSession: () => ({
    user: null,
    loading: false,
    signOut: () => Promise.resolve({ success: true as const }),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(usePathname).mockReturnValue("/login");
});

describe("AuthLayout", () => {
  it("omits the currency control from both the header and mobile drawer (AC-1)", async () => {
    const user = userEvent.setup();
    render(
      <AuthLayout>
        <p>Sign in form</p>
      </AuthLayout>,
    );

    expect(screen.getByText("Sign in form")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Currency:/ }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const drawer = await screen.findByRole("dialog", {
      name: "Mobile navigation",
    });

    expect(
      within(drawer).queryByRole("group", { name: "Currency" }),
    ).not.toBeInTheDocument();
  });

  it("offers a skip link targeting the main landmark", () => {
    render(
      <AuthLayout>
        <p>Sign in form</p>
      </AuthLayout>,
    );

    const link = screen.getByRole("link", { name: "Skip to content" });
    expect(link).toHaveAttribute("href", "#main-content");
    expect(document.querySelector("main#main-content")).not.toBeNull();
  });
});
