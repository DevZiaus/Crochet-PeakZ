import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductGallery } from "./product-gallery";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

const images = [
  {
    url: "https://res.cloudinary.com/demo/image/upload/first",
    alt: "First image",
    isPrimary: true,
    displayOrder: 0,
  },
  {
    url: "https://res.cloudinary.com/demo/image/upload/second",
    alt: "Second image",
    isPrimary: false,
    displayOrder: 1,
  },
];

describe("ProductGallery", () => {
  it("changes the main image from the thumbnail strip", async () => {
    const user = userEvent.setup();
    render(<ProductGallery images={images} productTitle="Bear" />);

    const second = screen.getByRole("button", {
      name: "View image 2 of 2",
    });
    expect(second).toHaveAttribute("aria-pressed", "false");

    await user.click(second);

    expect(second).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByAltText("Second image").length).toBeGreaterThan(0);
  });

  it("renders the placeholder when a product has no images", () => {
    render(<ProductGallery images={[]} productTitle="Bear" />);

    expect(screen.getByAltText(/Bear image coming soon/)).toHaveAttribute(
      "src",
      "/images/product-placeholder.webp",
    );
  });
});
