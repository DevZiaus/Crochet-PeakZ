import { describe, expect, it } from "vitest";
import {
  chooseOption,
  getInitialVariant,
  getVariantGroups,
  isOptionAvailable,
  selectionFromVariant,
} from "./variant-selection";
import { makeVariant } from "../../test-support/catalog-fixtures";

describe("variant selection", () => {
  it("shows only dimensions that have a non null value", () => {
    const variants = [
      makeVariant({ id: "a", colorName: "Honey Gold", sizeLabel: null }),
      makeVariant({ id: "b", colorName: "Blush Pink", sizeLabel: null }),
    ];

    const groups = getVariantGroups(variants);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.dimension).toBe("color");
    expect(groups[0]?.options.map((option) => option.label)).toEqual([
      "Honey Gold",
      "Blush Pink",
    ]);
  });

  it("adds a Standard option when a shown dimension has null values", () => {
    const variants = [
      makeVariant({ id: "a", colorName: "Honey Gold" }),
      makeVariant({ id: "b", colorName: null }),
    ];

    const groups = getVariantGroups(variants);

    expect(groups[0]?.options).toEqual([
      { value: "Honey Gold", label: "Honey Gold" },
      { value: null, label: "Standard" },
    ]);
  });

  it("hides a dimension that is null for every variant", () => {
    const variants = [
      makeVariant({ id: "a", colorName: "Honey Gold", yarnType: null }),
    ];

    expect(getVariantGroups(variants).map((group) => group.dimension)).toEqual([
      "color",
    ]);
  });

  it("disables an option when no in stock variant supports it", () => {
    const variants = [
      makeVariant({ id: "a", colorName: "Honey Gold", inStock: true }),
      makeVariant({ id: "b", colorName: "Blush Pink", inStock: false }),
    ];
    const selection = selectionFromVariant(variants[0]!);

    expect(isOptionAvailable(variants, selection, "color", "Honey Gold")).toBe(
      true,
    );
    expect(isOptionAvailable(variants, selection, "color", "Blush Pink")).toBe(
      false,
    );
  });

  it("resets later dimensions to the first matching variant", () => {
    const variants = [
      makeVariant({ id: "a", colorName: "Honey Gold", sizeLabel: "S" }),
      makeVariant({ id: "b", colorName: "Honey Gold", sizeLabel: "M" }),
      makeVariant({ id: "c", colorName: "Blush Pink", sizeLabel: "L" }),
    ];
    const selection = selectionFromVariant(variants[0]!);

    const result = chooseOption(variants, selection, "color", "Blush Pink");

    expect(result?.variant.id).toBe("c");
    expect(result?.selection).toEqual({
      color: "Blush Pink",
      size: "L",
      yarn: null,
    });
  });

  it("preselects the first in stock variant, then the first variant", () => {
    const soldOut = makeVariant({ id: "a", inStock: false });
    const inStock = makeVariant({ id: "b", inStock: true });

    expect(getInitialVariant([soldOut, inStock])?.id).toBe("b");
    expect(getInitialVariant([soldOut])?.id).toBe("a");
    expect(getInitialVariant([])).toBeNull();
  });
});
