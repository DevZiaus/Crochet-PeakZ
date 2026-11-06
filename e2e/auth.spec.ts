/**
 * End to end flows for customer auth.
 *
 * These drive a real browser against the real web app and the real API. Every
 * call goes through the Next.js proxy, so the shared secret guard, the cookie
 * handling, and the refresh path are all exercised the way a customer exercises
 * them. The accounts come from the Prisma seed.
 *
 * Covers AC-1 through AC-5, AC-7 through AC-13 through a real browser. The API
 * tests still own the exact headers, database rows, and token rotation rules;
 * these flows prove the screens and the web proxy present those rules the way a
 * customer meets them.
 */
import {
  test as base,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";
import { AuthDatabase, createOpaqueToken } from "./support/auth-database";

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

export const test = base.extend<{ clientIp: string; authDb: AuthDatabase }>({
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

  test("asks an unverified customer to confirm and offers a resend (AC-2, AC-3)", async ({
    page,
    context,
    authDb,
  }) => {
    const account = await authDb.createUser({ verified: false });

    await page.goto("/login");
    await field(page, "Email").fill(account.email);
    await field(page, "Password").fill(account.password);
    await form(page).getByRole("button", { name: "Sign in" }).click();

    await expect(
      page.getByText("Your email is not verified yet."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Resend verification email" }),
    ).toBeVisible();

    // AC-2: the refusal issues no session and does not count as a failed
    // password attempt.
    const cookieNames = (await context.cookies()).map((cookie) => cookie.name);
    expect(cookieNames).not.toContain("cp_access");
    expect(cookieNames).not.toContain("cp_refresh");
    const row = await authDb.getUser(account.id);
    expect(row.failedLoginAttempts).toBe(0);

    await page
      .getByRole("button", { name: "Resend verification email" })
      .click();
    await expect(
      page.getByText(/A new verification link is on its way/),
    ).toBeVisible();
  });
});

test.describe("verification screen", () => {
  test("does not consume the link on opening and confirms it only once (AC-3)", async ({
    page,
    authDb,
  }) => {
    const account = await authDb.createUser({ verified: false });
    const token = createOpaqueToken();
    await authDb.issueEmailVerification(account.id, token);
    const url = `/verify-email?token=${encodeURIComponent(token)}`;

    await page.goto(url);
    await expect(
      page.getByRole("heading", { name: "Confirm your email" }),
    ).toBeVisible();

    // AC-3: a GET renders the page and leaves the account and token untouched.
    const before = await authDb.getUser(account.id);
    expect(before.emailVerified).toBe(false);
    expect(before.emailVerificationToken).not.toBeNull();

    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Confirm your email" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Confirm my email" }).click();
    await expect(
      page.getByRole("heading", { name: "Email confirmed" }),
    ).toBeVisible();
    await expect(
      page
        .locator("main")
        .getByRole("link", { name: "Sign in to your account" }),
    ).toBeVisible();

    const after = await authDb.getUser(account.id);
    expect(after.emailVerified).toBe(true);
    expect(after.emailVerificationToken).toBeNull();

    // The token is cleared on use, so the same link renders the confirm screen
    // again, then rejects the second explicit confirmation.
    await page.goto(url);
    await page.getByRole("button", { name: "Confirm my email" }).click();
    await expect(
      page.getByRole("heading", { name: "This link is no longer valid" }),
    ).toBeVisible();
  });

  test("prefills an expired link and throttles the resend (AC-3, AC-12)", async ({
    page,
    authDb,
  }) => {
    const account = await authDb.createUser({ verified: false });
    const token = createOpaqueToken();
    await authDb.issueEmailVerification(account.id, token, {
      expiresAt: new Date(Date.now() - 60_000),
      sentAt: new Date(Date.now() - 120_000),
    });

    await page.goto(`/verify-email?token=${encodeURIComponent(token)}`);
    await page.getByRole("button", { name: "Confirm my email" }).click();

    await expect(
      page.getByRole("heading", { name: "This link has expired" }),
    ).toBeVisible();
    await expect(field(page, "Email")).toHaveValue(account.email);

    await page.getByRole("button", { name: "Send a new link" }).click();
    await expect(
      page.getByText(/A new verification link is on its way/),
    ).toBeVisible();

    // The first resend moves the per account timestamp to now, so an immediate
    // second request is refused with the wait message.
    await page.getByRole("button", { name: "Send a new link" }).click();
    await expect(page.getByText(/Please wait \d+ seconds/)).toBeVisible();
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

  test("ignores an external next and uses the role default (AC-11)", async ({
    page,
  }) => {
    await signIn(page, CUSTOMER, "https://evil.example");

    await expect(page).toHaveURL("http://localhost:3000/", {
      timeout: 20_000,
    });
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

test.describe("sign in throttling", () => {
  test("shows a wait message after ten failed attempts from one address (AC-12)", async ({
    page,
  }) => {
    const email = `rate-${String(Date.now())}@example.com`;
    await page.goto("/login");

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await field(page, "Email").fill(email);
      await field(page, "Password").fill("definitely-the-wrong-password");
      const response = page.waitForResponse(
        (candidate) =>
          candidate.url().endsWith("/api/auth/login") &&
          candidate.request().method() === "POST",
      );
      await form(page).getByRole("button", { name: "Sign in" }).click();
      expect((await response).status()).toBe(401);
    }

    await field(page, "Email").fill(email);
    await field(page, "Password").fill("definitely-the-wrong-password");
    const limited = page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith("/api/auth/login") &&
        candidate.request().method() === "POST",
    );
    await form(page).getByRole("button", { name: "Sign in" }).click();

    expect((await limited).status()).toBe(429);
    await expect(page.getByText(/Too many sign in attempts/)).toBeVisible();
  });
});

test.describe("password reset", () => {
  test("resets the password once and revokes the open session (AC-9)", async ({
    page,
    context,
    authDb,
  }) => {
    const account = await authDb.createUser();
    const token = createOpaqueToken();
    await authDb.issuePasswordReset(account.id, token);
    const newPassword = "a brand new horse battery";
    const url = `/reset-password?token=${encodeURIComponent(token)}`;

    await signIn(page, account);
    await page.goto(url);
    await expect(
      page.getByRole("heading", { name: "Choose a new password" }),
    ).toBeVisible();

    const password = form(page).locator('input[name="password"]');
    const confirm = form(page).locator('input[name="confirmPassword"]');

    await password.fill(newPassword);
    await confirm.fill("a different password");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(
      page.getByText("The two passwords do not match."),
    ).toBeVisible();

    await password.fill(newPassword);
    await confirm.fill(newPassword);
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(
      page.getByRole("heading", { name: "Password updated" }),
    ).toBeVisible();
    await expect(
      page
        .locator("main")
        .getByRole("link", { name: "Sign in to your account" }),
    ).toBeVisible();

    // A completed reset revokes every session row, including this browser.
    const refresh = await context.request.post("/api/auth/refresh", {
      headers: { origin: "http://localhost:3000" },
    });
    expect(refresh.status()).toBe(401);

    // The same link cannot be used again.
    await page.goto(url);
    await password.fill(newPassword);
    await confirm.fill(newPassword);
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(
      page.getByRole("heading", { name: "This reset link is no longer valid" }),
    ).toBeVisible();

    // The old password no longer works and the new one does.
    await context.clearCookies();
    await page.goto("/login");
    await field(page, "Email").fill(account.email);
    await field(page, "Password").fill(account.password);
    await form(page).getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();

    await field(page, "Password").fill(newPassword);
    await form(page).getByRole("button", { name: "Sign in" }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
  });

  test("asks for a reset without revealing whether the account exists (AC-9)", async ({
    page,
  }) => {
    const email = `missing-${String(Date.now())}@example.com`;

    await page.goto("/forgot-password?next=%2Fshop");
    await field(page, "Email").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(
      page.getByRole("heading", { name: "Check your email" }),
    ).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Back to sign in" }),
    ).toHaveAttribute("href", "/login?next=%2Fshop");
  });
});

test.describe("OAuth result screen", () => {
  test("shows a readable provider failure and safe retry links (AC-8, AC-11)", async ({
    page,
  }) => {
    await page.goto(
      "/auth/callback?provider=google&error=access_denied&next=%2Fshop",
    );

    await expect(
      page.getByRole("heading", { name: "Could not sign in with Google" }),
    ).toBeVisible();
    await expect(page.getByText(/You cancelled the sign in/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/api/auth/google?next=%2Fshop",
    );
    await expect(
      page.getByRole("link", { name: "Sign in with email" }),
    ).toHaveAttribute("href", "/login?next=%2Fshop");

    // An external next is replaced with the role default on the error screen.
    await page.goto(
      "/auth/callback?provider=google&error=access_denied&next=https%3A%2F%2Fevil.example",
    );
    await expect(
      page.getByRole("link", { name: "Sign in with email" }),
    ).toHaveAttribute("href", "/login?next=%2F");
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

  test("silently refreshes an expired access cookie on reload (AC-5, AC-10)", async ({
    page,
    context,
  }) => {
    await signIn(page, ADMIN, "/admin");
    await expect(
      page.getByRole("heading", { name: "Store dashboard" }),
    ).toBeVisible({ timeout: 20_000 });

    // An expired access cookie disappears; the long lived refresh cookie stays.
    await context.clearCookies({ name: "cp_access" });
    await page.reload();

    await expect(page).toHaveURL(/\/admin/, { timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: "Store dashboard" }),
    ).toBeVisible({ timeout: 20_000 });

    // The browser received a fresh pair, not only the render.
    await expect
      .poll(async () => (await context.cookies()).map((cookie) => cookie.name))
      .toContain("cp_access");
  });

  test("removes access when the role changes in the database (AC-10)", async ({
    page,
    authDb,
  }) => {
    const account = await authDb.createUser({ role: "ADMIN" });

    await signIn(page, account, "/admin");
    await expect(
      page.getByRole("heading", { name: "Store dashboard" }),
    ).toBeVisible({ timeout: 20_000 });

    await authDb.setRole(account.id, "CUSTOMER");
    await page.reload();

    await expect(page).toHaveURL("http://localhost:3000/", {
      timeout: 20_000,
    });
    const html = await page.content();
    expect(html).not.toContain("Store dashboard");
  });
});
