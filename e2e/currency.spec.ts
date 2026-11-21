/**
 * End to end flows for the storefront currency switcher (spec 0007).
 *
 * Drives the real browser against the real web app and API on both the desktop
 * and mobile Playwright projects. Covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-8,
 * and AC-9, including WCAG 2.1 AA checks with `@axe-core/playwright`.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const BEAR_SLUG = "/shop/sunflower-amigurumi-bear";

const ADMIN = {
  email: "admin@crochetpeakz.com",
  password: "admin-dev-password",
};

const CUSTOMER = {
  email: "nadia@example.com",
  password: "customer-dev-password",
};

interface SentinelGlobal {
  cpNoReloadSentinel?: boolean;
}

/** Gives each auth-using context its own client bucket to avoid rate limits. */
function randomClientIp(): string {
  const octet = (): number => Math.floor(Math.random() * 254) + 1;
  return `10.${String(octet())}.${String(octet())}.${String(octet())}`;
}

function authForm(page: Page): Locator {
  return page.locator("form");
}

function authField(page: Page, name: string): Locator {
  return authForm(page).getByRole("textbox", { name, exact: true });
}

/** Signs in through the real form and waits for the post-login redirect. */
async function signIn(
  page: Page,
  account: { email: string; password: string },
  next?: string,
): Promise<void> {
  await page.context().setExtraHTTPHeaders({
    "x-forwarded-for": randomClientIp(),
  });
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await authField(page, "Email").fill(account.email);
  await authField(page, "Password").fill(account.password);
  await authForm(page).getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

/** Runs axe WCAG 2.1 AA checks on the current browser state. */
async function assertNoAxeViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations, `Axe violations (${label})`).toEqual([]);
}

