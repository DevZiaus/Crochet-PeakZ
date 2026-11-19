import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProductImage, PRODUCT_IMAGE_PLACEHOLDER } from "./product-image";

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    onError,
  }: {
    src: string;
    alt: string;
    onError?: () => void;
  }) => <img src={src} alt={alt} onError={onError} />,
}));

describe("ProductImage", () => {
  it("renders the local placeholder when the source is missing", () => {
    render(<ProductImage src={null} alt="Bear image coming soon" />);

    expect(
      screen.getByRole("img", { name: "Bear image coming soon" }),
    ).toHaveAttribute("src", PRODUCT_IMAGE_PLACEHOLDER);
  });

  it("swaps to the placeholder when a remote image fails", () => {
    render(<ProductImage src="https://example.com/bear.webp" alt="Bear" />);

    const image = screen.getByRole("img", { name: "Bear" });
    expect(image).toHaveAttribute("src", "https://example.com/bear.webp");

    fireEvent.error(image);

    expect(image).toHaveAttribute("src", PRODUCT_IMAGE_PLACEHOLDER);
  });

  it("stays on the placeholder if the fallback also fires an error", () => {
    render(<ProductImage src="https://example.com/bear.webp" alt="Bear" />);

    const image = screen.getByRole("img", { name: "Bear" });

    fireEvent.error(image);
    fireEvent.error(image);

    expect(image).toHaveAttribute("src", PRODUCT_IMAGE_PLACEHOLDER);
  });
});
