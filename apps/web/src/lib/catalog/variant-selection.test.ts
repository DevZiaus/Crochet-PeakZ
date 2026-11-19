import { describe, expect, it } from "vitest";
import {
  chooseOption,
  getInitialVariant,
  getVariantGroups,
  isOptionAvailable,
  selectionFromVariant,
  type VariantSelection,
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

  it("disables a color option when it conflicts with a different chosen dimension", () => {
    const variants = [
      makeVariant({
        id: "a",
        colorName: "Deep Teal",
        sizeLabel: "Large",
        yarnType: "Cotton",
      }),
      makeVariant({
        id: "b",
        colorName: "Coral Sunset",
        sizeLabel: "Small",
        yarnType: "Acrylic",
      }),
    ];
    const selection: VariantSelection = {
      color: "Deep Teal",
      size: "Large",
      yarn: "Cotton",
    };

    expect(
      isOptionAvailable(variants, selection, "color", "Coral Sunset"),
    ).toBe(false);
  });

  it("disables a colour option that conflicts with a later chosen dimension", () => {
    const variants = [
      makeVariant({
        id: "a",
        colorName: "Deep Teal",
        sizeLabel: "Small",
      }),
      makeVariant({
        id: "b",
        colorName: "Coral Sunset",
        sizeLabel: "Large",
      }),
    ];
    const selection = selectionFromVariant(variants[0]!);

    expect(
      isOptionAvailable(variants, selection, "color", "Coral Sunset"),
    ).toBe(false);
  });

  it("keeps a later size option disabled when it does not match the chosen colour", () => {
    const variants = [
      makeVariant({ id: "a", colorName: "Deep Teal", sizeLabel: null }),
      makeVariant({ id: "b", colorName: "Coral Sunset", sizeLabel: "Large" }),
    ];
    const selection: VariantSelection = {
      color: "Coral Sunset",
      size: "Large",
      yarn: null,
    };

    expect(isOptionAvailable(variants, selection, "size", null)).toBe(false);
    expect(isOptionAvailable(variants, selection, "size", "Large")).toBe(true);
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

  it("reads a selection from every variant dimension", () => {
    const variant = makeVariant({
      colorName: "Deep Teal",
      sizeLabel: "Large",
      yarnType: "Cotton",
    });

    expect(selectionFromVariant(variant)).toEqual({
      color: "Deep Teal",
      size: "Large",
      yarn: "Cotton",
    });
  });

  it("keeps colour, size, and yarn order and removes duplicate options", () => {
    const variants = [
      makeVariant({
        id: "a",
        colorName: "Deep Teal",
        sizeLabel: "S",
        yarnType: "Cotton",
      }),
      makeVariant({
        id: "b",
        colorName: "Deep Teal",
        sizeLabel: "M",
        yarnType: "Cotton",
      }),
      makeVariant({
        id: "c",
        colorName: "Coral Sunset",
        sizeLabel: "S",
        yarnType: "Acrylic",
      }),
    ];

    const groups = getVariantGroups(variants);

    expect(groups.map((group) => group.dimension)).toEqual([
      "color",
      "size",
      "yarn",
    ]);
    expect(groups[0]?.options.map((option) => option.value)).toEqual([
      "Deep Teal",
      "Coral Sunset",
    ]);
    expect(groups[1]?.options.map((option) => option.value)).toEqual([
      "S",
      "M",
    ]);
    expect(groups[2]?.options.map((option) => option.value)).toEqual([
      "Cotton",
      "Acrylic",
    ]);
  });

  it("returns false for a dimension the product does not show", () => {
    const variants = [
      makeVariant({ id: "a", colorName: "Honey Gold", sizeLabel: null }),
    ];
    const selection = selectionFromVariant(variants[0]!);

    expect(isOptionAvailable(variants, selection, "size", null)).toBe(false);
    expect(isOptionAvailable(variants, selection, "yarn", null)).toBe(false);
  });

  it("ignores sold out variants when deciding availability", () => {
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

  it("allows the Standard option when an in stock variant matches the earlier dimensions", () => {
    const variants = [
      makeVariant({ id: "a", colorName: "Deep Teal", sizeLabel: "Large" }),
      makeVariant({ id: "b", colorName: "Deep Teal", sizeLabel: null }),
    ];
    const selection = selectionFromVariant(variants[0]!);

    expect(isOptionAvailable(variants, selection, "size", null)).toBe(true);
  });

  it("locks colour and size when testing a yarn option", () => {
    const variants = [
      makeVariant({
        id: "a",
        colorName: "Deep Teal",
        sizeLabel: "S",
        yarnType: "Cotton",
      }),
      makeVariant({
        id: "b",
        colorName: "Deep Teal",
        sizeLabel: "S",
        yarnType: "Acrylic",
      }),
      makeVariant({
        id: "c",
        colorName: "Coral Sunset",
        sizeLabel: "S",
        yarnType: "Acrylic",
      }),
    ];
    const selection: VariantSelection = {
      color: "Deep Teal",
      size: "S",
      yarn: "Cotton",
    };

    expect(isOptionAvailable(variants, selection, "yarn", "Acrylic")).toBe(
      true,
    );
    expect(isOptionAvailable(variants, selection, "yarn", "Wool")).toBe(false);
  });

  it("picks the first in stock match before a sold out one", () => {
    const variants = [
      makeVariant({
        id: "a",
        colorName: "Honey Gold",
        sizeLabel: "S",
        inStock: false,
      }),
      makeVariant({
        id: "b",
        colorName: "Honey Gold",
        sizeLabel: "M",
        inStock: true,
      }),
    ];
    const selection = selectionFromVariant(variants[0]!);

    const result = chooseOption(variants, selection, "size", "M");

    expect(result?.variant.id).toBe("b");
    expect(result?.selection.size).toBe("M");
  });

  it("falls back to a sold out variant so the panel can show its state", () => {
    const variants = [
      makeVariant({ id: "a", colorName: "Honey Gold", inStock: false }),
    ];
    const selection: VariantSelection = {
      color: "Honey Gold",
      size: null,
      yarn: null,
    };

    const result = chooseOption(variants, selection, "color", "Honey Gold");

    expect(result?.variant.id).toBe("a");
    expect(result?.variant.inStock).toBe(false);
  });

  it("returns null when the dimension is hidden or the option does not exist", () => {
    const variants = [
      makeVariant({ id: "a", colorName: "Honey Gold", sizeLabel: null }),
    ];
    const selection = selectionFromVariant(variants[0]!);

    expect(chooseOption(variants, selection, "size", null)).toBeNull();
    expect(chooseOption(variants, selection, "color", "Blush Pink")).toBeNull();
  });
});
