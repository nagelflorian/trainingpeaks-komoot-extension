import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  // Each test file gets its own browser context with the extension loaded —
  // so a generous per-test timeout accounts for extension startup.
  timeout: 30_000,
  // Retry flaky E2E tests once in CI
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    // Extension tests require headed Chromium. Playwright 1.40+ supports
    // extensions in headless mode ("new" headless). Setting headless: true
    // here is overridden by launchPersistentContext in fixtures.ts.
    headless: true,
  },
});
