/**
 * Playwright utilities for mocking Komoot and TP APIs in E2E tests.
 *
 * Key insight: Komoot API calls are made from the background SERVICE WORKER,
 * so we must use context.route() (not page.route()) to intercept them.
 * TP API calls are made from the content script, so page.route() works.
 *
 * Auth setup uses the extension popup page to set browser.storage.local
 * before tests navigate to the fixture page.
 */

import { type BrowserContext, type Page } from "@playwright/test";
import type { KomootTour, KomootSportType } from "../../src/types/komoot";
import {
  mockKomootDiscoverResponse,
  mockKomootActivitiesResponse,
  mockTPWorkoutResponse,
} from "../fixtures/komoot-responses";

// ─── Extension auth & storage setup ─────────────────────────────────────────

/**
 * Pre-populate extension storage with auth credentials and options.
 * Must be called before navigating to the fixture page so that the
 * background service worker finds valid auth when handling messages.
 *
 * Uses the extension popup page to access chrome.storage.local.
 */
export async function setupExtensionAuth(
  context: BrowserContext,
  extensionId: string,
) {
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
        homeLocation: { lat: 48.137, lng: 11.576 },
        maxResults: 5,
      },
    });
  });
  await setupPage.close();
}

/**
 * Mock the Komoot session endpoint at context level so verifyAuth()
 * succeeds even without real cookies.
 */
export async function setupSessionMock(context: BrowserContext) {
  await context.route("**/account.komoot.com/v1/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        _embedded: {
          profile: {
            username: "test-user-123",
            display_name: "Test User",
          },
        },
      }),
    });
  });
}

// ─── Komoot API Mocking (context-level for service worker) ──────────────────

/**
 * Setup default Komoot API mocking for route discovery and activities.
 * Uses context.route() to intercept service worker fetches.
 */
export async function setupKomootMocking(context: BrowserContext) {
  // Mock session endpoint
  await setupSessionMock(context);

  // GET /discover_tours/ (route search)
  await context.route(
    "**/www.komoot.com/api/v007/discover_tours/*",
    async (route) => {
      const url = new URL(route.request().url());
      const params = url.searchParams;
      const sports = params.getAll("sport[]");

      const DEMO_ROUTES = [
        {
          id: "route-1",
          name: "Scenic Downtown Loop",
          sport: (sports[0] || "jogging") as KomootSportType,
          status: "public" as const,
          date: "2026-02-28T08:00:00Z",
          distance: 5000,
          duration: 1800,
          elevation_up: 50,
          elevation_down: 50,
          difficulty: { grade: "easy" as const },
          summary: {
            surfaces: [{ type: "paved_smooth", amount: 4500 }],
            way_types: [{ type: "residential", amount: 5000 }],
          },
          vector_map_image: {
            src: "https://example.com/routes/1/map.jpg",
          },
          vector_map_image_preview: {
            src: "https://example.com/routes/1/map-preview.jpg",
          },
          visitors: 2341,
          rating_count: 156,
          rating_score: 4.7,
        },
        {
          id: "route-2",
          name: "Park Trail Run",
          sport: (sports[0] || "jogging") as KomootSportType,
          status: "public" as const,
          date: "2026-02-28T09:00:00Z",
          distance: 6500,
          duration: 2340,
          elevation_up: 120,
          elevation_down: 120,
          difficulty: { grade: "moderate" as const },
          summary: {
            surfaces: [
              { type: "paved_smooth", amount: 3000 },
              { type: "gravel", amount: 3500 },
            ],
            way_types: [{ type: "path", amount: 6500 }],
          },
          vector_map_image: {
            src: "https://example.com/routes/2/map.jpg",
          },
          vector_map_image_preview: {
            src: "https://example.com/routes/2/map-preview.jpg",
          },
          visitors: 891,
          rating_count: 42,
          rating_score: 4.3,
        },
        {
          id: "route-3",
          name: "River Valley Long Route",
          sport: (sports[0] || "jogging") as KomootSportType,
          status: "public" as const,
          date: "2026-02-28T10:00:00Z",
          distance: 12000,
          duration: 4320,
          elevation_up: 200,
          elevation_down: 200,
          difficulty: { grade: "difficult" as const },
          summary: {
            surfaces: [{ type: "paved_smooth", amount: 12000 }],
            way_types: [{ type: "path", amount: 12000 }],
          },
          vector_map_image: {
            src: "https://example.com/routes/3/map.jpg",
          },
          vector_map_image_preview: {
            src: "https://example.com/routes/3/map-preview.jpg",
          },
          visitors: 5643,
          rating_count: 389,
          rating_score: 4.6,
        },
      ];

      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(mockKomootDiscoverResponse(DEMO_ROUTES)),
      });
    },
  );

  // GET /users/{userId}/activities/ (activity history)
  await context.route(
    "**/www.komoot.com/api/v007/users/*/activities/*",
    async (route) => {
      const DEMO_ACTIVITIES: KomootTour[] = [
        {
          id: "activity-1",
          name: "Morning Run — Park Trail",
          sport: "jogging",
          status: "public" as const,
          date: "2026-02-28T08:15:00Z",
          distance: 6500,
          duration: 2340,
          elevation_up: 120,
          elevation_down: 120,
          difficulty: { grade: "moderate" as const },
          vector_map_image: {
            src: "https://example.com/activities/1/map.jpg",
          },
          vector_map_image_preview: {
            src: "https://example.com/activities/1/map-preview.jpg",
          },
        },
        {
          id: "activity-2",
          name: "Evening Run — Downtown",
          sport: "jogging",
          status: "public" as const,
          date: "2026-02-27T17:45:00Z",
          distance: 5200,
          duration: 1860,
          elevation_up: 45,
          elevation_down: 45,
          difficulty: { grade: "easy" as const },
          vector_map_image: {
            src: "https://example.com/activities/2/map.jpg",
          },
          vector_map_image_preview: {
            src: "https://example.com/activities/2/map-preview.jpg",
          },
        },
      ];

      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(mockKomootActivitiesResponse(DEMO_ACTIVITIES)),
      });
    },
  );
}

