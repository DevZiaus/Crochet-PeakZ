/**
 * Regression test for duplicate React keys in the footer link columns.
 *
 * "All Products" and "Custom Orders" both point at `/shop` until the custom
 * order flow ships, so the columns must key on the link label instead of the
 * destination.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { Footer } from "./footer";

describe("Footer", () => {
  it("renders the link columns without duplicate React keys", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      render(<Footer />);

      const duplicateKeyWarnings = consoleError.mock.calls.filter((call) =>
        String(call[0]).includes("same key"),
      );
      expect(duplicateKeyWarnings).toHaveLength(0);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("exposes the rounded Crochet PeakZ logo, wordmark, copyright, and social/contact hrefs", () => {
    render(<Footer />);

    const homeLink = screen.getByRole("link", { name: "Crochet PeakZ home" });
    expect(homeLink).toHaveAttribute("href", "/");

    const logoImage = homeLink.querySelector("img");
    expect(logoImage).not.toBeNull();
    expect(logoImage?.getAttribute("src")).toContain("logo.webp");
    expect(logoImage).toHaveClass("rounded-full");

    expect(within(homeLink).getByText("Crochet")).toHaveClass(
      "text-brand-teal",
    );
    expect(within(homeLink).getByText("PeakZ")).toHaveClass("text-accent");
    expect(
      screen.getByText(/Crochet PeakZ\. All rights reserved\./),
    ).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Data Deletion" })).toHaveAttribute(
      "href",
      "/data-deletion",
    );
    expect(screen.getByRole("link", { name: "Facebook" })).toHaveAttribute(
      "href",
      "https://www.facebook.com/crochet.peakz",
    );
    expect(screen.getByRole("link", { name: "Instagram" })).toHaveAttribute(
      "href",
      "https://www.instagram.com/crochetpeakz/",
    );
    const emailLink = screen.getByRole("link", { name: "Email" });
    expect(emailLink).toHaveAttribute("href", "mailto:hello@crochetpeakz.tech");
    expect(emailLink).not.toHaveAttribute("target", "_blank");
  });
});
