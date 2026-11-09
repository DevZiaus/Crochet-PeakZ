import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SortSelect } from "./sort-select";

describe("SortSelect", () => {
  it("names the control with the visible label and shows the current sort", () => {
    render(
      <>
        <span id="sort-label">Sort by</span>
        <SortSelect value="price-asc" labelId="sort-label" />
      </>,
    );

    const trigger = screen.getByRole("combobox", { name: "Sort by" });

    expect(trigger).toHaveTextContent("Price: low to high");
  });
});
