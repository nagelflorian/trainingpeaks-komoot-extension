/**
 * Playwright utilities for mocking Komoot and TP APIs in E2E tests.
 *
 * Strategies:
 * - Intercept HTTP requests with page.route()
 * - Serve fixture data based on URL patterns and request params
 * - Capture and validate PUT requests for verification
 */

import { type Page } from "@playwright/test";
import type { KomootTour, KomootSportType } from "../../src/types/komoot";
import {
  mockKomootDiscoverResponse,
  mockKomootActivitiesResponse,
  mockTPWorkoutResponse,
} from "../fixtures/komoot-responses";

/**
 * Setup default Komoot API mocking for route discovery and activities.
 * Routes can be overridden with more specific handlers.
 */
export async function setupKomootMocking(page: Page) {
  // GET /discover_tours/ (route search)
  await page.route(
    "**/www.komoot.com/api/v007/discover_tours/*",
    async (route) => {
      const url = new URL(route.request().url());
      const params = url.searchParams;

      // Check if sport parameter is provided
      const sports = params.getAll("sport[]");

      // For demo: return 3 varied quality routes
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
  await page.route(
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

/**
 * Mock a Komoot API endpoint to return 401 Unauthorized.
 * Call this instead of/before setupKomootMocking() to simulate auth failure.
 */
export async function setupKomootAuthError(page: Page) {
  await page.route("**/www.komoot.com/api/v007/**", async (route) => {
    await route.abort("aborted");
  });

  // Intercept more directly to return 401
  await page.route("**/www.komoot.com/api/v007/**", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "Unauthorized" }),
    });
  });
}

/**
 * Mock a network failure for Komoot API calls.
 */
export async function setupKomootNetworkError(page: Page) {
  await page.route("**/www.komoot.com/api/v007/**", async (route) => {
    await route.abort("failed");
  });
}

// ─── TrainingPeaks API Mocking ──────────────────────────────────────────────

interface CapturedPutRequest {
  athleteId: string;
  workoutId: string;
  body: Record<string, unknown>;
}

const capturedPutRequests: CapturedPutRequest[] = [];

/**
 * Setup TP API mocking for workout GET and PUT operations.
 * Returns helpers to verify captured requests.
 */
export async function setupTPMocking(page: Page) {
  // GET /fitness/v6/athletes/{athleteId}/workouts/{workoutId}
  await page.route(
    "**/tpapi.trainingpeaks.com/fitness/v6/athletes/*/workouts/*",
    async (route) => {
      const method = route.request().method();

      if (method === "GET") {
        // Return a mock workout with description field
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockTPWorkoutResponse()),
        });
      } else if (method === "PUT") {
        // Capture PUT request for later verification
        const url = new URL(route.request().url());
        const pathParts = url.pathname.split("/");
        const athleteId = pathParts[5];
        const workoutId = pathParts[7];

        const body = JSON.parse(route.request().postData() || "{}");

        capturedPutRequests.push({
          athleteId,
          workoutId,
          body,
        });

        // Return success with updated object
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
