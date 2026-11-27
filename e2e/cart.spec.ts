/**
 * End to end flow for the hybrid shopping cart (Spec 0008).
 *
 * Drives the real browser against the real Next.js web app, Express API, and
 * PostgreSQL database:
 * - Visitor adds a variant, reloads, verifies localStorage persistence without
 *   prices, switches currency with zero extra quote calls, and sees disabled
 *   product type notes.
 * - Visitor signs in as a fresh verified customer, merges the browser cart
 *   into the account cart, updates quantity on `/cart`, clears via confirm
 *   dialog, verifies sign out drops account items while keeping server cart.
 * - Audits WCAG 2.1 AA with axe-core on `/cart` and on a storefront page with
 *   the cart drawer open in both light and dark themes.
 */
import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";
import { AuthDatabase } from "./support/auth-database";

const BEAR_SLUG = "/shop/sunflower-amigurumi-bear";
const DIGITAL_SLUG = "/shop/beginner-crochet-pattern-bundle-digital";

interface BrowserStorageGlobal {
  localStorage: {
    getItem(key: string): string | null;
  };
}

function readGuestCartRaw(page: Page): Promise<string | null> {
  return page.evaluate(() =>
    (globalThis as unknown as BrowserStorageGlobal).localStorage.getItem(
      "cp_cart",
    ),
  );
}

/** Switches to dark mode through the real ThemeToggle (which uses next-themes disableTransitionOnChange). */
async function switchToDarkTheme(page: Page, isMobile: boolean): Promise<void> {
  if (isMobile) {
    await page.getByRole("button", { name: "Open menu" }).click();
    const navDrawer = page.getByRole("dialog", { name: "Mobile navigation" });
    await expect(navDrawer).toBeVisible();
    await navDrawer
      .getByRole("button", { name: "Switch to dark mode" })
      .click();
    await navDrawer.getByRole("button", { name: "Close menu" }).click();
    await expect(navDrawer).toBeHidden();
    return;
  }

  await page.getByRole("button", { name: "Switch to dark mode" }).click();
}

function randomClientIp(): string {
  const octet = (): number => Math.floor(Math.random() * 254) + 1;
  return `10.${String(octet())}.${String(octet())}.${String(octet())}`;
}

const test = base.extend<{ clientIp: string; authDb: AuthDatabase }>({
  clientIp: [
    async ({ context }, use) => {
      const ip = randomClientIp();
      await context.setExtraHTTPHeaders({ "x-forwarded-for": ip });
      await use(ip);
    },
    { auto: true },
  ],
  authDb: async ({ browserName: _browserName }, use) => {
    const authDb = await AuthDatabase.open();
    await use(authDb);
    await authDb.close();
  },
});

