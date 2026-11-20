/**
 * Storefront shell tests.
 *
 * AC-17 commits every catalog screen to WCAG 2.1 AA, so the first focusable
 * element has to be a bypass link pointing at the main landmark. AC-9 requires
 * the layout to read the server currency once and wrap its children in
 * `CurrencyProvider`.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useCurrency } from "../../components/currency/currency-provider";
import StorefrontLayout from "./layout";

const { getActiveCurrencyMock } = vi.hoisted(() => ({
  getActiveCurrencyMock: vi.fn(() => Promise.resolve("USD" as const)),
}));

vi.mock("../../lib/currency/server", () => ({
  getActiveCurrency: getActiveCurrencyMock,
}));

vi.mock("../../components/header", () => ({
  Header: () => <header>Header</header>,
}));

vi.mock("../../components/footer", () => ({
  Footer: () => <footer>Footer</footer>,
}));

function CurrencyReader() {
  const currency = useCurrency();
  return <p data-testid="active-currency">{currency}</p>;
}

describe("StorefrontLayout", () => {
  it("offers a skip link that targets the main landmark and provides the server currency", async () => {
    const view = await StorefrontLayout({
      children: <CurrencyReader />,
    });
    render(view);

    const link = screen.getByRole("link", { name: "Skip to content" });
    expect(link).toHaveAttribute("href", "#main-content");
    expect(document.querySelector("main#main-content")).not.toBeNull();
    expect(screen.getByTestId("active-currency")).toHaveTextContent("USD");
    expect(getActiveCurrencyMock).toHaveBeenCalledTimes(1);
  });
});
