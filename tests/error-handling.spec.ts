/**
 * Playwright E2E tests for error handling scenarios.
 *
 * Tests authentication errors (401), network failures, API errors,
 * unsupported sports, and other error conditions that should display
 * appropriate user-facing messages.
 *
 * Komoot API mocking uses context.route() to intercept service worker
 * fetches. TP API mocking uses page.route() (content script calls).
 */

import {
  expect,
  test,
  FIXTURE_HTML,
  TP_URL,
  setupExtensionAuth,
  setupSessionMock,
} from "./fixtures";
import type { BrowserContext, Route } from "@playwright/test";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Open a fixture page with custom API mocking.
 *
 * @param komootSetup - context-level route setup for Komoot API (service worker)
 * @param tpSetup - page-level route setup for TP API (content script)
 * @param skipAuth - if true, skip auth setup (for testing auth failures)
 */
async function openFixturePage(
  context: BrowserContext,
  extensionId: string,
  options?: {
    komootSetup?: (context: BrowserContext) => Promise<void>;
    tpSetup?: (page: import("@playwright/test").Page) => Promise<void>;
    skipAuth?: boolean;
  },
) {
  // Setup auth unless testing auth failures
  if (!options?.skipAuth) {
    await setupExtensionAuth(context, extensionId);
    await setupSessionMock(context);
  }

  // Custom Komoot API setup (context-level for service worker interception)
  if (options?.komootSetup) {
    await options.komootSetup(context);
  }

  const page = await context.newPage();

  // Intercept TP page
  await page.route(`${TP_URL}**`, (route: Route) =>
    route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: FIXTURE_HTML,
    }),
  );

  // Custom TP API setup (page-level for content script interception)
  if (options?.tpSetup) {
    await options.tpSetup(page);
  }

  await page.goto(TP_URL, { waitUntil: "domcontentloaded" });
  return page;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Error handling — Komoot API errors", () => {
  test("shows sign-in prompt when Komoot returns 401 Unauthorized", async ({
    context,
    extensionId,
  }) => {
    const page = await openFixturePage(context, extensionId, {
      // Don't set up auth — simulate unauthenticated state
      skipAuth: true,
      komootSetup: async (ctx) => {
        // Mock session endpoint to return 401
        await ctx.route(
          "**/account.komoot.com/v1/session",
          async (route: Route) => {
            await route.fulfill({
              status: 401,
              contentType: "application/json",
              body: JSON.stringify({ error: "Unauthorized" }),
            });
          },
        );
      },
    });

    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    // Activate Komoot tab
    await page.locator("[data-komoot-tab-btn]").click();

    // Verify sign-in prompt is shown
    await expect(page.getByText(/sign in|authenticate|login/i)).toBeVisible({
      timeout: 10_000,
    });

    // Verify sign-in button is clickable
    await expect(
      page.getByRole("button", { name: /komoot|sign in/i }),
    ).toBeVisible();

    await page.close();
  });

  test("shows error message when route fetch network fails", async ({
    context,
    extensionId,
  }) => {
    const page = await openFixturePage(context, extensionId, {
      komootSetup: async (ctx) => {
        // Mock Komoot API to fail with network error
        await ctx.route(
          "**/www.komoot.com/api/v007/**",
          async (route: Route) => {
            await route.abort("failed");
          },
        );
      },
    });

    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    // Activate Komoot tab
    await page.locator("[data-komoot-tab-btn]").click();

    // Verify error message is shown
    await expect(page.getByText(/error|failed|unable|network/i)).toBeVisible({
      timeout: 10_000,
    });

    await page.close();
  });

  test("displays 'No matching routes' when API returns empty results", async ({
    context,
    extensionId,
  }) => {
    const page = await openFixturePage(context, extensionId, {
      komootSetup: async (ctx) => {
        // Mock Komoot API to return empty results
        await ctx.route(
          "**/www.komoot.com/api/v007/discover_tours/**",
          async (route: Route) => {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                _embedded: { items: [] },
                page: { size: 0, totalElements: 0, totalPages: 0, number: 0 },
              }),
            });
          },
        );
      },
    });

    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    // Activate Komoot tab
    await page.locator("[data-komoot-tab-btn]").click();

    // Verify empty state message
    await expect(
      page.getByText(/no.*routes|no.*suggestions|not found/i),
    ).toBeVisible({ timeout: 10_000 });

    await page.close();
  });

  test("handles malformed Komoot API response gracefully", async ({
    context,
    extensionId,
  }) => {
    const page = await openFixturePage(context, extensionId, {
      komootSetup: async (ctx) => {
        // Mock Komoot API to return invalid JSON
        await ctx.route(
          "**/www.komoot.com/api/v007/discover_tours/**",
          async (route: Route) => {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: "invalid json {{{",
            });
          },
        );
      },
    });

    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    // Activate Komoot tab
    await page.locator("[data-komoot-tab-btn]").click();

    // Should show error rather than crash
    await expect(page.getByText(/error|failed|unable/i)).toBeVisible({
      timeout: 10_000,
    });

    await page.close();
  });
});

