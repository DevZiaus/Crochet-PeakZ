import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pagination } from "./pagination";

const hrefForPage = (page: number): string =>
  `/shop?category=amigurumi&page=${String(page)}`;

describe("Pagination", () => {
  it("renders nothing when there is only one page", () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} hrefForPage={hrefForPage} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("marks the current page and preserves filters in every link", () => {
    render(<Pagination page={2} totalPages={3} hrefForPage={hrefForPage} />);

    expect(
      screen.getByRole("navigation", { name: "Pagination" }),
    ).toBeInTheDocument();

    const current = screen.getByRole("link", { name: "Page 2" });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current).toHaveAttribute("href", "/shop?category=amigurumi&page=2");

    expect(screen.getByRole("link", { name: "Page 3" })).toHaveAttribute(
      "href",
      "/shop?category=amigurumi&page=3",
    );
    expect(screen.getByRole("link", { name: /Previous/ })).toHaveAttribute(
      "href",
      "/shop?category=amigurumi&page=1",
    );
    expect(screen.getByRole("link", { name: /Next/ })).toHaveAttribute(
      "href",
      "/shop?category=amigurumi&page=3",
    );
  });

  it("disables previous on the first page and next on the last page", () => {
    const { rerender } = render(
      <Pagination page={1} totalPages={2} hrefForPage={hrefForPage} />,
    );

    expect(screen.queryByRole("link", { name: /Previous/ })).toBeNull();
    expect(
      screen.getByText("Previous").closest("[aria-disabled]"),
    ).not.toBeNull();

    rerender(<Pagination page={2} totalPages={2} hrefForPage={hrefForPage} />);

    expect(screen.queryByRole("link", { name: /Next/ })).toBeNull();
    expect(screen.getByText("Next").closest("[aria-disabled]")).not.toBeNull();
  });

  it("collapses long page lists into gaps", () => {
    render(<Pagination page={5} totalPages={10} hrefForPage={hrefForPage} />);

    expect(screen.getByRole("link", { name: "Page 1" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Page 10" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Page 4" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Page 6" })).toBeInTheDocument();
    expect(screen.getAllByText("…")).toHaveLength(2);
  });
});
