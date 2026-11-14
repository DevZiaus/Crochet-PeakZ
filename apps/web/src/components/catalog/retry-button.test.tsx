/**
 * Tests for the catalog retry control (AC-16).
 *
 * Every catalog page that can fail renders `CatalogErrorState`, whose only
 * action is this button. It has to ask Next.js to render the current route
 * again, and it has to honour a caller supplied label.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// The shared test setup mocks `next/navigation` with plain functions. This
// suite needs the refresh call to be observable, so it supplies its own router.
const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: refreshMock,
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

import { RetryButton } from "./retry-button";

beforeEach(() => {
  refreshMock.mockReset();
});

describe("RetryButton", () => {
  it("defaults to the Try again label", () => {
    render(<RetryButton />);

    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it("uses a supplied label", () => {
    render(<RetryButton label="Reload the shop" />);

    expect(
      screen.getByRole("button", { name: "Reload the shop" }),
    ).toBeInTheDocument();
  });

  it("re renders the route when clicked", async () => {
    const user = userEvent.setup();
    render(<RetryButton />);

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("is a plain button so it never submits a surrounding form", () => {
    render(<RetryButton />);

    expect(screen.getByRole("button", { name: "Try again" })).toHaveAttribute(
      "type",
      "button",
    );
  });

  it("is reachable and activatable with the keyboard", async () => {
    const user = userEvent.setup();
    render(<RetryButton />);

    await user.tab();

    expect(screen.getByRole("button", { name: "Try again" })).toHaveFocus();

    await user.keyboard("{Enter}");

    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