/** Confirms neither the desktop trigger nor the mobile drawer Currency group renders. */
async function assertNoCurrencyControl(
  page: Page,
  isMobile: boolean,
): Promise<void> {
  await expect(page.getByRole("button", { name: /^Currency:/ })).toHaveCount(0);
  if (isMobile) {
    await page.getByRole("button", { name: "Open menu" }).click();
    const drawer = page.getByRole("dialog", { name: "Mobile navigation" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("group", { name: "Currency" })).toHaveCount(
      0,
    );
    await drawer.getByRole("button", { name: "Close menu" }).click();
    await expect(drawer).toBeHidden();
  }
}

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

test("switches prices across shop and product detail without reload, updates JSON-LD, and hides on auth and admin (AC-1, AC-2, AC-8, AC-9)", async ({
  page,
  context,
  isMobile,
}) => {
  await page.goto("/shop");

  await expect(page.getByText("৳1,800").first()).toBeVisible();
  await expect(page.getByText(/coming soon/i)).toHaveCount(0);

  if (isMobile) {
    await page.getByRole("button", { name: "Open menu" }).click();
    const drawer = page.getByRole("dialog", { name: "Mobile navigation" });
    await expect(drawer).toBeVisible();
    const bdtRow = drawer
      .locator("label")
      .filter({ hasText: "৳ BDT, Bangladeshi taka" });
    const usdRow = drawer
      .locator("label")
      .filter({ hasText: "$ USD, US dollars" });
    await expect
      .poll(async () => (await bdtRow.boundingBox())?.height ?? 0)
      .toBeGreaterThanOrEqual(44);
    await expect
      .poll(async () => (await usdRow.boundingBox())?.height ?? 0)
      .toBeGreaterThanOrEqual(44);
  } else {
    const trigger = page.getByRole("button", { name: "Currency: ৳ BDT" });
    await trigger.click();
    const bdtOption = page.getByRole("menuitemradio", {
      name: "৳ BDT, Bangladeshi taka",
    });
    const usdOption = page.getByRole("menuitemradio", {
      name: "$ USD, US dollars",
    });
    await expect(bdtOption).toHaveAttribute("aria-checked", "true");
    await expect(usdOption).toHaveAttribute("aria-checked", "false");
    await expect
      .poll(async () => (await bdtOption.boundingBox())?.height ?? 0)
      .toBeGreaterThanOrEqual(44);
    await expect
      .poll(async () => (await usdOption.boundingBox())?.height ?? 0)
      .toBeGreaterThanOrEqual(44);
    await page.keyboard.press("Escape");
  }

  await page.evaluate(() => {
    (globalThis as SentinelGlobal).cpNoReloadSentinel = true;
  });

  await switchCurrencyInUi(page, isMobile, "USD");

  await expect(page.getByText("$22.00").first()).toBeVisible();
  await expect(page.getByText("৳1,800")).toHaveCount(0);

  const stayedSameDocument = await page.evaluate(
    () => (globalThis as SentinelGlobal).cpNoReloadSentinel === true,
  );
  expect(stayedSameDocument).toBe(true);

  if (isMobile) {
    const dialog = page.getByRole("dialog", { name: "Mobile navigation" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("status")).toHaveText(
      "Prices now shown in US dollars",
    );
    await dialog.getByRole("button", { name: "Close menu" }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Filters" }).click();
    const filterDialog = page.getByRole("dialog", { name: "Filters" });
    await expect(
      filterDialog.getByText("Prices in USD. Up to two decimals."),
    ).toBeVisible();
    await filterDialog.getByRole("button", { name: "Close filters" }).click();
  } else {
    const trigger = page.getByRole("button", { name: "Currency: $ USD" });
    await expect(trigger).toBeVisible();
    await expect(trigger).toBeFocused();
    const box = await trigger.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expect(
      page.getByText("Prices in USD. Up to two decimals."),
    ).toBeVisible();
  }

  const cookies = await context.cookies();
  const currencyCookie = cookies.find(
    (cookie) => cookie.name === "cp_currency",
  );
  expect(currencyCookie?.value).toBe("USD");
  expect(currencyCookie?.path).toBe("/");
  expect(currencyCookie?.httpOnly).toBe(true);
  expect(currencyCookie?.sameSite).toBe("Lax");
  const nowSeconds = Math.floor(Date.now() / 1000);
  expect((currencyCookie?.expires ?? 0) - nowSeconds).toBeGreaterThan(
    31_500_000,
  );

  await page.goto(BEAR_SLUG);
  await expect(page.getByText("$22.00").first()).toBeVisible();
  await expect(page.getByText("In stock")).toBeVisible();

  await page.getByText("Lavender", { exact: true }).click();
  await expect(page.getByText("Only 5 left")).toBeVisible();
  await expect(page.getByText("$22.00").first()).toBeVisible();

  const jsonLdUsd = await page
    .locator('script[type="application/ld+json"]')
    .textContent();
  expect(jsonLdUsd).toContain('"priceCurrency":"USD"');

  await switchCurrencyInUi(page, isMobile, "BDT");
  await expect(page.getByText("৳1,800").first()).toBeVisible();
  if (isMobile) {
    const dialog = page.getByRole("dialog", { name: "Mobile navigation" });
    if (await dialog.isVisible()) {
      await dialog.getByRole("button", { name: "Close menu" }).click();
    }
  }
  await expect
    .poll(async () =>
      page.locator('script[type="application/ld+json"]').textContent(),
    )
    .toContain('"priceCurrency":"BDT"');

  await page.goto("/login");
  await assertNoCurrencyControl(page, isMobile);

  await page.goto("/register");
  await assertNoCurrencyControl(page, isMobile);

  await signIn(page, ADMIN, "/admin");
  await expect(page).toHaveURL(/\/admin/, { timeout: 20_000 });
  await expect(
    page.getByRole("heading", { name: "Store dashboard" }),
  ).toBeVisible({ timeout: 20_000 });
  await assertNoCurrencyControl(page, isMobile);
});

test("persists across browser sessions and sign in/out, and defaults to BDT without extra requests (AC-3, AC-4)", async ({
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

  await signIn(page, CUSTOMER, "/shop");
  await expect(page).toHaveURL(/\/shop/, { timeout: 20_000 });
  await expect(page.getByText("$22.00").first()).toBeVisible();

  await page
    .getByRole("button", { name: /Account menu for Nadia Rahman/ })
    .click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect
    .poll(async () => (await context.cookies()).map((cookie) => cookie.name))
    .not.toContain("cp_refresh");

  await page.goto("/shop");
  await expect(page.getByText("$22.00").first()).toBeVisible();
  const afterSignOutCurrency = (await context.cookies()).find(
    (cookie) => cookie.name === "cp_currency",
  )?.value;
  expect(afterSignOutCurrency).toBe("USD");

  if (baseURL === undefined || baseURL.length === 0) {
    throw new Error("Playwright baseURL must be configured");
  }
  await context.clearCookies();
  await context.addCookies([
    { name: "cp_currency", value: "EUR", url: baseURL },
  ]);
  await page.goto("/shop");
  await expect(page.getByText("৳1,800").first()).toBeVisible();

  const postRequests: string[] = [];
  const onRequest = (request: {
    method: () => string;
    url: () => string;
  }): void => {
    if (request.method() === "POST") {
      postRequests.push(request.url());
    }
  };
  page.on("request", onRequest);

  try {
    await switchCurrencyInUi(page, isMobile, "BDT");
    if (!isMobile) {
      await expect(page.getByRole("menu")).toBeHidden();
    }
    expect(postRequests).toEqual([]);
  } finally {
    page.off("request", onRequest);
  }
});

test("resets minPrice and maxPrice on /shop with replace navigation and leaves other URLs unchanged (AC-5)", async ({
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
    const filterDialog = page.getByRole("dialog", { name: "Filters" });
    await expect(filterDialog.getByLabel("Minimum")).toHaveValue("");
    await expect(filterDialog.getByLabel("Maximum")).toHaveValue("");
    await expect(
      filterDialog.getByText("Prices in USD. Up to two decimals."),
    ).toBeVisible();
    await filterDialog.getByRole("button", { name: "Close filters" }).click();
  } else {
    await expect(page.getByLabel("Minimum")).toHaveValue("");
    await expect(page.getByLabel("Maximum")).toHaveValue("");
    await expect(
      page.getByText("Prices in USD. Up to two decimals."),
    ).toBeVisible();
  }

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/shop?category=amigurumi&sort=price-asc");
  await switchCurrencyInUi(page, isMobile, "BDT");
  await expect(page.getByText("৳1,800").first()).toBeVisible();
  await expect(page).toHaveURL(/\/shop\?category=amigurumi&sort=price-asc$/);

  if (isMobile) {
    const navDialog = page.getByRole("dialog", { name: "Mobile navigation" });
    if (await navDialog.isVisible()) {
      await navDialog.getByRole("button", { name: "Close menu" }).click();
    }
  }

  await page.goto("/collections");
  await switchCurrencyInUi(page, isMobile, "USD");
  await expect(page).toHaveURL(/\/collections$/);
  const cookies = await page.context().cookies();
  expect(cookies.find((cookie) => cookie.name === "cp_currency")?.value).toBe(
    "USD",
  );
});

test("supports full keyboard switching, announces changes, restores focus, and passes WCAG 2.1 AA axe checks (AC-8)", async ({
  page,
  isMobile,
}) => {
  await page.goto("/shop");

  if (isMobile) {
    await assertNoAxeViolations(page, "shop mobile closed");

    await page.getByRole("button", { name: "Open menu" }).click();
    const drawer = page.getByRole("dialog", { name: "Mobile navigation" });
    await expect(drawer).toBeVisible();
    await assertNoAxeViolations(page, "shop mobile drawer open");

    const bdtRadio = drawer.getByRole("radio", {
      name: "৳ BDT, Bangladeshi taka",
    });
    const usdRadio = drawer.getByRole("radio", {
      name: "$ USD, US dollars",
    });

    await bdtRadio.focus();
    await page.keyboard.press("ArrowDown");

    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("status")).toHaveText(
      "Prices now shown in US dollars",
    );
    await expect(usdRadio).toBeChecked();
    await expect(usdRadio).toBeEnabled();
    await expect(usdRadio).toBeFocused();
    await expect(page.getByText("$22.00").first()).toBeVisible();

    await assertNoAxeViolations(page, "shop mobile drawer after switch to USD");
    return;
  }

  await assertNoAxeViolations(page, "shop desktop closed");

  const initialTrigger = page.getByRole("button", { name: "Currency: ৳ BDT" });
  await initialTrigger.focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("menu")).toBeVisible();
  await assertNoAxeViolations(page, "shop desktop currency dropdown open");

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  const usdTrigger = page.getByRole("button", { name: "Currency: $ USD" });
  await expect(page.getByText("$22.00").first()).toBeVisible();
  await expect(usdTrigger).toBeEnabled();
  await expect(usdTrigger).toBeFocused();
  await expect(
    page.locator('[role="status"][aria-live="polite"][aria-atomic="true"]'),
  ).toHaveText("Prices now shown in US dollars");

  await assertNoAxeViolations(page, "shop desktop after switch to USD");

  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");

  const bdtTrigger = page.getByRole("button", { name: "Currency: ৳ BDT" });
  await expect(page.getByText("৳1,800").first()).toBeVisible();
  await expect(bdtTrigger).toBeEnabled();
  await expect(bdtTrigger).toBeFocused();
  await expect(
    page.locator('[role="status"][aria-live="polite"][aria-atomic="true"]'),
  ).toHaveText("Prices now shown in Bangladeshi taka");
});
