import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PurchasePanel } from "./purchase-panel";
import {
  makeProductDetail,
  makeVariant,
} from "../../test-support/catalog-fixtures";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

const variants = [
  makeVariant({
    id: "a",
    colorName: "Honey Gold",
    stockQuantity: 3,
    additionalPriceBdt: 100,
    additionalPriceUsd: 1,
  }),
  makeVariant({
    id: "b",
    colorName: "Blush Pink",
    stockQuantity: 0,
    inStock: false,
  }),
  makeVariant({
    id: "c",
    colorName: "Lavender",
    stockQuantity: 8,
    additionalPriceBdt: 200,
    additionalPriceUsd: 2,
  }),
];

describe("PurchasePanel", () => {
  it("shows the first in stock variant price, stock, and lead time with an enabled Add to cart button", () => {
    render(
      <PurchasePanel
        product={makeProductDetail({ variants })}
        currency="BDT"
      />,
    );

    expect(screen.getByText("৳1,900")).toBeInTheDocument();
    expect(screen.getByText("Only 3 left")).toBeInTheDocument();
    expect(screen.getByText("Ready to ship")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeEnabled();
    expect(screen.queryByText(/Cart is coming soon/)).not.toBeInTheDocument();
  });

  it("updates the price and stock when another variant is chosen", async () => {
    const user = userEvent.setup();
    render(
      <PurchasePanel
        product={makeProductDetail({ variants })}
        currency="BDT"
      />,
    );

    await user.click(screen.getByRole("radio", { name: "Lavender" }));

    expect(screen.getByText("৳2,000")).toBeInTheDocument();
    expect(screen.getByText("In stock")).toBeInTheDocument();
  });

  it("uses a non null swatch colour when the first matching variant has no hex", () => {
    render(
      <PurchasePanel
        product={makeProductDetail({
          variants: [
            makeVariant({
              id: "a",
              colorName: "Lavender",
              colorHex: null,
              stockQuantity: 5,
            }),
            makeVariant({
              id: "b",
              colorName: "Lavender",
              colorHex: "#c8a2c8",
              stockQuantity: 4,
            }),
          ],
        })}
        currency="BDT"
      />,
    );

    const radio = screen.getByRole("radio", { name: "Lavender" });
    const swatch = radio
      .closest("label")
      ?.querySelector<HTMLElement>('span[aria-hidden="true"]');

    expect(swatch).not.toBeNull();
    expect(swatch?.style.backgroundColor).toBe("#c8a2c8");
  });

  it("disables an unavailable variant option", () => {
    render(
      <PurchasePanel
        product={makeProductDetail({ variants })}
        currency="BDT"
      />,
    );

    expect(screen.getByRole("radio", { name: "Blush Pink" })).toBeDisabled();
  });

  it("uses the USD price and additional price", () => {
    render(
      <PurchasePanel
        product={makeProductDetail({ variants })}
        currency="USD"
      />,
    );

    expect(screen.getByText("$23.00")).toBeInTheDocument();
  });

  it("shows no selector and the base price when a product has no variants", () => {
    render(
      <PurchasePanel
        product={makeProductDetail({
          productType: "DIGITAL",
          variants: [],
          leadTimeDays: 0,
        })}
        currency="BDT"
      />,
    );

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByText("৳1,800")).toBeInTheDocument();
    expect(screen.getByText("Available now")).toBeInTheDocument();
  });

  it("renders the product level lead time", () => {
    render(
      <PurchasePanel
        product={makeProductDetail({ variants: [], leadTimeDays: 28 })}
        currency="BDT"
      />,
    );

    expect(screen.getByText("Handcrafted in 28 days")).toBeInTheDocument();
  });

  it("shows Sold out when every variant is out of stock", () => {
    render(
      <PurchasePanel
        product={makeProductDetail({
          variants: [
            makeVariant({
              id: "a",
              colorName: "Honey Gold",
              stockQuantity: 0,
              inStock: false,
            }),
          ],
        })}
        currency="BDT"
      />,
    );

    expect(screen.getByText("Sold out")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Honey Gold" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Out of stock" })).toBeDisabled();
  });

  it("disables Add to cart with specific type notes for DIGITAL, PRE_ORDER, and CUSTOM products", () => {
    const { rerender } = render(
      <PurchasePanel
        product={makeProductDetail({
          productType: "DIGITAL",
          variants: [makeVariant({ id: "d1", stockQuantity: 99 })],
        })}
        currency="BDT"
      />,
    );
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeDisabled();
    expect(
      screen.getByText("Digital patterns are coming to the cart soon."),
    ).toBeInTheDocument();

    rerender(
      <PurchasePanel
        product={makeProductDetail({
          productType: "PRE_ORDER",
          variants: [makeVariant({ id: "p1", stockQuantity: 99 })],
        })}
        currency="BDT"
      />,
    );
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeDisabled();
    expect(
      screen.getByText("Pre orders are not open yet."),
    ).toBeInTheDocument();

    rerender(
      <PurchasePanel
        product={makeProductDetail({
          productType: "CUSTOM",
          variants: [makeVariant({ id: "c1", stockQuantity: 99 })],
        })}
        currency="BDT"
      />,
    );
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeDisabled();
    expect(
      screen.getByText(
        "This piece is made to order through a custom request, coming soon.",
      ),
    ).toBeInTheDocument();
  });
});
