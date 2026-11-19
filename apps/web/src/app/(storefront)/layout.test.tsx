/**
 * Storefront shell tests.
 *
 * AC-17 commits every catalog screen to WCAG 2.1 AA, so the first focusable
 * element has to be a bypass link pointing at the main landmark.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import StorefrontLayout from "./layout";

vi.mock("../../components/header", () => ({
  Header: () => <header>Header</header>,
}));

vi.mock("../../components/footer", () => ({
  Footer: () => <footer>Footer</footer>,
}));

describe("StorefrontLayout", () => {
  it("offers a skip link that targets the main landmark", () => {
    render(
      <StorefrontLayout>
        <p>Catalog content</p>
      </StorefrontLayout>,
    );

    const link = screen.getByRole("link", { name: "Skip to content" });
    expect(link).toHaveAttribute("href", "#main-content");
    expect(document.querySelector("main#main-content")).not.toBeNull();
  });
});
