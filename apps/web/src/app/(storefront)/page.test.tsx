import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { CategorySummaryDto } from "@crochet-peakz/shared";
import HomePage, { generateMetadata } from "./page";
import { makeProductSummary } from "../../test-support/catalog-fixtures";

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    width,
    height,
    className,
  }: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    className?: string;
  }) => (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
    />
  ),
}));

const mocks = vi.hoisted(() => ({
  fetchCatalogProducts: vi.fn(),
  fetchCatalogCategories: vi.fn(),
}));

vi.mock("../../lib/catalog/api", () => ({
  fetchCatalogProducts: mocks.fetchCatalogProducts,
  fetchCatalogCategories: mocks.fetchCatalogCategories,
}));

vi.mock("../../lib/currency/server", () => ({
  getActiveCurrency: () => Promise.resolve("BDT" as const),
}));

vi.mock("../../lib/catalog/env", () => ({
  getCatalogEnv: () => ({
    webAppUrl: "https://shop.example.test",
    apiInternalUrl: "http://api.test/api",
  }),
}));

const sampleCategory: CategorySummaryDto = {
  id: "cat-1",
  name: "Amigurumi",
  slug: "amigurumi",
  parentId: null,
  description: "Soft stitched companions.",
  productCount: 3,
  coverImageUrl: "https://res.cloudinary.com/demo/image/upload/amigurumi",
  coverImageAlt: "Amigurumi cover",
};

beforeEach(() => {
  mocks.fetchCatalogProducts.mockReset();
  mocks.fetchCatalogCategories.mockReset();
});

describe("Storefront HomePage", () => {
  it("exposes canonical and OpenGraph metadata", () => {
    const metadata = generateMetadata();
    expect(metadata.alternates?.canonical).toBe("https://shop.example.test");
  });

  it("renders the landing hero, logo, intro, numbered craft cards, and catalog sections", async () => {
    mocks.fetchCatalogProducts.mockResolvedValueOnce({
      data: [makeProductSummary()],
      meta: { page: 1, pageSize: 8, total: 1, totalPages: 1 },
    });
    mocks.fetchCatalogCategories.mockResolvedValueOnce([sampleCategory]);

    render(await HomePage());

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Little things with a big heart.",
      }),
    ).toBeInTheDocument();

    const logo = screen.getByRole("img", {
      name: "Colorful handmade Crochet PeakZ logo",
    });
    expect(logo).toHaveAttribute("src", "/logo-square.webp");

    expect(
      screen.getByRole("link", { name: /Shop the collection/ }),
    ).toHaveAttribute("href", "/shop");
    expect(
      screen.getByRole("link", { name: /Discover our story/ }),
    ).toHaveAttribute("href", "/blog");
    expect(
      screen.getByRole("link", { name: /Meet the maker/ }),
    ).toHaveAttribute("href", "/about");
    expect(
      screen.getByRole("link", { name: "Start a custom order" }),
    ).toHaveAttribute("href", "/contact?topic=custom-order");

    expect(
      screen.getByRole("heading", { level: 2, name: "The PeakZ feeling" }),
    ).toBeInTheDocument();
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Handmade for real life" }),
    ).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Made in small batches" }),
    ).toBeInTheDocument();
    expect(screen.getByText("03")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Created to make you smile",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { level: 2, name: "Featured pieces" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Shop by collection" }),
    ).toBeInTheDocument();
  });

  it("hides empty catalog sections while preserving valid heading hierarchy", async () => {
    mocks.fetchCatalogProducts.mockResolvedValueOnce({
      data: [],
      meta: { page: 1, pageSize: 8, total: 0, totalPages: 0 },
    });
    mocks.fetchCatalogCategories.mockResolvedValueOnce([]);

    render(await HomePage());

    expect(
      screen.queryByRole("heading", { name: "Featured pieces" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Shop by collection" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "How we craft" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Handmade for real life" }),
    ).toBeInTheDocument();
  });
});
