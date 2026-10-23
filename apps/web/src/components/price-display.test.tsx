import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PriceDisplay } from "./price-display";

describe("PriceDisplay", () => {
  it("renders only the current price when there is no compare at price", () => {
    const { container } = render(
      <PriceDisplay priceBdt={1200} priceUsd={12} />,
    );

    expect(screen.getByText("৳1,200")).toBeInTheDocument();
    expect(container.querySelector("del")).not.toBeInTheDocument();
  });

  it("marks the compare at price as deleted and labels it for screen readers", () => {
    const { container } = render(
      <PriceDisplay priceBdt={1200} priceUsd={12} compareAtBdt={1500} />,
    );

    const originalPrice = container.querySelector("del");
    expect(originalPrice).not.toBeNull();
    expect(originalPrice).toHaveTextContent("Original price: ৳1,500");
    expect(screen.getByText("Original price:")).toHaveClass("sr-only");
    expect(screen.getByText("৳1,200")).not.toHaveAttribute("aria-label");
  });

  it("uses the compare at price that matches the active currency", () => {
    render(
      <PriceDisplay
        priceBdt={1200}
        priceUsd={12}
        compareAtBdt={1500}
        compareAtUsd={15}
        activeCurrency="USD"
      />,
    );

    expect(screen.getByText("$12.00")).toBeInTheDocument();
    expect(screen.getByText("$15.00")).toBeInTheDocument();
    expect(screen.queryByText("৳1,500")).not.toBeInTheDocument();
  });

  it("does not show a sale price when compare at is not higher", () => {
    const { container } = render(
      <PriceDisplay priceBdt={1200} priceUsd={12} compareAtBdt={1200} />,
    );

    expect(container.querySelector("del")).not.toBeInTheDocument();
  });
});