// ─── TrainingPeaks API Mocking (page-level for content script) ──────────────

interface CapturedPutRequest {
  athleteId: string;
  workoutId: string;
  body: Record<string, unknown>;
}

const capturedPutRequests: CapturedPutRequest[] = [];

/**
 * Setup TP API mocking for workout GET and PUT operations.
 * Uses page.route() since TP API calls are made from the content script.
 */
export async function setupTPMocking(page: Page) {
  await page.route(
    "**/tpapi.trainingpeaks.com/fitness/v6/athletes/*/workouts/*",
    async (route) => {
      const method = route.request().method();

      if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockTPWorkoutResponse()),
        });
      } else if (method === "PUT") {
        const url = new URL(route.request().url());
        const pathParts = url.pathname.split("/");
        const athleteId = pathParts[4];
        const workoutId = pathParts[6];

        const body = JSON.parse(route.request().postData() || "{}");

        capturedPutRequests.push({
          athleteId,
          workoutId,
          body,
        });

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ...mockTPWorkoutResponse(),
            description: body.description,
          }),
        });
      } else {
        await route.abort();
      }
    },
  );
}

/**
 * Clear captured PUT requests (call before each test).
 */
export function clearCapturedPutRequests() {
  capturedPutRequests.length = 0;
}

/**
 * Get all captured PUT requests for verification.
 */
export function getCapturedPutRequests(): CapturedPutRequest[] {
  return [...capturedPutRequests];
}

/**
 * Get the most recent captured PUT request.
 */
export function getLastPutRequest(): CapturedPutRequest | undefined {
  return capturedPutRequests[capturedPutRequests.length - 1];
}

/**
 * Setup TP API to return error on PUT (e.g., 400, 500).
 */
export async function setupTPPutError(
  page: Page,
  status: number,
  message: string,
) {
  await page.route(
    "**/tpapi.trainingpeaks.com/fitness/v6/athletes/*/workouts/*",
    async (route) => {
      const method = route.request().method();

      if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockTPWorkoutResponse()),
        });
      } else if (method === "PUT") {
        await route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify({ error: message }),
        });
      }
    },
  );
}

/**
 * Setup TP API to return 404 (workout not found).
 */
export async function setupTPNotFound(page: Page) {
  await page.route(
    "**/tpapi.trainingpeaks.com/fitness/v6/athletes/*/workouts/*",
    async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "Workout not found" }),
      });
    },
  );
}
