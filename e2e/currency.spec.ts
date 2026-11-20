/**
 * End to end flows for the storefront currency switcher (spec 0007).
 *
 * Drives the real browser against the real web app and API on both the desktop
 * and mobile Playwright projects. Covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-8,
 * and AC-9.
 */
import { expect, test, type Page } from "@playwright/test";

const BEAR_SLUG = "/shop/sunflower-amigurumi-bear";

/**
 * Switches currency through the header dropdown on desktop or the mobile
 * navigation drawer radio group on mobile.
 */
async function switchCurrencyInUi(
  page: Page,
  isMobile: boolean,
  target: "BDT" | "USD",
): Promise<void> {
  const optionName =
    target === "USD" ? "$ USD, US dollars" : "৳ BDT, Bangladeshi taka";

  if (isMobile) {
    const dialog = page.getByRole("dialog", { name: "Mobile navigation" });
    if (!(await dialog.isVisible())) {
      await page.getByRole("button", { name: "Open menu" }).click();
      await expect(dialog).toBeVisible();
    }
    await dialog.getByRole("radio", { name: optionName }).check();
    return;
  }

  await page.getByRole("button", { name: /^Currency:/ }).click();
  await page.getByRole("menuitemradio", { name: optionName }).click();
}

test("switches prices across shop and product detail, updates JSON-LD, and hides on auth pages (AC-1, AC-2, AC-8, AC-9)", async ({
  page,
  context,
  isMobile,
}) => {
  await page.goto("/shop");

  await expect(page.getByText("৳1,800").first()).toBeVisible();

  await switchCurrencyInUi(page, isMobile, "USD");

  await expect(page.getByText("$22.00").first()).toBeVisible();
  await expect(page.getByText("৳1,800")).toHaveCount(0);

  if (isMobile) {
    const dialog = page.getByRole("dialog", { name: "Mobile navigation" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("status")).toHaveText(
      "Prices now shown in US dollars",
    );
    await dialog.getByRole("button", { name: "Close menu" }).click();
  } else {
    const trigger = page.getByRole("button", { name: "Currency: $ USD" });
    await expect(trigger).toBeVisible();
    await expect(trigger).toBeFocused();
    const box = await trigger.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  const cookies = await context.cookies();
  const currencyCookie = cookies.find(
    (cookie) => cookie.name === "cp_currency",
  );
  expect(currencyCookie?.value).toBe("USD");
  expect(currencyCookie?.httpOnly).toBe(true);
  expect(currencyCookie?.sameSite).toBe("Lax");

  await page.goto(BEAR_SLUG);
  await expect(page.getByText("$22.00").first()).toBeVisible();

  await page.getByText("Large (35 cm)", { exact: true }).click();
  await expect(page.getByText("$28.00").first()).toBeVisible();

  const jsonLdText = await page
    .locator('script[type="application/ld+json"]')
    .textContent();
  expect(jsonLdText).toContain('"priceCurrency":"USD"');

  await page.goto("/login");
  await expect(page.getByRole("button", { name: /^Currency:/ })).toHaveCount(0);
});

test("persists across browser sessions and defaults to BDT on missing or invalid cookie (AC-3, AC-4)", async ({
  page,
  context,
  browser,
  baseURL,
  isMobile,
}) => {
  await page.goto("/");
  await expect(page.getByText("৳1,800").first()).toBeVisible();

  await switchCurrencyInUi(page, isMobile, "USD");
  await expect(page.getByText("$22.00").first()).toBeVisible();

  const storageState = await context.storageState();
  const reopenedContext = await browser.newContext({
    ...(baseURL === undefined ? {} : { baseURL }),
    storageState,
  });
  const reopenedPage = await reopenedContext.newPage();

  try {
    await reopenedPage.goto("/");
    await expect(reopenedPage.getByText("$22.00").first()).toBeVisible();
  } finally {
    await reopenedContext.close();
  }

  await context.clearCookies();
  await context.addCookies([
    { name: "cp_currency", value: "EUR", url: baseURL ?? "" },
  ]);
  await page.goto("/shop");
  await expect(page.getByText("৳1,800").first()).toBeVisible();
});

test("resets minPrice, maxPrice, and page on /shop when switching currency with replace navigation (AC-5)", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  await page.goto(
    "/shop?category=amigurumi&minPrice=500&maxPrice=2500&sort=price-asc",
  );

  await expect(page.getByText("1 piece", { exact: true })).toBeVisible();

  await switchCurrencyInUi(page, isMobile, "USD");

  await expect(page).toHaveURL(/\/shop\?category=amigurumi&sort=price-asc$/);
  await expect(page.getByText("$22.00").first()).toBeVisible();

  if (isMobile) {
    const navDialog = page.getByRole("dialog", { name: "Mobile navigation" });
    if (await navDialog.isVisible()) {
      await navDialog.getByRole("button", { name: "Close menu" }).click();
    }
    await page.getByRole("button", { name: "Filters" }).click();
    const filterDialog = page.getByRole("dialog", { name: "Product filters" });
    await expect(filterDialog.getByLabel("Minimum")).toHaveValue("");
    await expect(filterDialog.getByLabel("Maximum")).toHaveValue("");
    await filterDialog.getByRole("button", { name: "Close filters" }).click();
  } else {
    await expect(page.getByLabel("Minimum")).toHaveValue("");
    await expect(page.getByLabel("Maximum")).toHaveValue("");
  }

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
});
