import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CategorySummaryDto } from "@crochet-peakz/shared";
import { CatalogFilterForm } from "./filter-form";
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
  {
    id: "2",
    name: "Empty shelf",
    slug: "empty-shelf",
    parentId: null,
    description: null,
    productCount: 0,
    coverImageUrl: null,
    coverImageAlt: null,
  },
];

describe("CatalogFilterForm", () => {
  it("renders only categories with visible products", () => {
    render(
      <CatalogFilterForm
        categories={categories}
        state={defaultCatalogSearchState}
        currency="BDT"
        idPrefix="test"
      />,
    );

    expect(screen.getByRole("checkbox", { name: /Amigurumi/ })).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: /Empty shelf/ })).toBeNull();
  });

  it("checks the active filters and fills the price inputs", () => {
    render(
      <CatalogFilterForm
        categories={categories}
        state={{
          ...defaultCatalogSearchState,
          categories: ["amigurumi"],
          types: ["STANDARD"],
          minPrice: 10,
          maxPrice: 50,
          sort: "price-asc",
        }}
        currency="USD"
        idPrefix="test"
      />,
    );

    expect(
      screen
        .getByRole("checkbox", { name: /Amigurumi/ })
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen
        .getByRole("checkbox", { name: /Standard/ })
        .getAttribute("aria-checked"),
    ).toBe("true");
    const minimum = screen.getByLabelText<HTMLInputElement>("Minimum");
    const maximum = screen.getByLabelText<HTMLInputElement>("Maximum");
    expect(minimum.value).toBe("10");
    expect(maximum.value).toBe("50");
    expect(minimum.getAttribute("aria-describedby")).toBe("test-price-hint");
    expect(maximum.getAttribute("aria-describedby")).toBe("test-price-hint");
    expect(screen.getByText("Prices in USD. Up to two decimals.")).toBeTruthy();
  });

  it("preserves featured when applying other filters", () => {
    const { container } = render(
      <CatalogFilterForm
        categories={categories}
        state={{ ...defaultCatalogSearchState, featured: true }}
        currency="BDT"
        idPrefix="test"
      />,
    );

    expect(
      container.querySelector<HTMLInputElement>('input[name="featured"]')
        ?.value,
    ).toBe("true");
  });

  it("keeps the sort in a hidden field and offers clear all", () => {
    const { container } = render(
      <CatalogFilterForm
        categories={categories}
        state={{ ...defaultCatalogSearchState, sort: "price-desc" }}
        currency="BDT"
        idPrefix="test"
      />,
    );

    const sortInput =
      container.querySelector<HTMLInputElement>('input[name="sort"]');
    expect(sortInput?.value).toBe("price-desc");
    expect(
      screen.getByRole("link", { name: "Clear all" }).getAttribute("href"),
    ).toBe("/shop");
    expect(screen.getByRole("button", { name: "Apply filters" })).toBeTruthy();
  });
});
