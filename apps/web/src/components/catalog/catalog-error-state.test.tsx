import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CatalogErrorState } from "./catalog-error-state";

describe("CatalogErrorState", () => {
  it("renders a retryable alert with the shop copy", () => {
    render(
      <CatalogErrorState
        heading="We could not load the shop"
        description="Something went wrong on our side. Please try again."
      />,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "We could not load the shop" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Something went wrong on our side. Please try again."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });
});
