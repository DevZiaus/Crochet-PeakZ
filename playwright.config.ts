import { defineConfig, devices } from "@playwright/test";

/**
 * End to end configuration for the storefront.
 *
 * The tests drive a real browser against the real Next.js web app, which proxies
 * auth calls to the real Express API. `webServer` builds and starts both, so a
 * single `npx playwright test` is enough from a clean checkout. The API is
 * expected to have a reachable PostgreSQL database, the same one `npm run dev`
 * uses. A web server already answering on port 3000 is reused; the API is always
 * built and started, so the suite stops if a `npm run dev` API holds port 4000.
 * That is what guarantees the `CONTACT_EMAIL_TRANSPORT=log` override below.
 */
export default defineConfig({
  testDir: "./e2e",
  // Artifacts land outside the repository on purpose. The dev servers watch the
  // repo root, so a trace or screenshot written inside it triggers a rebuild,
  // which reloads the page under test and loops.
  outputDir: "/tmp/crochet-peakz-playwright",
  fullyParallel: false,
  forbidOnly: Boolean(process.env["CI"]),
  retries: process.env["CI"] ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: "http://localhost:3000",
    trace: "off",
    screenshot: "off",
    video: "off",
  },

  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],

  webServer: [
    {
      command:
        "npm run build:shared && npm run build --workspace=@crochet-peakz/api && npm run start --workspace=@crochet-peakz/api",
      url: "http://localhost:4000/api/health",
      // Never reuse a running dev API. The `CONTACT_EMAIL_TRANSPORT=log`
      // override below only reaches a server Playwright starts itself, and a
      // reused dev server can send real contact mail. Stop `npm run dev`
      // before running the suite.
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: "ignore",
      stderr: "pipe",
      env: {
        CONTACT_EMAIL_TRANSPORT: "log",
      },
    },
    {
      command:
        "npm run build:shared && npm run build --workspace=@crochet-peakz/web && npm run start --workspace=@crochet-peakz/web",
      url: "http://localhost:3000/health",
      reuseExistingServer: !process.env["CI"],
      timeout: 180_000,
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
});
