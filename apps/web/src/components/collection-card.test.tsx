/**
 * Tests for the collection card (AC-11).
 *
 * The card is the only way into a collection page from the index, so the link
 * target, the accessible name of the cover, and the subtree count all matter.
 * The singular and plural count wording is what a shopper reads to judge how
 * much is inside a collection.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { CategorySummaryDto } from "@crochet-peakz/shared";
import { CollectionCard } from "./collection-card";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

const baseCategory: CategorySummaryDto = {
  id: "category-1",
  name: "Amigurumi",
  slug: "amigurumi",
  parentId: null,
  description: "Soft crocheted friends made for small hands.",
  productCount: 4,
  coverImageUrl: "https://res.cloudinary.com/demo/image/upload/bear",
  coverImageAlt: "A crocheted bear on a chair",
};

describe("CollectionCard", () => {
  it("links to the collection page and names it with a heading", () => {
    render(<CollectionCard category={baseCategory} />);

    const link = screen.getByRole("link", { name: /Amigurumi/ });

    expect(link).toHaveAttribute("href", "/collections/amigurumi");
    expect(
      screen.getByRole("heading", { name: "Amigurumi" }),
    ).toBeInTheDocument();
  });

  it("shows the description and the subtree product count", () => {
    render(<CollectionCard category={baseCategory} />);

    expect(
      screen.getByText("Soft crocheted friends made for small hands."),
    ).toBeInTheDocument();
    expect(screen.getByText("4 pieces")).toBeInTheDocument();
  });

  it("uses the singular wording for a single piece", () => {
    render(<CollectionCard category={{ ...baseCategory, productCount: 1 }} />);

    expect(screen.getByText("1 piece")).toBeInTheDocument();
  });

  it("uses the plural wording for an empty collection", () => {
    render(<CollectionCard category={{ ...baseCategory, productCount: 0 }} />);

    expect(screen.getByText("0 pieces")).toBeInTheDocument();
  });

  it("uses the cover alt text for the image", () => {
    render(<CollectionCard category={baseCategory} />);

    expect(
      screen.getByRole("img", { name: "A crocheted bear on a chair" }),
    ).toHaveAttribute(
      "src",
      "https://res.cloudinary.com/demo/image/upload/bear",
    );
  });

  it("falls back to the collection name when the cover has no alt text", () => {
    render(
      <CollectionCard category={{ ...baseCategory, coverImageAlt: null }} />,
    );

    expect(screen.getByRole("img", { name: "Amigurumi" })).toBeInTheDocument();
  });

  it("falls back to the local placeholder when the cover is missing", () => {
    render(
      <CollectionCard category={{ ...baseCategory, coverImageUrl: null }} />,
    );

    expect(
      screen.getByRole("img", { name: /A crocheted bear/ }),
    ).toHaveAttribute("src", "/images/product-placeholder.webp");
  });

  it("omits the description paragraph when the category has none", () => {
    const { container } = render(
      <CollectionCard category={{ ...baseCategory, description: null }} />,
    );

    expect(container.querySelectorAll("p")).toHaveLength(1);
  });
});
