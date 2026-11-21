/**
 * Product detail navigation tests.
 *
 * The App Router reuses the same page segment when only the dynamic `slug`
 * changes, so client components inside the page keep their state. This test
 * rerenders the page with a different product the way a related product click
 * does, and asserts that the variant and gallery selections belong to the
 * product currently on screen.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProductPage from "./page";
import {
  makeProductDetail,
  makeVariant,
} from "../../../../test-support/catalog-fixtures";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

const mocks = vi.hoisted(() => ({
  fetchCatalogProduct: vi.fn(),
}));

vi.mock("../../../../lib/catalog/api", () => ({
  fetchCatalogProduct: mocks.fetchCatalogProduct,
  isCatalogNotFound: () => false,
}));

vi.mock("../../../../lib/currency/server", () => ({
  getActiveCurrency: () => Promise.resolve("BDT"),
}));

vi.mock("../../../../lib/catalog/env", () => ({
  getCatalogEnv: () => ({ webAppUrl: "https://example.test" }),
}));

const productA = makeProductDetail({
  id: "product-a",
  slug: "bear-a",
  title: "Bear A",
  priceBdt: 1800,
  priceUsd: 22,
  images: [
    {
      url: "https://res.cloudinary.com/demo/image/upload/a-1",
      alt: "Bear A first image",
      isPrimary: true,
      displayOrder: 0,
    },
    {
      url: "https://res.cloudinary.com/demo/image/upload/a-2",
      alt: "Bear A second image",
      isPrimary: false,
      displayOrder: 1,
    },
    {
      url: "https://res.cloudinary.com/demo/image/upload/a-3",
      alt: "Bear A third image",
      isPrimary: false,
      displayOrder: 2,
    },
  ],
  variants: [
    makeVariant({
      id: "a-1",
      colorName: "Honey Gold",
      stockQuantity: 5,
      additionalPriceBdt: 100,
    }),
    makeVariant({
      id: "a-2",
      colorName: "Lavender",
      stockQuantity: 8,
      additionalPriceBdt: 200,
    }),
  ],
  categoryTrail: [],
});

const productB = makeProductDetail({
  id: "product-b",
  slug: "bear-b",
  title: "Bear B",
  priceBdt: 2500,
  priceUsd: 30,
  images: [
    {
      url: "https://res.cloudinary.com/demo/image/upload/b-1",
      alt: "Bear B first image",
      isPrimary: true,
      displayOrder: 0,
    },
    {
      url: "https://res.cloudinary.com/demo/image/upload/b-2",
      alt: "Bear B second image",
      isPrimary: false,
      displayOrder: 1,
    },
  ],
  variants: [
    makeVariant({
      id: "b-1",
      colorName: "Sage Green",
      stockQuantity: 7,
      additionalPriceBdt: 300,
    }),
  ],
  categoryTrail: [],
});

describe("ProductPage navigation", () => {
  beforeEach(() => {
    mocks.fetchCatalogProduct.mockReset();
    mocks.fetchCatalogProduct.mockImplementation((slug: string) =>
      Promise.resolve(slug === productA.slug ? productA : productB),
    );
  });

  it("resets variant and gallery selection when the product changes", async () => {
    const user = userEvent.setup();
    const viewA = await ProductPage({
      params: Promise.resolve({ slug: productA.slug }),
    });
    const { rerender } = render(viewA);

    await user.click(screen.getByRole("radio", { name: "Lavender" }));
    await user.click(screen.getByRole("button", { name: "View image 2 of 3" }));

    expect(screen.getByText("৳2,000")).toBeInTheDocument();
    expect(screen.getByText("In stock")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View image 2 of 3" }),
    ).toHaveAttribute("aria-pressed", "true");

    const viewB = await ProductPage({
      params: Promise.resolve({ slug: productB.slug }),
    });
    rerender(viewB);

    expect(
      screen.getByRole("heading", { level: 1, name: "Bear B" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Sage Green" })).toBeChecked();
    expect(screen.getByText("৳2,800")).toBeInTheDocument();
    expect(screen.getByText("In stock")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View image 1 of 2" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "View image 2 of 2" }),
    ).toHaveAttribute("aria-pressed", "false");
  });
});
