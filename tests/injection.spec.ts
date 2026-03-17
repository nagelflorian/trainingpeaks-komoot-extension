/**
 * Playwright integration tests — extension injection into TrainingPeaks.
 *
 * All tests intercept navigation to the real TP domain and serve local fixture
 * HTML so the extension content script injects naturally (URL matches manifest)
 * without needing a live TrainingPeaks session.
 */

import type { BrowserContext } from "@playwright/test";
import { expect, test, FIXTURE_HTML, TP_URL } from "./fixtures";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function openFixturePage(context: BrowserContext) {
  const page = await context.newPage();
  await page.route(`${TP_URL}**`, (route) =>
    route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: FIXTURE_HTML,
    }),
  );
  await page.goto(TP_URL, { waitUntil: "domcontentloaded" });
  return page;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Extension smoke test", () => {
  test("background service worker starts without errors", async ({
    extensionId,
  }) => {
    // If extensionId resolved, the service worker registered successfully.
    expect(extensionId).toMatch(/^[a-z]{32}$/);
  });

  test("popup page renders the sign-in form", async ({
    context,
    extensionId,
  }) => {
    const popupUrl = `chrome-extension://${extensionId}/src/popup/index.html`;
    const page = await context.newPage();
    await page.goto(popupUrl);
    // Header is always rendered
    await expect(page.getByText("TP Komoot Plugin")).toBeVisible({
      timeout: 10_000,
    });
    // Without stored auth, popup reaches the logged-out state
    await expect(
      page.getByRole("button", { name: /Open Komoot to sign in/ }),
    ).toBeVisible({ timeout: 10_000 });
    await page.close();
  });
});

test.describe("Content script — tab injection", () => {
  test("injects the Komoot tab button into the tab navigation bar", async ({
    context,
  }) => {
    const page = await openFixturePage(context);

    // The content script finds .tabNavigation in the fixture HTML and
    // injects our tab button.
    await expect(page.locator("[data-komoot-tab-btn]")).toBeVisible({
      timeout: 10_000,
    });

    await page.close();
  });

  test("does not inject twice when the panel is already marked as injected", async ({
    context,
  }) => {
    const page = await openFixturePage(context);
    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    const count = await page.locator("[data-komoot-tab-btn]").count();
    expect(count).toBe(1);

    await page.close();
  });
});

test.describe("Content script — tab switching", () => {
  test("hides the TP content panel and shows the Komoot panel on click", async ({
    context,
  }) => {
    const page = await openFixturePage(context);
    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    // Original content is visible before clicking
    await expect(page.locator("#original-content")).toBeVisible();

    await page.locator("[data-komoot-tab-btn]").click();

    // TP content should now be hidden
    await expect(page.locator(".tabContent.tabContentRegion")).toBeHidden();

    // Komoot content panel should be visible
    await expect(page.locator("[data-komoot-content]")).toBeVisible();

    await page.close();
  });

  test("restores the TP content panel when switching back to a TP tab", async ({
    context,
  }) => {
    const page = await openFixturePage(context);
    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    // Activate Komoot tab
    await page.locator("[data-komoot-tab-btn]").click();
    await expect(page.locator("[data-komoot-content]")).toBeVisible();

    // Click a native TP tab to switch back
    await page.locator(".summaryTab").click();
    await expect(page.locator(".tabContent.tabContentRegion")).toBeVisible();
    await expect(page.locator("[data-komoot-content]")).toBeHidden();

    await page.close();
  });
});

test.describe("Content script — React rendering inside Shadow DOM", () => {
  test("renders a React UI in the Shadow DOM after the tab is clicked", async ({
    context,
  }) => {
    const page = await openFixturePage(context);
    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    await page.locator("[data-komoot-tab-btn]").click();

    // Playwright pierces open Shadow DOMs automatically with text locators.
    // With no auth stored, the component reaches auth_required state.
    await expect(page.getByText("Sign in to Komoot")).toBeVisible({
      timeout: 10_000,
    });

    await page.close();
  });

  test("shows the Komoot header with 'Suggested Routes' label", async ({
    context,
  }) => {
    const page = await openFixturePage(context);
    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    await page.locator("[data-komoot-tab-btn]").click();

    await expect(page.getByText("Suggested Routes")).toBeVisible({
      timeout: 10_000,
    });

    await page.close();
  });
});
