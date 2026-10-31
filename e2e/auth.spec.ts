/**
 * End to end flows for customer auth.
 *
 * These drive a real browser against the real web app and the real API. Every
 * call goes through the Next.js proxy, so the shared secret guard, the cookie
 * handling, and the refresh path are all exercised the way a customer exercises
 * them. The accounts come from the Prisma seed.
 *
 * Covers AC-1, AC-4, AC-5, AC-7, AC-10, AC-11 and AC-13. AC-2 (unverified sign
 * in) and AC-12 (throttling) are asserted at the API layer instead; a throttled
 * or unverified sign in is not what these flows are about.
 */
import {
  test as base,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";

/**
 * Gives every test its own forwarded client address.
 *
 * AC-12 throttles sign in at ten requests per fifteen minutes and register at
 * five per hour, per client IP. A suite that shares one address spends its
 * budget partway through and then fails on limits it never meant to test, so
 * every test gets its own bucket. The browser sends `X-Forwarded-For`, the
 * storefront proxy forwards it, and the API buckets on it.
 *
 * The address is drawn at random rather than counted from a fixed base, because
 * the register window is an hour long. A fixed base would hand every run the
 * same addresses, so a second run inside the hour would spend a bucket the
 * first one filled and pass only against a freshly restarted API. The limits
 * themselves are asserted in
 * `apps/api/src/presentation/auth/routes.integration.test.ts`, which passes an
 * address explicitly.
 */
function randomClientIp(): string {
  const octet = (): number => Math.floor(Math.random() * 254) + 1;
  return `10.${String(octet())}.${String(octet())}.${String(octet())}`;
}

export const test = base.extend<{ clientIp: string }>({
  clientIp: [
    async ({ context }, use) => {
      const ip = randomClientIp();
      await context.setExtraHTTPHeaders({ "x-forwarded-for": ip });
      await use(ip);
    },
    { auto: true },
  ],
});

export { expect };

const ADMIN = {
  email: "admin@crochetpeakz.com",
  password: "admin-dev-password",
};
const CUSTOMER = {
  email: "nadia@example.com",
  password: "customer-dev-password",
};

/**
 * Narrows a query to the auth form.
 *
 * The footer carries a `mailto:` link whose accessible name is "Email", so a
 * page wide label query would match it instead of the field. Every field query
 * is scoped to the form for that reason.
 *
 * @param page Current page.
 * @returns A locator scoped to the form on screen.
 */
function form(page: Page): Locator {
  return page.locator("form");
}

/**
 * A form field, by its exact accessible name.
 *
 * Three traps make the obvious queries wrong here. A page wide query also
 * matches the footer's `mailto:` link, whose accessible name is "Email", so
 * every query is scoped to the form. The required marker is rendered inside the
 * `<label>`, so the label's raw text is "Email*" and `getByLabel` with `exact`
 * never matches. And a loose label query for "Password" also matches the "Show
 * password" toggle beside the field. Asking for the role and the exact
 * accessible name is the one query that lands on the input and reads the way a
 * screen reader user hears the field.
 *
 * @param page Current page.
 * @param name Accessible name of the field.
 * @returns A locator for that field.
 */
function field(page: Page, name: string): Locator {
  return form(page).getByRole("textbox", { name, exact: true });
}

/** Signs in through the real form and waits for the session to settle. */
async function signIn(
  page: Page,
  account: { email: string; password: string },
  next?: string,
): Promise<void> {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await field(page, "Email").fill(account.email);
  await field(page, "Password").fill(account.password);
  await form(page).getByRole("button", { name: "Sign in" }).click();

  // The form navigates once the API answers and the cookies are set. Waiting for
  // that here keeps a later `goto` from cancelling the in-flight sign in.
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

test.describe("sign in screen", () => {
  test("shows the form with labelled, reachable inputs (AC-13)", async ({
    page,
  }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
    await expect(field(page, "Email")).toBeVisible();
    await expect(field(page, "Password")).toBeVisible();

    // Keyboard reachable: tab from the email field lands on the password field.
    await field(page, "Email").focus();
    await page.keyboard.press("Tab");
    await expect(field(page, "Password")).toBeFocused();
  });

  test("is marked noindex for crawlers (AC-13)", async ({ page }) => {
    const response = await page.goto("/login");

    expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  });

  test("keeps register, verify and reset screens out of search results (AC-13)", async ({
    page,
  }) => {
    for (const path of [
      "/register",
      "/verify-email",
      "/forgot-password",
      "/reset-password",
      "/auth/callback",
    ]) {
      const response = await page.goto(path);
      expect(response?.headers()["x-robots-tag"], path).toBe(
        "noindex, nofollow",
      );
    }
  });

  test("announces a rejected sign in without leaking which field was wrong (AC-4)", async ({
    page,
  }) => {
    await page.goto("/login");
    await field(page, "Email").fill(CUSTOMER.email);
    await field(page, "Password").fill("definitely-the-wrong-password");
    await form(page).getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("customer session", () => {
  test("signs in, survives a reload, and signs out (AC-4, AC-5, AC-7)", async ({
    page,
    context,
  }) => {
    await signIn(page, CUSTOMER);

    // The home page is still the scaffold with no header, so the account menu is
    // observed on a screen that carries one. The verify screen shares the auth
    // layout and is not behind the guest guard, so a signed in customer can sit
    // on it and see their own account.
    await page.goto("/verify-email");
    const accountMenu = page.getByRole("button", {
      name: /Account menu for Nadia Rahman/,
    });
    await expect(accountMenu).toBeVisible({ timeout: 20_000 });

    // The session survives a full reload, which proves the cookie and /me path.
    await page.reload();
    await expect(accountMenu).toBeVisible({ timeout: 20_000 });

    await accountMenu.click();
    await expect(page.getByText(CUSTOMER.email)).toBeVisible();

    await page.getByRole("menuitem", { name: "Sign out" }).click();

    // Sign out clears the cookies and replaces to the home page, which is still
    // the scaffold and mounts no header. The cookie jar and the admin guard are
    // what actually prove the session is gone; the signed out header is then
    // observed on the verify screen, which does render it.
    await expect
      .poll(async () => (await context.cookies()).map((cookie) => cookie.name))
      .not.toContain("cp_refresh");

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin/, { timeout: 20_000 });

    await page.goto("/verify-email");
    await expect(
      page.getByRole("link", { name: "Sign in to your account" }),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("returns the customer to the page they asked for after signing in (AC-11)", async ({
    page,
  }) => {
    await signIn(page, CUSTOMER, "/shop");

    await expect(page).toHaveURL(/\/shop/, { timeout: 20_000 });
  });

  test("sends a signed in customer away from the sign in form (AC-5)", async ({
    page,
  }) => {
    await signIn(page, CUSTOMER);
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });

    await page.goto("/login");

    // The guard sends a signed in customer to their role default rather than
    // showing the form again.
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
  });
});

test.describe("register screen", () => {
  test("creates an account and asks the customer to check their email (AC-1)", async ({
    page,
  }) => {
    const suffix = Math.floor(Math.random() * 1000);
    const email = `e2e-${String(Date.now())}-${String(suffix)}@example.com`;

    await page.goto("/register");
    await field(page, "Name").fill("E2E Customer");
    await field(page, "Email").fill(email);
    await field(page, "Password").fill("correct horse battery");
    await field(page, "Confirm password").fill("correct horse battery");
    await form(page)
      .getByRole("button", { name: /create account/i })
      .click();

    await expect(
      page.getByRole("heading", { name: /check your email/i }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(email)).toBeVisible();
  });

  test("refuses a second account for the same email (AC-1)", async ({
    page,
  }) => {
    await page.goto("/register");
    await field(page, "Name").fill("Duplicate");
    await field(page, "Email").fill(CUSTOMER.email);
    await field(page, "Password").fill("correct horse battery");
    await field(page, "Confirm password").fill("correct horse battery");
    await form(page)
      .getByRole("button", { name: /create account/i })
      .click();

    await expect(page.getByText(/already exists/i)).toBeVisible({
      timeout: 20_000,
    });
  });

  test("tells the customer when the two passwords differ", async ({ page }) => {
    await page.goto("/register");
    await field(page, "Password").fill("correct horse battery");
    await field(page, "Confirm password").fill("a different password");
    await form(page)
      .getByRole("button", { name: /create account/i })
      .click();

    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
    expect(page.url()).toContain("/register");
  });
});

test.describe("admin area", () => {
  test("sends an anonymous visitor to sign in without rendering admin markup (AC-10)", async ({
    page,
  }) => {
    await page.goto("/admin");

    await expect(page).toHaveURL(/\/login\?next=%2Fadmin/, { timeout: 20_000 });

    const html = await page.content();
    expect(html).not.toContain("Store dashboard");
  });

  test("sends a signed in customer to the storefront (AC-10)", async ({
    page,
  }) => {
    await signIn(page, CUSTOMER);
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });

    await page.goto("/admin");

    await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });
    const html = await page.content();
    expect(html).not.toContain("Store dashboard");
  });

  test("lets an admin open the admin area (AC-10)", async ({ page }) => {
    await signIn(page, ADMIN, "/admin");

    await expect(page).toHaveURL(/\/admin/, { timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: "Store dashboard" }),
    ).toBeVisible({ timeout: 20_000 });
  });
});
