import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders the heading, description, and link action", () => {
    render(
      <EmptyState
        heading="No pieces match these filters"
        description="Try removing a filter or widening the price range."
        action={{ label: "Clear all filters", href: "/shop" }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "No pieces match these filters" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Try removing a filter or widening the price range."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Clear all filters" }),
    ).toHaveAttribute("href", "/shop");
  });

  it("calls the action handler when the action is a button", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <EmptyState
        heading="Nothing here yet"
        action={{ label: "Browse all pieces", onClick }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Browse all pieces" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
