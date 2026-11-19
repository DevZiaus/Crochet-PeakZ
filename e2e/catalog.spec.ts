/**
 * End to end flow for the product catalog storefront.
 *
 * Drives the real browser against the real web app and the real API, using the
 * seeded catalog. It proves the home page, the shop listing with filters and
 * sort, pagination clamping, the collection pages, the currency cookie, a
 * product detail with variant selection, and the styled not found page, on both
 * the desktop and mobile projects.
 *
 * Covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-11, AC-12,
 * AC-14, AC-16, and AC-19.
 */
import { expect, test } from "@playwright/test";

const PRODUCT_TITLE = "Sunflower Amigurumi Bear";
const OTHER_PRODUCT_TITLE = "Ocean Wave Infinity Scarf";
const DIGITAL_TITLE = "Beginner Crochet Pattern Bundle";
const CUSTOM_TITLE = "Custom Baby Blanket";

/** The seeded slugs, used where a link target is the assertion. */
const SLUGS = {
  bear: "/shop/sunflower-amigurumi-bear",
  scarf: "/shop/ocean-wave-infinity-scarf",
  doily: "/shop/vintage-lace-doily-collection",
  digital: "/shop/beginner-crochet-pattern-bundle-digital",
  blanket: "/shop/custom-baby-blanket",
} as const;

test("browses the catalog, filters the shop, and opens a product", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Handmade pieces, made to be kept",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Featured pieces" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: new RegExp(PRODUCT_TITLE) }).first(),
  ).toBeVisible();

  await page.goto("/shop");

  await expect(
    page.getByRole("heading", { level: 1, name: "Shop" }),
  ).toBeVisible();
  await expect(page.getByText("5 pieces")).toBeVisible();
  await expect(
    page.getByRole("link", { name: new RegExp(OTHER_PRODUCT_TITLE) }),
  ).toBeVisible();

  if (isMobile) {
    await page.getByRole("button", { name: "Filters" }).click();
    await page
      .getByRole("dialog")
      .getByRole("checkbox", { name: /Amigurumi/ })
      .check();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Apply filters" })
      .click();
  } else {
    await page.getByRole("checkbox", { name: /Amigurumi/ }).check();
    await page.getByRole("button", { name: "Apply filters" }).click();
  }

  await expect(page).toHaveURL(/category=amigurumi/);
  await expect(page.getByText("1 piece", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: new RegExp(OTHER_PRODUCT_TITLE) }),
  ).toHaveCount(0);

  await page.getByRole("link", { name: new RegExp(PRODUCT_TITLE) }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: PRODUCT_TITLE }),
  ).toBeVisible();
  await expect(page.getByText("৳1,800").first()).toBeVisible();
  await expect(page.getByText("In stock")).toBeVisible();

  await page.getByText("Lavender", { exact: true }).click();

  await expect(page.getByText("Only 5 left")).toBeVisible();

  await expect(
    page.getByRole("button", { name: "Add to cart" }),
  ).toBeDisabled();
  await expect(page.getByText(/Cart is coming soon\./)).toBeVisible();
});

test("sorts the shop by price and keeps the active filters and page", async ({
  page,
}) => {
  await page.goto("/shop?category=wearables&sort=price-asc");

  await expect(page.getByText("1 piece", { exact: true })).toBeVisible();
  await expect(page.locator(`main a[href="${SLUGS.scarf}"]`)).toBeVisible();

  await page.getByRole("combobox", { name: "Sort by" }).click();
  await page.getByRole("option", { name: "Price: high to low" }).click();

  await expect(page).toHaveURL(/sort=price-desc/);
  await expect(page).toHaveURL(/category=wearables/);
  await expect(page).not.toHaveURL(/page=/);

  await expect(page.getByRole("combobox", { name: "Sort by" })).toContainText(
    "Price: high to low",
  );
});

test("orders the shop grid by the chosen price sort", async ({ page }) => {
  await page.goto("/shop?sort=price-asc");

  const cards = page.locator('main a[href^="/shop/"]');

  await expect(cards.first()).toHaveAttribute("href", SLUGS.digital);
  await expect(cards.last()).toHaveAttribute("href", SLUGS.blanket);

  await page.goto("/shop?sort=price-desc");

  await expect(cards.first()).toHaveAttribute("href", SLUGS.blanket);
  await expect(cards.last()).toHaveAttribute("href", SLUGS.digital);
});

test("clamps a page past the last one back to the first page", async ({
  page,
}) => {
  await page.goto("/shop?page=42");

  await expect(page).toHaveURL(/\/shop$/);
  await expect(page.getByText("5 pieces")).toBeVisible();
});

