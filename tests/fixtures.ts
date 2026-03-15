/**
 * Shared Playwright fixtures for Chrome extension testing.
 *
 * Strategy: use page.route() to intercept navigation to the actual TP domain
 * (https://app.trainingpeaks.com/*) and serve local fixture HTML.  Chrome
 * still sees the correct URL so the manifest content_script pattern matches
 * and the extension injects normally — no manifest changes required.
 */

import { test as base, chromium, type BrowserContext } from "@playwright/test";
import { readFileSync } from "fs";
import * as path from "path";

export * from "./utils/api-mocking";
export * from "./fixtures/komoot-responses";

const EXTENSION_PATH = path.resolve(process.cwd(), "dist");

export const FIXTURE_HTML = readFileSync(
  path.resolve(process.cwd(), "tests/fixtures/trainingpeaks.html"),
  "utf-8",
);

export const TP_URL = "https://app.trainingpeaks.com/athlete/calendar";

// ─── Custom fixtures ───────────────────────────────────────────────────────────

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  // Override the default `context` fixture with a persistent context that
  // loads the unpacked extension.
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      // `headless: false` prevents Playwright from adding --headless (old
      // mode), while --headless=new enables the new Chrome headless mode that
      // supports extensions. This works in CI without a virtual display.
      headless: false,
      args: [
        "--headless=new",
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    });
    await use(context);
    await context.close();
  },

  // Resolves the extension ID from the background service worker URL.
  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent("serviceworker");
    }
    // Service worker URL: chrome-extension://<id>/...
    const extensionId = background.url().split("/")[2];
    await use(extensionId);
  },
});

export const expect = test.expect;
