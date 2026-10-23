/**
 * Regression test for the product type contract (AC-8).
 *
 * ProductCard consumes the shared product entity from spec 0002. Its badge map
 * must cover every canonical ProductType, including PRE_ORDER. The component
 * previously declared its own union with MADE_TO_ORDER and no PRE_ORDER, so a
 * real pre-order product silently rendered no badge.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductType } from "@crochet-peakz/shared";
import { ProductCard } from "./product-card";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

const baseProps = {
  slug: "test-product",
  title: "Test Product",
  imageUrl: "/placeholder.png",
  priceBdt: 1200,
  priceUsd: 12,
};

describe("ProductCard", () => {
  it.each([
    [ProductType.STANDARD, "Standard"],
    [ProductType.ONE_OF_A_KIND, "One of a Kind"],
    [ProductType.PRE_ORDER, "Pre-order"],
    [ProductType.CUSTOM, "Custom"],
    [ProductType.DIGITAL, "Digital"],
  ])("renders the %s product type badge", (productType, label) => {
    render(<ProductCard {...baseProps} productType={productType} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it.each([
    [ProductType.PRE_ORDER, "Pre-order"],
    [ProductType.CUSTOM, "Custom"],
  ])("gives the %s overlay badge a solid fill", (productType, label) => {
    render(<ProductCard {...baseProps} productType={productType} />);

    expect(screen.getByText(label)).toHaveAttribute(
      "data-variant",
      "secondary",
    );
  });
});
