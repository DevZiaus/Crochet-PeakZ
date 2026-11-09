/**
 * End to end flow for the product catalog storefront.
 *
 * Drives the real browser against the real web app and the real API, using the
 * seeded catalog. It proves the home page, the shop listing with a category
 * filter, and a product detail with variant selection on both the desktop and
 * mobile projects.
 *
 * Covers AC-1, AC-2, AC-3, AC-7, AC-8, and AC-19.
 */
import { expect, test } from "@playwright/test";

const PRODUCT_TITLE = "Sunflower Amigurumi Bear";
const OTHER_PRODUCT_TITLE = "Ocean Wave Infinity Scarf";

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