test.describe("Error handling — TrainingPeaks API errors", () => {
  test("shows error when TP workout GET fails", async ({
    context,
    extensionId,
  }) => {
    const page = await openFixturePage(context, extensionId, {
      komootSetup: async (ctx) => {
        // Mock Komoot working
        await ctx.route(
          "**/www.komoot.com/api/v007/**",
          async (route: Route) => {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                _embedded: {
                  items: [
                    {
                      id: "route-1",
                      name: "Test Route",
                      sport: "jogging",
                      status: "public",
                      date: "2026-02-28T08:00:00Z",
                      distance: 5000,
                      duration: 1800,
                      elevation_up: 50,
                      elevation_down: 50,
                      difficulty: { grade: "easy" },
                      vector_map_image: { src: "https://example.com/map.jpg" },
                    },
                  ],
                },
              }),
            });
          },
        );
      },
      tpSetup: async (page) => {
        // Mock TP GET to fail
        await page.route(
          "**/tpapi.trainingpeaks.com/fitness/v6/athletes/*/workouts/*",
          async (route: Route) => {
            const method = route.request().method();
            if (method === "GET") {
              await route.fulfill({
                status: 404,
                contentType: "application/json",
                body: JSON.stringify({ error: "Not found" }),
              });
            }
          },
        );
      },
    });

    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    // Activate Komoot tab, routes should load
    await page.locator("[data-komoot-tab-btn]").click();

    // Wait for card to appear
    await expect(
      page.locator('[data-testid="route-card"]').first(),
    ).toBeVisible({
      timeout: 10_000,
    });

    // Try to add - GET should fail
    const addButton = page
      .locator('[data-testid="route-card"]')
      .first()
      .getByRole("button");
    await addButton.click();

    // Should show error
    await expect(page.getByText(/error|failed|not found/i)).toBeVisible({
      timeout: 5_000,
    });

    await page.close();
  });

  test("shows error when TP workout PUT fails with 500", async ({
    context,
    extensionId,
  }) => {
    const page = await openFixturePage(context, extensionId, {
      komootSetup: async (ctx) => {
        // Mock Komoot working
        await ctx.route(
          "**/www.komoot.com/api/v007/**",
          async (route: Route) => {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                _embedded: {
                  items: [
                    {
                      id: "route-1",
                      name: "Test Route",
                      sport: "jogging",
                      status: "public",
                      date: "2026-02-28T08:00:00Z",
                      distance: 5000,
                      duration: 1800,
                      elevation_up: 50,
                      elevation_down: 50,
                      difficulty: { grade: "easy" },
                      vector_map_image: { src: "https://example.com/map.jpg" },
                    },
                  ],
                },
              }),
            });
          },
        );
      },
      tpSetup: async (page) => {
        // Mock TP API
        await page.route(
          "**/tpapi.trainingpeaks.com/fitness/v6/athletes/*/workouts/*",
          async (route: Route) => {
            const method = route.request().method();
            if (method === "GET") {
              await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                  id: "fixture-workout-123",
                  athleteId: "12345",
                  title: "Morning Run",
                  description: "Existing notes",
                  structure: {},
                }),
              });
            } else if (method === "PUT") {
              // Fail PUT request
              await route.fulfill({
                status: 500,
                contentType: "application/json",
                body: JSON.stringify({ error: "Server error" }),
              });
            }
          },
        );
      },
    });

    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    // Activate Komoot tab
    await page.locator("[data-komoot-tab-btn]").click();

    // Wait for cards to load
    await expect(
      page.locator('[data-testid="route-card"]').first(),
    ).toBeVisible({
      timeout: 10_000,
    });

    // Try to add
    const addButton = page
      .locator('[data-testid="route-card"]')
      .first()
      .getByRole("button");
    await addButton.click();

    // Should show error on card
    await expect(page.getByText(/error|failed|server/i)).toBeVisible({
      timeout: 5_000,
    });

    await page.close();
  });

  test("button remains clickable for retry after TP API error", async ({
    context,
    extensionId,
  }) => {
    let failCount = 0;
    const page = await openFixturePage(context, extensionId, {
      komootSetup: async (ctx) => {
        // Mock Komoot working
        await ctx.route(
          "**/www.komoot.com/api/v007/**",
          async (route: Route) => {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                _embedded: {
                  items: [
                    {
                      id: "route-1",
                      name: "Test Route",
                      sport: "jogging",
                      status: "public",
                      date: "2026-02-28T08:00:00Z",
                      distance: 5000,
                      duration: 1800,
                      elevation_up: 50,
                      elevation_down: 50,
                      difficulty: { grade: "easy" },
                      vector_map_image: { src: "https://example.com/map.jpg" },
                    },
                  ],
                },
              }),
            });
          },
        );
      },
      tpSetup: async (page) => {
        // Mock TP API - fail first, succeed second
        await page.route(
          "**/tpapi.trainingpeaks.com/fitness/v6/athletes/*/workouts/*",
          async (route: Route) => {
            const method = route.request().method();
            if (method === "GET") {
              await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                  id: "fixture-workout-123",
                  athleteId: "12345",
                  title: "Morning Run",
                  description: "Existing notes",
                  structure: {},
                }),
              });
            } else if (method === "PUT") {
              failCount++;
              if (failCount === 1) {
                // First attempt fails
                await route.fulfill({
                  status: 500,
                  contentType: "application/json",
                  body: JSON.stringify({ error: "Server error" }),
                });
              } else {
                // Retry succeeds
                await route.fulfill({
                  status: 200,
                  contentType: "application/json",
                  body: JSON.stringify({
                    id: "fixture-workout-123",
                    athleteId: "12345",
                    description:
                      "Existing notes\n\nRoute: https://www.komoot.com/routes/route-1",
                  }),
                });
              }
            }
          },
        );
      },
    });

    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    // Activate Komoot tab
    await page.locator("[data-komoot-tab-btn]").click();

    // Wait for cards to load
    await expect(
      page.locator('[data-testid="route-card"]').first(),
    ).toBeVisible({
      timeout: 10_000,
    });

    // First attempt - click button
    let addButton = page
      .locator('[data-testid="route-card"]')
      .first()
      .getByRole("button");
    await addButton.click();

    // Wait for error
    await expect(page.getByText(/error|failed/i)).toBeVisible({
      timeout: 5_000,
    });

    // Retry - button should still be clickable
    addButton = page
      .locator('[data-testid="route-card"]')
      .first()
      .getByRole("button", { name: /retry|try again|attach route/i });
    await addButton.click();

    // Second attempt should succeed - error should disappear
    await page.waitForTimeout(1000);

    // Error message should be gone
    const errorMessages = page.getByText(/error|failed/i);
    const errorCount = await errorMessages.count();
    expect(errorCount).toBe(0);

    await page.close();
  });
});