test("filters by product type, swaps an inverted price range, and shows the empty state", async ({
  page,
}) => {
  await page.goto("/shop?type=DIGITAL");

  await expect(page.getByText("1 piece", { exact: true })).toBeVisible();
  await expect(page.locator(`main a[href="${SLUGS.digital}"]`)).toBeVisible();

  await page.goto("/shop?type=DIGITAL&type=CUSTOM");

  await expect(page.getByText("2 pieces")).toBeVisible();

  await page.goto("/shop?minPrice=3000&maxPrice=2000");

  await expect(page.getByText("1 piece", { exact: true })).toBeVisible();
  await expect(page.locator(`main a[href="${SLUGS.scarf}"]`)).toBeVisible();

  await page.goto("/shop?category=amigurumi&type=DIGITAL");

  await expect(
    page.getByRole("heading", { name: "No pieces match these filters" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Clear all filters" }),
  ).toHaveAttribute("href", "/shop");
});

test("drops invalid filter values instead of sending them", async ({
  page,
}) => {
  await page.goto("/shop?category=not-a-collection&sort=bogus&page=abc");

  await expect(page.getByText("5 pieces")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Sort by" })).toContainText(
    "Newest",
  );
});

test("lists the collections with subtree counts and opens a parent collection", async ({
  page,
}) => {
  await page.goto("/collections");

  await expect(
    page.getByRole("heading", { level: 1, name: "Collections" }),
  ).toBeVisible();

  const amigurumiCard = page.locator('a[href="/collections/amigurumi"]');
  const wearablesCard = page.locator('a[href="/collections/wearables"]');

  await expect(amigurumiCard).toContainText("1 piece");
  await expect(wearablesCard).toContainText("1 piece");
  await expect(page.locator('a[href="/collections/scarves"]')).toHaveCount(0);

  await wearablesCard.click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Wearables" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Inside this collection" }),
  ).toBeVisible();
  await expect(page.locator('a[href="/collections/scarves"]')).toBeVisible();
  await expect(page.locator(`main a[href="${SLUGS.scarf}"]`)).toBeVisible();

  // The parent collection includes its child subtree, so its one product and
  // the child card both report one piece. Scope the count to the result
  // region so the child card's own count does not collide with it.
  await expect(
    page.locator('p[aria-live="polite"]', { hasText: "1 piece" }),
  ).toBeVisible();
  await expect(page.locator('main a[href^="/shop/"]')).toHaveCount(1);
});

test("opens a collection landing page with breadcrumbs", async ({ page }) => {
  await page.goto("/collections/amigurumi");

  await expect(
    page.getByRole("heading", { level: 1, name: "Amigurumi" }),
  ).toBeVisible();

  const breadcrumbs = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(
    breadcrumbs.getByRole("link", { name: "Collections" }),
  ).toHaveAttribute("href", "/collections");
  await expect(breadcrumbs).toContainText("Amigurumi");
  await expect(page.locator(`main a[href="${SLUGS.bear}"]`)).toBeVisible();
});

test("normalizes collection URLs with unsupported filters", async ({
  page,
}) => {
  await page.goto("/collections/amigurumi?type=STANDARD&minPrice=100");

  await expect(page).toHaveURL(/\/collections\/amigurumi$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Amigurumi" }),
  ).toBeVisible();
});

test("switches every price to the currency in the cookie", async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await context.addCookies([
    { name: "cp_currency", value: "USD", url: baseURL ?? "" },
  ]);

  await page.goto("/shop");

  await expect(page.getByText("$22.00").first()).toBeVisible();
  await expect(page.getByText("৳1,800")).toHaveCount(0);

  if (!isMobile) {
    await expect(page.getByText("Prices in USD").first()).toBeVisible();
  }

  await page.goto(SLUGS.bear);
  await expect(page.getByText("$22.00").first()).toBeVisible();

  await context.clearCookies();
  await context.addCookies([
    { name: "cp_currency", value: "EUR", url: baseURL ?? "" },
  ]);

  await page.goto("/shop");
  await expect(page.getByText("৳1,800").first()).toBeVisible();
});

test("shows the styled not found page for a missing product", async ({
  page,
}) => {
  await page.goto("/shop/this-piece-does-not-exist");

  await expect(
    page.getByRole("heading", { name: "This piece could not be found" }),
  ).toBeVisible();
  await expect(page.getByText("404")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to shop" }),
  ).toHaveAttribute("href", "/shop");
});

test("shows the styled not found page for a missing collection", async ({
  page,
}) => {
  await page.goto("/collections/this-collection-does-not-exist");

  await expect(
    page.getByRole("heading", { name: "This piece could not be found" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to shop" }),
  ).toHaveAttribute("href", "/shop");
});

test("shows no variant selector and the type specific stock copy", async ({
  page,
}) => {
  await page.goto(SLUGS.digital);

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: new RegExp(DIGITAL_TITLE),
    }),
  ).toBeVisible();
  await expect(page.getByText("Available now")).toBeVisible();
  await expect(page.getByText("Ready to ship")).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);

  await page.goto(SLUGS.blanket);

  await expect(
    page.getByRole("heading", { level: 1, name: CUSTOM_TITLE }),
  ).toBeVisible();
  await expect(page.getByText("Made to order")).toBeVisible();
  await expect(page.getByText("Handcrafted in 28 days")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add to cart" }),
  ).toBeDisabled();
});
