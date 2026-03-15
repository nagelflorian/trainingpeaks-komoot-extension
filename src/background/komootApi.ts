/**
 * Komoot API client.
 * Uses session cookies set by auth.ts (credentials: 'include').
 */

import type {
  KomootTour,
  KomootActivitiesResponse,
  KomootScoreBreakdown,
} from "../types/komoot";
import type { WorkoutMetadata, SportType } from "../types/trainingpeaks";
import { SPORT_TYPE_MAP } from "../types/trainingpeaks";

const API_BASE = "https://www.komoot.com/api/v007";

// ─── Matching weights (default, overridden by options) ────────────────────────

export interface MatchingWeights {
  duration: number; // w1
  distance: number; // w2
  elevation: number; // w3
}

export const DEFAULT_WEIGHTS: MatchingWeights = {
  duration: 0.5,
  distance: 0.35,
  elevation: 0.15,
};

// ─── Activity fetching (for completed workouts) ───────────────────────────────

/**
 * Fetch recent Komoot activities for a user.
 * @param userId - Komoot username/userId
 * @param limit  - max activities to fetch (default 50)
 */
export async function fetchUserActivities(
  userId: string,
  limit = 50,
): Promise<KomootTour[]> {
  const url = `${API_BASE}/users/${encodeURIComponent(userId)}/activities/?page=0&limit=${limit}`;

  const res = await fetch(url, {
    credentials: "include",
    headers: { Accept: "application/hal+json" },
  });

  if (res.status === 401) throw new Error("AUTH_REQUIRED");
  if (!res.ok) throw new Error(`Activities fetch failed (${res.status})`);

  const data: KomootActivitiesResponse = await res.json();
  return data._embedded?.items ?? [];
}

/**
 * Filter activities to those matching a given ISO date (YYYY-MM-DD).
 */
export function filterActivitiesByDate(
  activities: KomootTour[],
  date: string,
): KomootTour[] {
  return activities.filter((a) => a.date?.startsWith(date));
}

// ─── Route search (for planned workouts) ─────────────────────────────────────

export interface SearchRouteOptions {
  sportType: SportType;
  /** Latitude of search center */
  centerLat?: number;
  /** Longitude of search center */
  centerLng?: number;
  maxDistanceKm?: number;
  minDistanceKm?: number;
  limit?: number;
}

/**
 * Search for Komoot routes matching a sport type and location.
 *
 * Endpoint and params verified via DevTools on komoot.com/discover:
 *   GET /api/v007/discover_tours/?sport[]=jogging&limit=20&page=0
 *     &format=simple&searchType=within_radius&lat=...&lng=...
 *   Distance filter: max_distance / min_distance in meters
 */
export async function searchRoutes(
  options: SearchRouteOptions,
): Promise<KomootTour[]> {
  const komootSport = SPORT_TYPE_MAP[options.sportType];

  if (komootSport === null) {
    // Sport type has no route equivalent (e.g. Swimming)
    return [];
  }

  if (options.centerLat === undefined || options.centerLng === undefined) {
    throw new Error("NO_HOME_LOCATION");
  }

  const params = new URLSearchParams();
  params.set("sport[]", komootSport ?? "touringbicycle");
  params.set("limit", String(options.limit ?? 20));
  params.set("page", "0");
  params.set("format", "simple");
  params.set("searchType", "within_radius");
  params.set("lat", String(options.centerLat));
  params.set("lng", String(options.centerLng));

  if (options.maxDistanceKm !== undefined) {
    params.set("max_distance", String(options.maxDistanceKm * 1000));
  }
  if (options.minDistanceKm !== undefined) {
    params.set("min_distance", String(options.minDistanceKm * 1000));
  }

  const url = `${API_BASE}/discover_tours/?${params}`;

  const res = await fetch(url, {
    credentials: "include",
    headers: { Accept: "application/hal+json" },
  });

  if (res.status === 401) throw new Error("AUTH_REQUIRED");
  if (!res.ok) throw new Error(`Route search failed (${res.status})`);

  const data = await res.json();
  return data._embedded?.items ?? [];
}

// ─── Route scoring & ranking ──────────────────────────────────────────────────

/**
 * Score a Komoot tour against a planned workout.
 * Returns a score in [0, 1] and a per-metric breakdown.
 * Never filters routes out — routes that don't match well simply score lower.
 */
export function scoreTour(
  tour: KomootTour,
  workout: WorkoutMetadata,
  weights: MatchingWeights = DEFAULT_WEIGHTS,
): { score: number; breakdown: KomootScoreBreakdown } {
  let score = 0;
  let totalWeight = 0;
  const breakdown: KomootScoreBreakdown = {};

  // Duration matching
  if (workout.plannedDurationSec !== undefined && tour.duration > 0) {
    const ratio =
      Math.abs(workout.plannedDurationSec - tour.duration) /
      workout.plannedDurationSec;
    const metricScore = Math.max(0, 1 - ratio);
    score += weights.duration * metricScore;
    totalWeight += weights.duration;
    breakdown.duration = {
      planned: workout.plannedDurationSec,
      actual: tour.duration,
      pct: Math.round(metricScore * 100),
    };
  }

  // Distance matching
  if (workout.plannedDistanceM !== undefined && tour.distance > 0) {
    const ratio =
      Math.abs(workout.plannedDistanceM - tour.distance) /
      workout.plannedDistanceM;
    const metricScore = Math.max(0, 1 - ratio);
    score += weights.distance * metricScore;
    totalWeight += weights.distance;
    breakdown.distance = {
      planned: workout.plannedDistanceM,
      actual: tour.distance,
      pct: Math.round(metricScore * 100),
    };
  }

  // Elevation matching
  if (workout.plannedElevationM !== undefined && tour.elevation_up > 0) {
    const ratio =
      Math.abs(workout.plannedElevationM - tour.elevation_up) /
      workout.plannedElevationM;
    const metricScore = Math.max(0, 1 - ratio);
    score += weights.elevation * metricScore;
    totalWeight += weights.elevation;
    breakdown.elevation = {
      planned: workout.plannedElevationM,
      actual: tour.elevation_up,
      pct: Math.round(metricScore * 100),
    };
  }

  return {
    score: totalWeight === 0 ? 0.5 : score / totalWeight,
    breakdown,
  };
}

/**
 * Rank a list of tours against a planned workout.
 * Returns tours sorted by score, limited to topN results.
 * Tours are never filtered out — lower-scoring tours simply appear later.
 */
export function rankRoutes(
  tours: KomootTour[],
  workout: WorkoutMetadata,
  weights: MatchingWeights = DEFAULT_WEIGHTS,
  topN = 5,
): KomootTour[] {
  return tours
    .map((tour) => {
      const { score, breakdown } = scoreTour(tour, workout, weights);
      return {
        tour: { ...tour, _score: score, _scoreBreakdown: breakdown },
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map((s) => s.tour);
}
