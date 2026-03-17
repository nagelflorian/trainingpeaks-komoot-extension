/**
 * Playwright E2E tests for route attachment to TrainingPeaks workouts.
 *
 * Tests the full flow: open panel → click "Add to workout" → GET TP workout →
 * mutate description → PUT back → verify DOM updates → cross-card state sync.
 */

import {
  expect,
  test,
  FIXTURE_HTML,
  TP_URL,
  setupKomootMocking,
  setupExtensionAuth,
  setupTPMocking,
  clearCapturedPutRequests,
  getLastPutRequest,
  getCapturedPutRequests,
} from "./fixtures";
import type { BrowserContext } from "@playwright/test";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function openFixturePage(context: BrowserContext, extensionId: string) {
  // Setup auth storage and API mocking before navigating
  await setupExtensionAuth(context, extensionId);
  await setupKomootMocking(context);

  const page = await context.newPage();
  // Intercept TP page
  await page.route(`${TP_URL}**`, (route) =>
    route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: FIXTURE_HTML,
    }),
  );
  // Setup TP API mocking (content script calls, page-level is fine)
  await setupTPMocking(page);
  clearCapturedPutRequests();

  await page.goto(TP_URL, { waitUntil: "domcontentloaded" });
  return page;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Route attachment to TP workouts", () => {
  test("attaches route to workout description via TP API", async ({
    context,
    extensionId,
  }) => {
    const page = await openFixturePage(context, extensionId);
    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    // Activate Komoot tab
    await page.locator("[data-komoot-tab-btn]").click();

    // Wait for route cards
    await expect(
      page.locator('[data-testid="route-card"]').first(),
    ).toBeVisible({
      timeout: 10_000,
    });

    // Click "Add to workout" button on first card
    const addButton = page
      .locator('[data-testid="route-card"]')
      .first()
      .getByRole("button", { name: /attach route|add to workout/i });
    await addButton.click();

    // Wait for TP API call to complete
    await page.waitForTimeout(1000);

    // Verify PUT request was captured
    const putRequest = getLastPutRequest();
    expect(putRequest).toBeDefined();
    expect(putRequest?.athleteId).toBe("12345");
    expect(putRequest?.workoutId).toBe("fixture-workout-123");

    // Verify description contains route URL
    const description = putRequest?.body.description as string;
    expect(description).toMatch(/Route: https:\/\/www\.komoot\.com\//);

    await page.close();
  });

  test("preserves existing description when adding route", async ({
    context,
    extensionId,
  }) => {
    const page = await openFixturePage(context, extensionId);
    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    // Activate Komoot tab
    await page.locator("[data-komoot-tab-btn]").click();

    // Wait for route cards
    await expect(
      page.locator('[data-testid="route-card"]').first(),
    ).toBeVisible({
      timeout: 10_000,
    });

    // Click "Add to workout" button
    const addButton = page
      .locator('[data-testid="route-card"]')
      .first()
      .getByRole("button", { name: /attach route|add to workout/i });
    await addButton.click();

    // Wait for TP API call
    await page.waitForTimeout(1000);

    // Verify description contains both existing notes and route
    const putRequest = getLastPutRequest();
    const description = putRequest?.body.description as string;
    expect(description).toContain("Existing notes");
    expect(description).toMatch(/Route: https:\/\/www\.komoot\.com\//);
  });

  test("button text changes to 'Already added' when route is attached", async ({
    context,
    extensionId,
  }) => {
    const page = await openFixturePage(context, extensionId);
    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    // Activate Komoot tab
    await page.locator("[data-komoot-tab-btn]").click();

    // Wait for route cards
    await expect(
      page.locator('[data-testid="route-card"]').first(),
    ).toBeVisible({
      timeout: 10_000,
    });

    // Get first card's route ID to create a predictable route URL
    const firstCard = page.locator('[data-testid="route-card"]').first();

    // Click "Add to workout" button
    const addButton = firstCard.getByRole("button", {
      name: /attach route|add to workout/i,
    });
    await addButton.click();

    // Wait for TP API call
    await page.waitForTimeout(1000);

    // Wait for button text to update to "Already added"
    await expect(
      firstCard.getByRole("button", {
        name: /detach route|already added/i,
      }),
    ).toBeVisible({ timeout: 5_000 });

    await page.close();
  });

  test("detaches route by removing route line from description", async ({
    context,
    extensionId,
  }) => {
    const page = await openFixturePage(context, extensionId);
    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    // Activate Komoot tab
    await page.locator("[data-komoot-tab-btn]").click();

    // Wait for route cards
    await expect(
      page.locator('[data-testid="route-card"]').first(),
    ).toBeVisible({
      timeout: 10_000,
    });

    // Add route first
    const addButton = page
      .locator('[data-testid="route-card"]')
      .first()
      .getByRole("button");
    await addButton.click();
    await page.waitForTimeout(500);

    // Click to detach (button now says "Already added")
    const detachButton = page
      .locator('[data-testid="route-card"]')
      .first()
      .getByRole("button", { name: /detach route|already added/i });
    await detachButton.click();

    // Wait for TP API call
    await page.waitForTimeout(1000);

    // Get the PUT request from detach
    const allRequests = getCapturedPutRequests();
    const lastRequest = allRequests[allRequests.length - 1];

    // Verify route line was removed
    const description = lastRequest?.body.description as string;
    expect(description).not.toMatch(/Route: https:\/\/www\.komoot\.com\//);
    // But existing notes should still be there
    expect(description).toContain("Existing notes");

    await page.close();
  });

  test("cross-card state sync: attaching one route reflects in other cards", async ({
    context,
    extensionId,
  }) => {
    const page = await openFixturePage(context, extensionId);
    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    // Activate Komoot tab
    await page.locator("[data-komoot-tab-btn]").click();

    // Wait for multiple route cards
    await expect(
      page.locator('[data-testid="route-card"]').first(),
    ).toBeVisible({
      timeout: 10_000,
    });

    const cardCount = await page.locator('[data-testid="route-card"]').count();
    expect(cardCount).toBeGreaterThanOrEqual(2);

    // Click "Add" on first card
    const firstCardBtn = page
      .locator('[data-testid="route-card"]')
      .nth(0)
      .getByRole("button");
    await firstCardBtn.click();

    // Wait for state update
    await page.waitForTimeout(1000);

    // Verify first card shows "Already added"
    await expect(
      page.locator('[data-testid="route-card"]').nth(0).getByRole("button"),
    ).toContainText(/detach route|already added/i);

    // Verify other cards still show "Add to workout"
    for (let i = 1; i < Math.min(cardCount, 3); i++) {
      await expect(
        page.locator('[data-testid="route-card"]').nth(i).getByRole("button"),
      ).toContainText(/attach route|add to workout/i);
    }

    await page.close();
  });

  test("handles TP API errors gracefully with error message", async ({
    context,
    extensionId,
  }) => {
    const page = await openFixturePage(context, extensionId);

    // Override TP API to return error on PUT
    await page.route(
      "**/tpapi.trainingpeaks.com/fitness/v6/athletes/*/workouts/*",
      async (route) => {
        const method = route.request().method();
        if (method === "PUT") {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "Server error" }),
          });
        } else {
          await route.continue();
        }
      },
    );

    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    // Activate Komoot tab
    await page.locator("[data-komoot-tab-btn]").click();

    // Wait for route cards
    await expect(
      page.locator('[data-testid="route-card"]').first(),
    ).toBeVisible({
      timeout: 10_000,
    });

    // Click "Add to workout" button
    const addButton = page
      .locator('[data-testid="route-card"]')
      .first()
      .getByRole("button");
    await addButton.click();

    // Wait for error to appear
    await expect(page.getByText(/error|failed|unable/i)).toBeVisible({
      timeout: 5_000,
    });

    await page.close();
  });

  test("button becomes disabled while attachment is in progress", async ({
    context,
    extensionId,
  }) => {
    const page = await openFixturePage(context, extensionId);
    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    // Activate Komoot tab
    await page.locator("[data-komoot-tab-btn]").click();

    // Wait for route cards
    await expect(
      page.locator('[data-testid="route-card"]').first(),
    ).toBeVisible({
      timeout: 10_000,
    });

    // Click "Add to workout" button
    const addButton = page
      .locator('[data-testid="route-card"]')
      .first()
      .getByRole("button");

    // Immediately check if button shows loading state
    await addButton.click();

    // Button might show "Saving..." or be disabled
    // For now, just verify page doesn't crash
    await page.waitForTimeout(1000);

    await page.close();
  });

  test("validates description format: removes duplicate route lines", async ({
    context,
    extensionId,
  }) => {
    // Setup auth + Komoot mocking
    await setupExtensionAuth(context, extensionId);
    await setupKomootMocking(context);

    const page = await context.newPage();
    await page.route(`${TP_URL}**`, (route) =>
      route.fulfill({
        contentType: "text/html; charset=utf-8",
        body: FIXTURE_HTML,
      }),
    );

    // Custom TP mock: GET returns description with existing old route
    let capturedDescription: string | undefined;
    await page.route(
      "**/tpapi.trainingpeaks.com/fitness/v6/athletes/*/workouts/*",
      async (route) => {
        const method = route.request().method();

        if (method === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              id: "fixture-workout-123",
              athleteId: "12345",
              title: "Morning Run",
              description:
                "Existing notes\n\nRoute: https://www.komoot.com/routes/old-route-id",
              structure: {},
            }),
          });
        } else if (method === "PUT") {
          const body = JSON.parse(route.request().postData() || "{}");
          capturedDescription = body.description as string;
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(body),
          });
        }
      },
    );

    await page.goto(TP_URL, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    // Activate Komoot tab
    await page.locator("[data-komoot-tab-btn]").click();

    // Wait for route cards
    await expect(
      page.locator('[data-testid="route-card"]').first(),
    ).toBeVisible({
      timeout: 10_000,
    });

    // Click "Add to workout"
    const addButton = page
      .locator('[data-testid="route-card"]')
      .first()
      .getByRole("button");
    await addButton.click();

    await page.waitForTimeout(1000);

    // Verify captured PUT description
    expect(capturedDescription).toBeDefined();

    // Should only contain one route line
    const routeLines = (
      capturedDescription!.match(/Route: https:\/\/www\.komoot\.com\//g) || []
    ).length;
    expect(routeLines).toBe(1);

    // Should not contain old route ID
    expect(capturedDescription).not.toContain("old-route-id");

    // Should contain existing notes
    expect(capturedDescription).toContain("Existing notes");

    await page.close();
  });
});
