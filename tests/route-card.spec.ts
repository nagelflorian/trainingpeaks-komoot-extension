/**
 * Playwright E2E tests for route card rendering.
 *
 * Tests that RouteCard components properly display Komoot route data,
 * including titles, distance, duration, elevation, map images, and
 * score tooltips.
 */

import {
  expect,
  test,
  FIXTURE_HTML,
  TP_URL,
  setupKomootMocking,
} from "./fixtures";
import type { BrowserContext } from "@playwright/test";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function openFixturePage(context: BrowserContext) {
  const page = await context.newPage();
  // Intercept TP page
  await page.route(`${TP_URL}**`, (route) =>
    route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: FIXTURE_HTML,
    }),
  );
  // Setup Komoot API mocking
  await setupKomootMocking(page);
  await page.goto(TP_URL, { waitUntil: "domcontentloaded" });
  return page;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Route card rendering", () => {
  test("displays route cards with mocked Komoot API data", async ({
    context,
  }) => {
    const page = await openFixturePage(context);
    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    // Activate Komoot tab
    await page.locator("[data-komoot-tab-btn]").click();

    // Wait for suggestions to load
    await expect(page.getByText("Suggested Routes")).toBeVisible({
      timeout: 10_000,
    });

    // Verify route cards are rendered
    const routeCards = page.locator('[data-testid="route-card"]');
    const cardCount = await routeCards.count();
    expect(cardCount).toBeGreaterThan(0);

    await page.close();
  });

  test("renders route title, distance, duration, and elevation", async ({
    context,
  }) => {
    const page = await openFixturePage(context);
    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    // Activate Komoot tab
    await page.locator("[data-komoot-tab-btn]").click();

    // Wait for first route card
    await expect(
      page.locator('[data-testid="route-card"]').first(),
    ).toBeVisible({
      timeout: 10_000,
    });

    // Verify route card displays title
    await expect(
      page.locator('[data-testid="route-card"]').first().getByRole("heading"),
    ).toContainText(/Loop|Trail|Route/);

    // Verify distance is shown
    await expect(page.getByText(/\d+\.?\d*\s*(km|mi)/)).toBeVisible();

    // Verify duration is shown (e.g., "30 mins")
    await expect(page.getByText(/\d+\s*mins?/)).toBeVisible();

    // Verify elevation is shown
    await expect(page.getByText(/\d+\s*m/)).toBeVisible();

    await page.close();
  });

  test("displays route map image from vector_map_image.src", async ({
    context,
  }) => {
    const page = await openFixturePage(context);
    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    // Activate Komoot tab
    await page.locator("[data-komoot-tab-btn]").click();

    // Wait for route card
    await expect(
      page.locator('[data-testid="route-card"]').first(),
    ).toBeVisible({
      timeout: 10_000,
    });

    // Verify map image is displayed (uses vector_map_image.src)
    const routeImage = page.locator('[data-testid="route-card"] img').first();
    await expect(routeImage).toBeVisible();

    // Verify image src contains example.com/routes (our mock URL)
    const imageSrc = await routeImage.getAttribute("src");
    expect(imageSrc).toMatch(/example\.com\/routes/);
  });

  test("displays route metadata: ratings and visitor count", async ({
    context,
  }) => {
    const page = await openFixturePage(context);
    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    // Activate Komoot tab
    await page.locator("[data-komoot-tab-btn]").click();

    // Wait for route cards
    await expect(
      page.locator('[data-testid="route-card"]').first(),
    ).toBeVisible({
      timeout: 10_000,
    });

    // Verify rating score is displayed (e.g., "4.7" stars)
    await expect(page.getByText(/\b(4\.\d|[0-5])\b/)).toBeVisible();

    // Verify visitor count or rating count is shown
    await expect(page.getByText(/\d+\s*(visitor|rating)/)).toBeVisible();

    await page.close();
  });

  test("shows difficulty badge (easy/moderate/hard)", async ({ context }) => {
    const page = await openFixturePage(context);
    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    // Activate Komoot tab
    await page.locator("[data-komoot-tab-btn]").click();

    // Wait for route cards
    await expect(
      page.locator('[data-testid="route-card"]').first(),
    ).toBeVisible({
      timeout: 10_000,
    });

    // Verify difficulty badge is displayed
    await expect(page.getByText(/(easy|moderate|hard)/i)).toBeVisible();

    await page.close();
  });

  test("displays score percentage in card header", async ({ context }) => {
    const page = await openFixturePage(context);
    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    // Activate Komoot tab
    await page.locator("[data-komoot-tab-btn]").click();

    // Wait for route cards
    await expect(
      page.locator('[data-testid="route-card"]').first(),
    ).toBeVisible({
      timeout: 10_000,
    });

    // Verify score percentage is displayed (e.g., "95%")
    await expect(page.getByText(/\d+%/)).toBeVisible();

    await page.close();
  });

  test("displays Add to workout button", async ({ context }) => {
    const page = await openFixturePage(context);
    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    // Activate Komoot tab
    await page.locator("[data-komoot-tab-btn]").click();

    // Wait for route cards
    await expect(
      page.locator('[data-testid="route-card"]').first(),
    ).toBeVisible({
      timeout: 10_000,
    });

    // Verify Add to workout button is visible
    const addButton = page
      .getByRole("button", {
        name: /add to workout|add route/i,
      })
      .first();
    await expect(addButton).toBeVisible();

    await page.close();
  });

  test("routes are sorted by score (highest first)", async ({ context }) => {
    const page = await openFixturePage(context);
    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    // Activate Komoot tab
    await page.locator("[data-komoot-tab-btn]").click();

    // Wait for route cards
    await expect(
      page.locator('[data-testid="route-card"]').first(),
    ).toBeVisible({
      timeout: 10_000,
    });

    // Get all score percentages from cards
    const scoreElements = page.locator(
      '[data-testid="route-card"] [data-testid="score"]',
    );
    const scoreCount = await scoreElements.count();

    if (scoreCount > 1) {
      // Extract numeric scores
      const scores = [];
      for (let i = 0; i < scoreCount; i++) {
        const text = await scoreElements.nth(i).textContent();
        const match = text?.match(/(\d+)%/);
        if (match) {
          scores.push(parseInt(match[1], 10));
        }
      }

      // Verify scores are in descending order
      for (let i = 0; i < scores.length - 1; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
      }
    }

    await page.close();
  });
});
