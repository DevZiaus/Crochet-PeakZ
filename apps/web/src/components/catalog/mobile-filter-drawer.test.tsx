/**
 * Tests for the mobile filter drawer (AC-3, AC-17).
 *
 * Below the large breakpoint the sidebar is hidden, so this drawer is the only
 * way to filter. It has to open from a labelled trigger, expose a named dialog
 * with the same form, and close again without losing the shopper's place.
 *
 * The dialog is named by its `DialogTitle` ("Filters"), because Radix points
 * `aria-labelledby` at the title and that wins over the `aria-label` on the
 * content element.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CategorySummaryDto } from "@crochet-peakz/shared";
import { MobileFilterDrawer } from "./mobile-filter-drawer";
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

function renderDrawer() {
  return render(
    <MobileFilterDrawer
      categories={categories}
      state={defaultCatalogSearchState}
      currency="BDT"
    />,
  );
}

describe("MobileFilterDrawer", () => {
  it("starts closed with a labelled Filters trigger", () => {
    renderDrawer();

    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens a named dialog containing the filter form", async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.click(screen.getByRole("button", { name: "Filters" }));

    const dialog = await screen.findByRole("dialog", { name: "Filters" });

    expect(
      within(dialog).getByRole("checkbox", { name: /Amigurumi/ }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Apply filters" }),
    ).toBeInTheDocument();
  });

  it("prefixes the drawer fields with the mobile id so the desktop form stays unique", async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await screen.findByRole("dialog", { name: "Filters" });

    expect(screen.getByRole("checkbox", { name: /Amigurumi/ })).toHaveAttribute(
      "id",
      "mobile-category-amigurumi",
    );
    expect(screen.getByLabelText("Minimum")).toHaveAttribute(
      "id",
      "mobile-min-price",
    );
  });

  it("closes from the labelled close button", async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    const dialog = await screen.findByRole("dialog", { name: "Filters" });

    await user.click(
      within(dialog).getByRole("button", { name: "Close filters" }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("closes when Escape is pressed", async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await screen.findByRole("dialog", { name: "Filters" });

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("returns focus to the trigger after closing", async () => {
    const user = userEvent.setup();
    renderDrawer();

    const trigger = screen.getByRole("button", { name: "Filters" });
    trigger.focus();
    await user.click(trigger);
    await screen.findByRole("dialog", { name: "Filters" });
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it("carries the active filters into the drawer form", async () => {
    const user = userEvent.setup();
    render(
      <MobileFilterDrawer
        categories={categories}
        state={{
          ...defaultCatalogSearchState,
          categories: ["amigurumi"],
          minPrice: 10,
        }}
        currency="BDT"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));
    const dialog = await screen.findByRole("dialog", { name: "Filters" });

    expect(
      within(dialog).getByRole("checkbox", { name: /Amigurumi/ }),
    ).toBeChecked();
    expect(within(dialog).getByLabelText("Minimum")).toHaveValue(10);
  });
});
