/**
 * End to end flows for the storefront contact form and `/api/contact` proxy.
 *
 * Drives a real browser against the real Next.js web app and Express API on
 * both the desktop and mobile Playwright projects. Covers navigation from the
 * footer and `/data-deletion` (`?topic=data-deletion`), inline validation,
 * submission through the Next.js contact proxy, per-IP rate limiting across
 * spoofed `X-Forwarded-For` chains, and WCAG 2.1 AA checks with
 * `@axe-core/playwright`.
 *
 * The API runs with `CONTACT_EMAIL_TRANSPORT=log` (set in
 * `playwright.config.ts`) so contact submissions execute the full pipeline
 * without calling live Resend.
 */
import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test as base,
  type Locator,
  type Page,
} from "@playwright/test";

/**
 * Minimum wait before submitting so the server's fill time check passes.
 * Mirrors CONTACT_MIN_FILL_TIME_MS in packages/shared plus a margin for the
 * browser round trip. Update both together.
 */
const CONTACT_MIN_WAIT_MS = 3_500;

/**
 * Gives each test its own forwarded IP so rate-limit tests never collide with
 * other runs or tests inside the 15-minute contact window.
 */
function randomClientIp(): string {
  const octet = (): number => Math.floor(Math.random() * 254) + 1;
  return `10.${String(octet())}.${String(octet())}.${String(octet())}`;
}

const test = base.extend<{ clientIp: string }>({
  clientIp: [
    async ({ context }, use) => {
      const ip = randomClientIp();
      await context.setExtraHTTPHeaders({ "x-forwarded-for": ip });
      await use(ip);
    },
    { auto: true },
  ],
});

function form(page: Page): Locator {
  return page.locator("form");
}

function field(page: Page, name: string): Locator {
  return form(page).getByRole("textbox", { name, exact: true });
}

async function assertNoAxeViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations, `Axe violations (${label})`).toEqual([]);
}

test("reaches /contact from footer and data deletion page, preselects topic, submits through the proxy, and passes WCAG 2.1 AA", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Contact" })
    .click();
  await expect(page).toHaveURL(/\/contact$/);
  await expect(
    page.getByRole("heading", { level: 1, name: /Let’s make something/ }),
  ).toBeVisible();
  await expect(form(page).getByRole("combobox", { name: "Topic" })).toHaveText(
    "General inquiry",
  );

  await page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Data Deletion" })
    .click();
  await expect(page).toHaveURL(/\/data-deletion$/);
  await expect(
    page.getByRole("heading", { level: 1, name: /Want your data/ }),
  ).toBeVisible();

  await page
    .locator("main")
    .getByRole("link", { name: "contact form" })
    .click();
  await expect(page).toHaveURL(/\/contact\?topic=data-deletion$/);
  await page.waitForLoadState("load");
  const hydratedAt = Date.now();

  await expect(form(page).getByRole("combobox", { name: "Topic" })).toHaveText(
    "Data deletion",
  );

  await assertNoAxeViolations(page, "contact page initial");

  await field(page, "Name").fill("Nadia Rahman");
  await field(page, "Email").fill("nadia@example.com");
  await field(page, "Message").fill(
    "Please delete my personal account information associated with this email.",
  );

  // Satisfy the 3-second fill-time anti-spam check deterministically.
  const remainingMs = CONTACT_MIN_WAIT_MS - (Date.now() - hydratedAt);
  if (remainingMs > 0) {
    await page.waitForTimeout(remainingMs);
  }

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/contact") &&
      response.request().method() === "POST",
  );
  await form(page).getByRole("button", { name: "Send message" }).click();
  const response = await responsePromise;

  expect(response.status()).toBe(200);
  await expect(
    page.getByText(
      "Thank you for reaching out. Your message is on its way and we will reply soon.",
    ),
  ).toBeVisible();
  await expect(field(page, "Name")).toHaveValue("");
  await expect(field(page, "Email")).toHaveValue("");
  await expect(field(page, "Message")).toHaveValue("");

  await assertNoAxeViolations(page, "contact page after submit");
});

test("validates inline, enforces per-IP 429 across spoofed X-Forwarded-For chains, and isolates another IP", async ({
  page,
  context,
  request,
}) => {
  const ipA = randomClientIp();
  let ipB = randomClientIp();
  while (ipB === ipA) {
    ipB = randomClientIp();
  }

  // Send a spoofed prefix ahead of ipA to prove the proxy/API buckets on ipA.
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": `203.0.113.99, ${ipA}`,
  });

  await page.goto("/contact");
  await page.waitForLoadState("load");
  const hydratedAt = Date.now();
  // Use the origin the browser actually loaded, so a different host or port
  // does not turn the direct API posts below into cross origin requests.
  const webOrigin = new URL(page.url()).origin;

  let networkPosts = 0;
  page.on("request", (req) => {
    if (req.url().endsWith("/api/contact") && req.method() === "POST") {
      networkPosts += 1;
    }
  });

  // Empty submit triggers client-side inline validation without hitting the API.
  await form(page).getByRole("button", { name: "Send message" }).click();
  await expect(form(page).getByText("Please enter your name.")).toBeVisible();
  await expect(
    form(page).getByText("Please enter a valid email address."),
  ).toBeVisible();
  expect(networkPosts).toBe(0);

  // Exhaust all 5 slots for ipA using 5 distinct spoofed leading XFF entries.
  for (let index = 1; index <= 5; index += 1) {
    const res = await request.post("/api/contact", {
      headers: {
        "content-type": "application/json",
        origin: webOrigin,
        "x-forwarded-for": `198.51.100.${String(index)}, ${ipA}`,
      },
      data: {
        name: "Nadia Rahman",
        email: "nadia@example.com",
        topic: "general",
        message: `Rate limit check message number ${String(index)}.`,
        website: "",
        elapsedMs: 5_000,
      },
    });
    expect(res.status(), `request ${String(index)} status`).toBe(200);
  }

  const keptMessage =
    "This 6th submission from the same visitor IP should receive 429.";
  await field(page, "Name").fill("Nadia Rahman");
  await field(page, "Email").fill("nadia@example.com");
  await field(page, "Message").fill(keptMessage);

  const remainingMs = CONTACT_MIN_WAIT_MS - (Date.now() - hydratedAt);
  if (remainingMs > 0) {
    await page.waitForTimeout(remainingMs);
  }

  const limitedPromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/contact") &&
      response.request().method() === "POST",
  );
  await form(page).getByRole("button", { name: "Send message" }).click();
  const limitedResponse = await limitedPromise;

  expect(limitedResponse.status()).toBe(429);
  expect(Number(limitedResponse.headers()["retry-after"])).toBeGreaterThan(0);
  await expect(
    form(page)
      .locator("..")
      .getByText(
        /Please wait about \d+ minutes? before sending another message\./,
      ),
  ).toBeVisible();
  await expect(field(page, "Message")).toHaveValue(keptMessage);

  // A second visitor IP stays completely unaffected by ipA's 429 bucket.
  const otherVisitor = await request.post("/api/contact", {
    headers: {
      "content-type": "application/json",
      origin: webOrigin,
      "x-forwarded-for": `198.51.100.99, ${ipB}`,
    },
    data: {
      name: "Other Visitor",
      email: "visitor@example.com",
      topic: "general",
      message: "Independent visitor message should succeed.",
      website: "",
      elapsedMs: 5_000,
    },
  });
  expect(otherVisitor.status()).toBe(200);
});
