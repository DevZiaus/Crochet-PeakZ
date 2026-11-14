/**
 * Tests for the desktop filter sidebar (AC-3, AC-17).
 *
 * The sidebar is the only filter surface at the large breakpoint, and the
 * mobile drawer renders the same form under a different id prefix. Both forms
 * can be in the document at once, so the ids inside each must not collide.
 */
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { CategorySummaryDto } from "@crochet-peakz/shared";
import { FilterSidebar } from "./filter-sidebar";
import { defaultCatalogSearchState } from "../../lib/catalog/search-params";

const categories: CategorySummaryDto[] = [
  {
    id: "1",
    name: "Amigurumi",
    slug: "amigurumi",
    parentId: null,
    description: null,
    productCount: 4,
    coverImageUrl: null,
    coverImageAlt: null,
  },
];

describe("FilterSidebar", () => {
  it("is a labelled complementary region holding the filter form", () => {
    render(
      <FilterSidebar
        categories={categories}
        state={defaultCatalogSearchState}
        currency="BDT"
      />,
    );

    const sidebar = screen.getByRole("complementary", {
      name: "Product filters",
    });

    expect(
      within(sidebar).getByRole("heading", { name: "Filters" }),
    ).toBeInTheDocument();
    expect(
      within(sidebar).getByRole("button", { name: "Apply filters" }),
    ).toBeInTheDocument();
  });

  it("prefixes every field id for the desktop form", () => {
    render(
      <FilterSidebar
        categories={categories}
        state={defaultCatalogSearchState}
        currency="BDT"
      />,
    );

    expect(screen.getByRole("checkbox", { name: /Amigurumi/ })).toHaveAttribute(
      "id",
      "desktop-category-amigurumi",
    );
    expect(screen.getByLabelText("Minimum")).toHaveAttribute(
      "id",
      "desktop-min-price",
    );
    expect(screen.getByLabelText("Maximum")).toHaveAttribute(
      "id",
      "desktop-max-price",
    );
  });

  it("states which currency the price range is in", () => {
    render(
      <FilterSidebar
        categories={categories}
        state={defaultCatalogSearchState}
        currency="USD"
      />,
    );

    expect(screen.getByText("Prices in USD")).toBeInTheDocument();
  });

  it("submits a GET to the shop so filters live in the URL", () => {
    const { container } = render(
      <FilterSidebar
        categories={categories}
        state={defaultCatalogSearchState}
        currency="BDT"
      />,
    );

    const form = container.querySelector("form");

    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/shop");
  });
});
