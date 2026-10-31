import { defineConfig, devices } from "@playwright/test";

/**
 * End to end configuration for the storefront.
 *
 * The tests drive a real browser against the real Next.js web app, which proxies
 * auth calls to the real Express API. `webServer` starts both, so a single
 * `npx playwright test` is enough. The API is expected to have a reachable
 * PostgreSQL database, the same one `npm run dev` uses.
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
      command: "npm run start --workspace=@crochet-peakz/api",
      url: "http://localhost:4000/api/health",
      reuseExistingServer: !process.env["CI"],
      timeout: 120_000,
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      command: "npm run start --workspace=@crochet-peakz/web",
      url: "http://localhost:3000/health",
      reuseExistingServer: !process.env["CI"],
      timeout: 180_000,
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
});
