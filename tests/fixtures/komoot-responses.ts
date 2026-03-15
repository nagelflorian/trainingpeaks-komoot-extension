/**
 * Mock Komoot API response fixtures for E2E testing.
 *
 * Factories for creating realistic KomootTour objects with various characteristics.
 */

import type { KomootTour } from "../../src/types/komoot";

/**
 * Factory to create a mock KomootTour with customizable stats.
 * Defaults are a 5km running route.
 */
export function mockKomootRoute(
  overrides: Partial<KomootTour> = {},
): KomootTour {
  return {
    id: "mock-route-" + Math.random().toString(36).slice(2, 11),
    name: "Morning Jog - Downtown Loop",
    sport: "jogging",
    status: "public",
    date: "2026-02-28T08:00:00Z",
    distance: 5000, // meters
    duration: 1800, // seconds (30 min)
    elevation_up: 50,
    elevation_down: 50,
    difficulty: {
      grade: "easy",
    },
    summary: {
      surfaces: [{ type: "paved_smooth", amount: 4500 }],
      way_types: [{ type: "residential", amount: 5000 }],
    },
    map_image: {
      src: "https://example.com/map.jpg?width={width}&height={height}&crop={crop}",
      templated: true,
    },
    vector_map_image: {
      src: "https://example.com/vector-map.jpg",
    },
    vector_map_image_preview: {
      src: "https://example.com/vector-map-preview.jpg",
    },
    visitors: 1234,
    rating_count: 42,
    rating_score: 4.5,
    _scoreBreakdown: {
      duration: { planned: 1800, actual: 1800, pct: 100 },
      distance: { planned: 5000, actual: 5000, pct: 100 },
      elevation: { planned: 50, actual: 50, pct: 100 },
    },
    ...overrides,
  };
}

/**
 * Create multiple mock routes with varied characteristics.
 */
export const MOCK_ROUTES = {
  PERFECT_MATCH: mockKomootRoute({
    id: "perfect-match",
    name: "Perfect 5km Run",
    distance: 5000,
    duration: 1800,
    elevation_up: 50,
  }),

  TOO_LONG: mockKomootRoute({
    id: "too-long",
    name: "Half Marathon Route",
    distance: 21000,
    duration: 7200,
    elevation_up: 150,
  }),

  TOO_SHORT: mockKomootRoute({
    id: "too-short",
    name: "Quick 2km Run",
    distance: 2000,
    duration: 720,
    elevation_up: 20,
  }),

  HIGH_ELEVATION: mockKomootRoute({
    id: "high-elev",
    name: "Mountain Trail Run",
    distance: 8000,
    duration: 3600,
    elevation_up: 500,
    elevation_down: 500,
    difficulty: { grade: "difficult" },
  }),

  LOW_RATING: mockKomootRoute({
    id: "low-rating",
    name: "Unpopular Route",
    visitors: 5,
    rating_count: 1,
    rating_score: 2.0,
  }),

  CYCLING: mockKomootRoute({
    id: "cycling-route",
    name: "Scenic Bike Route",
    sport: "cycling",
    distance: 35000,
    duration: 7200,
    elevation_up: 200,
  }),
};

/**
 * Create a mock successful Komoot API response for route discovery.
 */
export function mockKomootDiscoverResponse(tours: KomootTour[]) {
  return {
    _embedded: {
      items: tours,
    },
    page: {
      size: tours.length,
      totalElements: tours.length,
      totalPages: 1,
      number: 0,
    },
  };
}

/**
 * Create a mock successful Komoot API response for activities.
 */
export function mockKomootActivitiesResponse(
  tours: KomootTour[],
  pageNumber = 0,
) {
  return {
    _embedded: {
      items: tours,
    },
    page: {
      size: tours.length,
      totalElements: tours.length,
      totalPages: 1,
      number: pageNumber,
    },
  };
}

/**
 * Mock a 401 Unauthorized response from Komoot API.
 */
export function mockKomootAuthError() {
  return {
    status: 401,
    statusText: "Unauthorized",
  };
}

/**
 * Mock a Komoot API error response.
 */
export function mockKomootErrorResponse(code: string, message: string) {
  return {
    errors: [
      {
        code,
        message,
      },
    ],
  };
}

/**
 * Create a mock TP API GET response for a workout.
 */
export function mockTPWorkoutResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: "fixture-workout-123",
    athleteId: "12345",
    title: "Morning Run",
    description: "Existing notes",
    notes: "",
    workout_date: "2026-02-28T06:00:00Z",
    duration_seconds: 1800,
    distance_meters: 5000,
    elevation_gain_meters: 50,
    status: "completed",
    type: "Run",
    peakTrainingEffect: 2.5,
    structure: {
      warmup_seconds: 300,
      main_seconds: 1500,
      cooldown_seconds: 0,
    },
    ...overrides,
  };
}

/**
 * Create a mock TP API error response.
 */
export function mockTPErrorResponse(status: number, message: string) {
  return {
    status,
    message,
  };
}