async function signIn(
  page: Page,
  account: { email: string; password: string },
  next?: string,
): Promise<void> {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  const form = page.locator("form");
  await form
    .getByRole("textbox", { name: "Email", exact: true })
    .fill(account.email);
  await form
    .getByRole("textbox", { name: "Password", exact: true })
    .fill(account.password);
  await form.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

test.describe("shopping cart end to end", () => {
  test("visitor adds, reloads, switches currency, signs in to merge, updates, clears, and signs out (AC-1..AC-15)", async ({
    page,
    authDb,
    isMobile,
  }) => {
    const account = await authDb.createUser({ verified: true });

    // 1. Visitor checks non-cartable DIGITAL product note (AC-2).
    await page.goto(DIGITAL_SLUG);
    await expect(
      page.getByRole("button", { name: "Add to cart" }),
    ).toBeDisabled();
    await expect(
      page.getByText("Digital patterns are coming to the cart soon."),
    ).toBeVisible();

    // 2. Visitor adds a STANDARD in-stock product (AC-1, AC-3, AC-4).
    await page.goto(BEAR_SLUG);
    const addButton = page.getByRole("button", { name: "Add to cart" });
    await expect(addButton).toBeEnabled();
    await addButton.click();

    const drawer = page.getByRole("dialog", { name: "Shopping cart" });
    await expect(drawer).toBeVisible();
    await expect(
      drawer.getByRole("link", { name: "Sunflower Amigurumi Bear" }),
    ).toBeVisible();
    await expect(drawer.getByText("৳1,800").first()).toBeVisible();

    // Close drawer via Escape and verify header badge persists across reload (AC-3, AC-9).
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Shopping cart, 1 item" }),
    ).toBeVisible();

    const storedBeforeSignIn = await readGuestCartRaw(page);
    expect(storedBeforeSignIn).not.toBeNull();
    expect(storedBeforeSignIn).not.toContain("1800");
    expect(storedBeforeSignIn).not.toContain("BDT");
    const guestIdBeforeSignIn = (
      JSON.parse(storedBeforeSignIn ?? "{}") as {
        state?: { guestCartId?: string };
      }
    ).state?.guestCartId;

    await page.reload();
    await expect(
      page.getByRole("button", { name: "Shopping cart, 1 item" }),
    ).toBeVisible();

    // 3. Switch currency to USD and verify cart updates with no quote refetch (AC-8).
    let quoteRequestsAfterSwitch = 0;
    page.on("request", (req) => {
      if (req.url().includes("/api/cart/quote")) {
        quoteRequestsAfterSwitch += 1;
      }
    });

    await page.getByRole("button", { name: "Shopping cart, 1 item" }).click();
    await expect(drawer).toBeVisible();
    const quotesBeforeCurrencySwitch = quoteRequestsAfterSwitch;
    await page.keyboard.press("Escape");

    if (isMobile) {
      await page.getByRole("button", { name: "Open menu" }).click();
      await page
        .getByRole("dialog", { name: "Mobile navigation" })
        .getByRole("radio", { name: /USD/ })
        .click();
      await page.keyboard.press("Escape");
    } else {
      await page.getByRole("button", { name: "Currency: ৳ BDT" }).click();
      await page.getByRole("menuitemradio", { name: /USD/ }).click();
    }

    await expect(page.getByText("$22.00").first()).toBeVisible();
    expect(quoteRequestsAfterSwitch).toBe(quotesBeforeCurrencySwitch);

    // 4. Sign in page hides cart button (AC-3) and merges browser cart into account cart (AC-11).
    await page.goto("/login");
    await expect(
      page.getByRole("button", { name: /Shopping cart/ }),
    ).toHaveCount(0);

    await signIn(page, account, "/cart");
    await expect(page).toHaveURL(/\/cart/);

    // Verify /cart page heading, noindex response, and merged item.
    const cartResponse = await page.goto("/cart");
    expect(cartResponse?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    await expect(
      page.getByRole("heading", { level: 1, name: "Your cart" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Sunflower Amigurumi Bear" }),
    ).toBeVisible();

    // Browser cart cleared and guestCartId rotated after merge succeeded (AC-11).
    const storedAfterMerge = await readGuestCartRaw(page);
    const parsedAfterMerge = JSON.parse(storedAfterMerge ?? "{}") as {
      state?: { guestCartId?: string; lines?: unknown[] };
    };
    expect(parsedAfterMerge.state?.lines ?? []).toHaveLength(0);
    expect(parsedAfterMerge.state?.guestCartId).not.toBe(guestIdBeforeSignIn);

    // 5. Increase quantity to 2 on /cart, then sign out and verify cart empties on device while surviving on server (AC-10, AC-12).
    await page
      .getByRole("button", {
        name: "Increase quantity of Sunflower Amigurumi Bear",
      })
      .click();
    await expect(
      page.getByRole("button", { name: "Shopping cart, 2 items" }),
    ).toBeVisible();

    await page.getByRole("button", { name: /Account menu for/ }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(
      page.getByRole("button", { name: "Shopping cart, empty" }),
    ).toBeVisible({ timeout: 15_000 });

    // Sign back in -> server cart still holds the 2 bears!
    await signIn(page, account, "/cart");
    await expect(
      page.getByRole("button", { name: "Shopping cart, 2 items" }),
    ).toBeVisible({ timeout: 15_000 });

    // 6. Clear cart through confirm dialog (AC-15).
    await page.getByRole("button", { name: "Clear cart" }).click();
    const confirmDialog = page.getByRole("dialog", {
      name: "Remove all items from your cart?",
    });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "Clear cart" }).click();

    await expect(page.getByText("Your cart is empty")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Shopping cart, empty" }),
    ).toBeVisible();
  });

  test("passes WCAG 2.1 AA axe checks on /cart and open drawer in light and dark themes (AC-17, AC-18)", async ({
    page,
    isMobile,
  }) => {
    await page.goto(BEAR_SLUG);
    await page.getByRole("button", { name: "Add to cart" }).click();

    const drawer = page.getByRole("dialog", { name: "Shopping cart" });
    await expect(drawer).toBeVisible();

    // Light theme: open drawer
    const drawerLight = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(drawerLight.violations).toEqual([]);

    // Navigate to /cart (drawer closes automatically)
    await drawer.getByRole("link", { name: "View cart" }).click();
    await expect(page).toHaveURL(/\/cart/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Your cart" }),
    ).toBeVisible();
    await expect(drawer).toBeHidden();

    // Light theme: /cart page
    const pageLight = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(pageLight.violations).toEqual([]);

    // Switch to dark theme via the real ThemeToggle control
    await switchToDarkTheme(page, isMobile);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // Dark theme: /cart page
    const pageDark = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(pageDark.violations).toEqual([]);

    // Dark theme: open drawer
    await page.getByRole("button", { name: "Shopping cart, 1 item" }).click();
    await expect(drawer).toBeVisible();
    const drawerDark = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(drawerDark.violations).toEqual([]);
  });
});
