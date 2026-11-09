import type { ProductVariantDto } from "@crochet-peakz/shared";

/** The three variant dimensions, in selection order. */
export type VariantDimension = "color" | "size" | "yarn";

/** A chosen value per variant dimension. Null means the Standard option. */
export interface VariantSelection {
  color: string | null;
  size: string | null;
  yarn: string | null;
}

/** One variant dimension and its options, in display order. */
export interface VariantDimensionGroup {
  dimension: VariantDimension;
  label: string;
  options: Array<{ value: string | null; label: string }>;
}

const dimensionOrder: VariantDimension[] = ["color", "size", "yarn"];

const dimensionLabels: Record<VariantDimension, string> = {
  color: "Colour",
  size: "Size",
  yarn: "Yarn",
};

const variantValue: Record<
  VariantDimension,
  (variant: ProductVariantDto) => string | null
> = {
  color: (variant) => variant.colorName,
  size: (variant) => variant.sizeLabel,
  yarn: (variant) => variant.yarnType,
};

/**
 * Reads the selected values out of a variant.
 *
 * @param variant Variant to read.
 * @returns The selection that variant represents.
 */
export function selectionFromVariant(
  variant: ProductVariantDto,
): VariantSelection {
  return {
    color: variant.colorName,
    size: variant.sizeLabel,
    yarn: variant.yarnType,
  };
}

/**
 * Lists the dimensions that have at least one non null value.
 *
 * @param variants Product variants in id ascending order.
 * @returns Visible dimensions in colour, size, yarn order.
 */
export function getVisibleDimensions(
  variants: ProductVariantDto[],
): VariantDimension[] {
  return dimensionOrder.filter((dimension) =>
    variants.some((variant) => variantValue[dimension](variant) !== null),
  );
}

/**
 * Builds the option groups for a product.
 *
 * A dimension with only null values is hidden. When a dimension has some null
 * values, a Standard option is added at the end.
 *
 * @param variants Product variants in id ascending order.
 * @returns The visible dimension groups.
 */
export function getVariantGroups(
  variants: ProductVariantDto[],
): VariantDimensionGroup[] {
  return getVisibleDimensions(variants).map((dimension) => {
    const values: string[] = [];
    let hasStandard = false;
    for (const variant of variants) {
      const value = variantValue[dimension](variant);
      if (value === null) {
        hasStandard = true;
      } else if (!values.includes(value)) {
        values.push(value);
      }
    }
    const options: Array<{ value: string | null; label: string }> = values.map(
      (value) => ({ value, label: value }),
    );
    if (hasStandard) {
      options.push({ value: null, label: "Standard" });
    }
    return { dimension, label: dimensionLabels[dimension], options };
  });
}

/**
 * Tells whether a variant matches one dimension of a selection.
 *
 * @param variant Variant to test.
 * @param selection Current selection.
 * @param dimension Dimension to compare.
 * @returns True when the variant matches the selected value.
 */
export function matchesDimension(
  variant: ProductVariantDto,
  selection: VariantSelection,
  dimension: VariantDimension,
): boolean {
  return variantValue[dimension](variant) === selection[dimension];
}

/**
 * Tells whether an option can be chosen without changing other dimensions.
 *
 * An option is available when an in stock variant matches every other chosen
 * dimension plus this option.
 *
 * @param variants Product variants in id ascending order.
 * @param selection Current selection.
 * @param dimension Dimension being changed.
 * @param option Option value being tested.
 * @returns True when at least one in stock variant supports the option.
 */
export function isOptionAvailable(
  variants: ProductVariantDto[],
  selection: VariantSelection,
  dimension: VariantDimension,
  option: string | null,
): boolean {
  const visible = getVisibleDimensions(variants);
  return variants.some(
    (variant) =>
      variant.inStock &&
      variantValue[dimension](variant) === option &&
      visible.every(
        (other) =>
          other === dimension || matchesDimension(variant, selection, other),
      ),
  );
}

/**
 * Applies an option choice and returns the variant it resolves to.
 *
 * The first matching in stock variant wins. When no in stock variant matches,
 * the first matching variant is used so the panel can show a sold out state.
 * Later dimensions reset to the values of the chosen variant.
 *
 * @param variants Product variants in id ascending order.
 * @param selection Current selection.
 * @param dimension Dimension being changed.
 * @param option Option value being chosen.
 * @returns The resolved selection and variant, or null when nothing matches.
 */
export function chooseOption(
  variants: ProductVariantDto[],
  selection: VariantSelection,
  dimension: VariantDimension,
  option: string | null,
): { selection: VariantSelection; variant: ProductVariantDto } | null {
  const visible = getVisibleDimensions(variants);
  const index = visible.indexOf(dimension);
  if (index === -1) {
    return null;
  }

  const locked = visible.slice(0, index);
  const matchesLocked = (variant: ProductVariantDto): boolean =>
    locked.every((lockedDimension) =>
      matchesDimension(variant, selection, lockedDimension),
    );

  const matchesChoice = (variant: ProductVariantDto): boolean =>
    matchesLocked(variant) && variantValue[dimension](variant) === option;

  const inStock = variants.find(
    (variant) => variant.inStock && matchesChoice(variant),
  );
  const fallback = variants.find(matchesChoice);
  const chosen = inStock ?? fallback;
  if (chosen === undefined) {
    return null;
  }

  return { selection: selectionFromVariant(chosen), variant: chosen };
}

/**
 * Picks the variant shown when the page first renders.
 *
 * The first in stock variant in id order wins. When every variant is sold out,
 * the first variant is shown so the price and options still render.
 *
 * @param variants Product variants in id ascending order.
 * @returns The preselected variant, or null for a product without variants.
 */
export function getInitialVariant(
  variants: ProductVariantDto[],
): ProductVariantDto | null {
  return variants.find((variant) => variant.inStock) ?? variants[0] ?? null;
}
