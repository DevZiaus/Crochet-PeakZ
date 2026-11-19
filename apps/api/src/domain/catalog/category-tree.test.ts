import { describe, expect, it } from "vitest";
import {
  buildCategoryTrail,
  listCategoryChildren,
  listTopLevelCategories,
  resolveCategorySlugIds,
  resolveCategorySubtreeIds,
} from "./category-tree.js";
import { makeCategory } from "../../test-support/catalog-fakes.js";

const categories = [
  makeCategory({ id: "root", slug: "wearables", name: "Wearables" }),
  makeCategory({
    id: "child",
    slug: "scarves",
    name: "Scarves",
    parentId: "root",
  }),
  makeCategory({
    id: "grandchild",
    slug: "winter-scarves",
    name: "Winter scarves",
    parentId: "child",
  }),
  makeCategory({ id: "other", slug: "amigurumi", name: "Amigurumi" }),
];

describe("category subtree resolution", () => {
  it("includes the category and every descendant", () => {
    expect(resolveCategorySubtreeIds(categories, "root").sort()).toEqual([
      "child",
      "grandchild",
      "root",
    ]);
  });

  it("resolves repeated slugs and ignores unknown ones", () => {
    expect(
      resolveCategorySlugIds(categories, ["scarves", "missing"]).sort(),
    ).toEqual(["child", "grandchild"]);
  });

  it("ignores a parent cycle after the first visit", () => {
    const cyclic = [
      makeCategory({ id: "a", slug: "a", parentId: "b" }),
      makeCategory({ id: "b", slug: "b", parentId: "a" }),
    ];

    expect(resolveCategorySubtreeIds(cyclic, "a").sort()).toEqual(["a", "b"]);
  });
});

describe("category trails and children", () => {
  it("builds the trail from root to the category", () => {
    expect(
      buildCategoryTrail(categories, "grandchild").map(
        (category) => category.slug,
      ),
    ).toEqual(["wearables", "scarves", "winter-scarves"]);
  });

  it("lists direct children only, ordered by name", () => {
    expect(
      listCategoryChildren(categories, "root").map((category) => category.slug),
    ).toEqual(["scarves"]);
  });

  it("lists top level categories ordered by name", () => {
    expect(
      listTopLevelCategories(categories).map((category) => category.slug),
    ).toEqual(["amigurumi", "wearables"]);
  });
});
