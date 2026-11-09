import type { CatalogCategoryRecord } from "./types.js";

/**
 * Resolves a category and every descendant id.
 *
 * The tree is walked with a visited set, so a parent cycle is ignored after
 * the first visit instead of looping forever.
 *
 * @param categories Every category row.
 * @param rootId Category id to expand.
 * @returns The root id and every descendant id.
 */
export function resolveCategorySubtreeIds(
  categories: readonly CatalogCategoryRecord[],
  rootId: string,
): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const category of categories) {
    if (category.parentId === null) {
      continue;
    }
    const children = childrenByParent.get(category.parentId) ?? [];
    children.push(category.id);
    childrenByParent.set(category.parentId, children);
  }

  const visited = new Set<string>();
  const stack = [rootId];

  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined || visited.has(id)) {
      continue;
    }
    visited.add(id);
    const children = childrenByParent.get(id);
    if (children) {
      stack.push(...children);
    }
  }

  return [...visited];
}

/**
 * Resolves repeated category slugs to every matching subtree id.
 *
 * Unknown slugs are ignored. A parent slug expands to itself and all
 * descendants.
 *
 * @param categories Every category row.
 * @param slugs Requested category slugs.
 * @returns A deduplicated id list.
 */
export function resolveCategorySlugIds(
  categories: readonly CatalogCategoryRecord[],
  slugs: readonly string[],
): string[] {
  const bySlug = new Map(
    categories.map((category) => [category.slug, category]),
  );
  const ids = new Set<string>();

  for (const slug of slugs) {
    const category = bySlug.get(slug);
    if (!category) {
      continue;
    }
    for (const id of resolveCategorySubtreeIds(categories, category.id)) {
      ids.add(id);
    }
  }

  return [...ids];
}

/**
 * Builds the breadcrumb trail from the root category down to the given one.
 *
 * A visited set guards against a parent cycle.
 *
 * @param categories Every category row.
 * @param categoryId Target category id.
 * @returns Category rows from root to the target. Empty when the id is unknown.
 */
export function buildCategoryTrail(
  categories: readonly CatalogCategoryRecord[],
  categoryId: string,
): CatalogCategoryRecord[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const trail: CatalogCategoryRecord[] = [];
  const visited = new Set<string>();

  let current = byId.get(categoryId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    trail.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return trail;
}

/**
 * Lists the direct children of a category.
 *
 * @param categories Every category row.
 * @param parentId Parent category id.
 * @returns Direct children ordered by name.
 */
export function listCategoryChildren(
  categories: readonly CatalogCategoryRecord[],
  parentId: string,
): CatalogCategoryRecord[] {
  return categories
    .filter((category) => category.parentId === parentId)
    .sort((left, right) => left.name.localeCompare(right.name, "en"));
}

/**
 * Lists top level categories ordered by name.
 *
 * @param categories Every category row.
 * @returns Categories with no parent.
 */
export function listTopLevelCategories(
  categories: readonly CatalogCategoryRecord[],
): CatalogCategoryRecord[] {
  return categories
    .filter((category) => category.parentId === null)
    .sort((left, right) => left.name.localeCompare(right.name, "en"));
}