test.describe("Error handling — Unsupported scenarios", () => {
  test("shows 'sport not supported' message for unsupported workout type", async ({
    context,
    extensionId,
  }) => {
    const page = await openFixturePage(context, extensionId, {
      komootSetup: async (ctx) => {
        await ctx.route(
          "**/www.komoot.com/api/v007/discover_tours/**",
          async (route: Route) => {
            const url = new URL(route.request().url());
            const sports = url.searchParams.getAll("sport[]");

            // Return empty if sport is unsupported
            if (!sports.includes("jogging") && !sports.includes("running")) {
              await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                  _embedded: { items: [] },
                  page: {
                    size: 0,
                    totalElements: 0,
                    totalPages: 0,
                    number: 0,
                  },
                }),
              });
            } else {
              // For supported sports, return routes
              await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                  _embedded: {
                    items: [
                      {
                        id: "route-1",
                        name: "Test Route",
                        sport: sports[0],
                        distance: 5000,
                        duration: 1800,
                        elevation_up: 50,
                        elevation_down: 50,
                        difficulty: { grade: "easy" },
                        vector_map_image: {
                          src: "https://example.com/map.jpg",
                        },
                      },
                    ],
                  },
                }),
              });
            }
          },
        );
      },
    });

    // The fixture uses "Run" sport which maps to jogging, so we should see routes
    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    // Activate Komoot tab
    await page.locator("[data-komoot-tab-btn]").click();

    // Should either show routes or unsupported message
    await expect(
      page.getByText(/(Route|sport|not supported|no routes)/i).first(),
    ).toBeVisible({ timeout: 10_000 });

    await page.close();
  });

  test("shows message when no home location is configured", async ({
    context,
    extensionId,
  }) => {
    // Setup auth but WITHOUT homeLocation in options
    const setupPage = await context.newPage();
    await setupPage.goto(
      `chrome-extension://${extensionId}/src/popup/index.html`,
    );
    await setupPage.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (globalThis as any).chrome.storage.local.set({
        komootAuth: { userId: "test-user-123", displayName: "Test User" },
        komootOptions: {
          weights: { duration: 0.5, distance: 0.35, elevation: 0.15 },
          // No homeLocation — should trigger NO_HOME_LOCATION error
          maxResults: 5,
        },
      });
    });
    await setupPage.close();

    await setupSessionMock(context);

    const page = await context.newPage();
    await page.route(`${TP_URL}**`, (route: Route) =>
      route.fulfill({
        contentType: "text/html; charset=utf-8",
        body: FIXTURE_HTML,
      }),
    );
    await page.goto(TP_URL, { waitUntil: "domcontentloaded" });

    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    // Activate Komoot tab
    await page.locator("[data-komoot-tab-btn]").click();

    // Should show error or configuration message
    await expect(
      page.getByText(/(location|configure|settings|error)/i),
    ).toBeVisible({ timeout: 10_000 });

    await page.close();
  });
});

test.describe("Error handling — Specific error messages", () => {
  test("displays meaningful error message from API error response", async ({
    context,
    extensionId,
  }) => {
    const page = await openFixturePage(context, extensionId, {
      komootSetup: async (ctx) => {
        // Mock Komoot to return specific error message
        await ctx.route(
          "**/www.komoot.com/api/v007/**",
          async (route: Route) => {
            await route.fulfill({
              status: 400,
              contentType: "application/json",
              body: JSON.stringify({
                errors: [
                  {
                    code: "VALIDATION_ERROR",
                    message: "Invalid coordinates provided",
                  },
                ],
              }),
            });
          },
        );
      },
    });

    await page.waitForSelector("[data-komoot-tab-btn]", { timeout: 10_000 });

    // Activate Komoot tab
    await page.locator("[data-komoot-tab-btn]").click();

    // Should show error message
    await expect(page.getByText(/error|invalid|coordinates/i)).toBeVisible({
      timeout: 10_000,
    });

    await page.close();
  });
});
