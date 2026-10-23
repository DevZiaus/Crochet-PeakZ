import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StarRating } from "./star-rating";

describe("StarRating", () => {
  it("renders the correct number of star icons for a whole number rating", () => {
    const { container } = render(<StarRating rating={4} />);
    const stars = container.querySelectorAll("svg");
    // 4 filled + 1 empty = 5 total star icons
    expect(stars.length).toBe(5);
    const filled = container.querySelectorAll(".fill-accent.text-accent");
    expect(filled.length).toBe(4);
    const ariaLabel = screen.getByRole("img");
    expect(ariaLabel).toHaveAttribute("aria-label", "4 out of 5 stars");
  });

  it("rounds 4.8 to 5 full stars while announcing the true value", () => {
    const { container } = render(<StarRating rating={4.8} />);
    const stars = container.querySelectorAll("svg");
    // 5 full stars, no half star, no empty stars
    expect(stars.length).toBe(5);
    const filled = container.querySelectorAll(".fill-accent.text-accent");
    expect(filled.length).toBe(5);
    const ariaLabel = screen.getByRole("img");
    // The graphic rounds; the accessible name keeps the real average.
    expect(ariaLabel).toHaveAttribute("aria-label", "4.8 out of 5 stars");
  });

  it("renders a half star for 4.7 rating (rounds to 4.5)", () => {
    const { container } = render(<StarRating rating={4.7} />);
    const stars = container.querySelectorAll("svg");
    // 4 filled + 1 half star (half renders as 2 SVGs) = 6 total SVGs
    expect(stars.length).toBe(6);
  });

  it("renders a half star for 4.3 rating (rounds to 4.5)", () => {
    const { container } = render(<StarRating rating={4.3} />);
    const stars = container.querySelectorAll("svg");
    expect(stars.length).toBe(6);
  });

  it("renders 2 full + 1 half + 2 empty for 2.4 rating", () => {
    const { container } = render(<StarRating rating={2.4} />);
    const stars = container.querySelectorAll("svg");
    // 2 filled + 1 half (2 SVGs) + 2 empty = 6 SVGs total
    expect(stars.length).toBe(6);
  });

  it("clamps ratings above maxStars to 5 full stars", () => {
    const { container } = render(<StarRating rating={6} />);
    const stars = container.querySelectorAll("svg");
    expect(stars.length).toBe(5);
    const filled = container.querySelectorAll(".fill-accent.text-accent");
    expect(filled.length).toBe(5);
  });

  it("clamps ratings below 0 to 0 stars (min clamp is 0 not 1)", () => {
    const { container } = render(<StarRating rating={-1} />);
    const stars = container.querySelectorAll("svg");
    expect(stars.length).toBe(5);
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      "0 out of 5 stars",
    );
  });

  it("handles NaN rating gracefully without crashing", () => {
    const { container } = render(<StarRating rating={NaN} />);
    const stars = container.querySelectorAll("svg");
    expect(stars.length).toBe(5);
  });

  it("handles non-integer maxStars by defaulting to 5", () => {
    const { container } = render(<StarRating rating={3} maxStars={3.5} />);
    const stars = container.querySelectorAll("svg");
    // Non-integer maxStars defaults to 5, so 3 filled + 2 empty = 5 stars
    expect(stars.length).toBe(5);
    const filled = container.querySelectorAll(".fill-accent.text-accent");
    expect(filled.length).toBe(3);
  });

  it("shows the true rating when showValue is true", () => {
    render(<StarRating rating={4.25} showValue={true} />);
    // 4.25 rounds to 4.5 graphically, but the readout keeps the real value.
    const valueSpan = screen.getByText("4.25");
    expect(valueSpan).toBeInTheDocument();
  });

  it("keeps a near perfect rating honest at the 4.75 threshold", () => {
    render(<StarRating rating={4.75} showValue={true} />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      "4.75 out of 5 stars",
    );
    expect(screen.getByText("4.75")).toBeInTheDocument();
  });

  it("applies size classes correctly", () => {
    const { container } = render(<StarRating rating={3} size="lg" />);
    const stars = container.querySelectorAll("svg");
    stars.forEach((star) => {
      expect(star.getAttribute("class")).toContain("size-5");
    });
  });
});
