import { describe, it, expect } from "vitest";
import {
  scoreTour,
  rankRoutes,
  filterActivitiesByDate,
  DEFAULT_WEIGHTS,
} from "./komootApi";
import type { KomootTour } from "../types/komoot";
import type { WorkoutMetadata } from "../types/trainingpeaks";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTour(overrides: Partial<KomootTour> = {}): KomootTour {
  return {
    id: "1",
    name: "Test Tour",
    sport: "jogging",
    status: "public",
    date: "2026-02-28T08:00:00Z",
    distance: 10000,
    duration: 3600,
    elevation_up: 100,
    elevation_down: 100,
    ...overrides,
  };
}

function makeWorkout(
  overrides: Partial<WorkoutMetadata> = {},
): WorkoutMetadata {
  return {
    sportType: "Running",
    date: "2026-02-28",
    isCompleted: false,
    ...overrides,
  };
}

// ─── scoreTour ────────────────────────────────────────────────────────────────

describe("scoreTour", () => {
  it("returns 0.5 when no planned metrics are provided", () => {
    const { score, breakdown } = scoreTour(makeTour(), makeWorkout());
    expect(score).toBe(0.5);
    expect(breakdown).toEqual({});
  });

  it("returns 1.0 for a perfect distance match", () => {
    const { score } = scoreTour(
      makeTour({ distance: 10000 }),
      makeWorkout({ plannedDistanceM: 10000 }),
    );
    expect(score).toBe(1);
  });

  it("returns 1.0 for a perfect duration match", () => {
    const { score } = scoreTour(
      makeTour({ duration: 3600 }),
      makeWorkout({ plannedDurationSec: 3600 }),
    );
    expect(score).toBe(1);
  });

  it("returns 1.0 for a perfect elevation match", () => {
    const { score } = scoreTour(
      makeTour({ elevation_up: 500 }),
      makeWorkout({ plannedElevationM: 500 }),
    );
    expect(score).toBe(1);
  });

  it("scores 0 for a distance twice as long as planned", () => {
    const { score, breakdown } = scoreTour(
      makeTour({ distance: 20000 }),
      makeWorkout({ plannedDistanceM: 10000 }),
    );
    expect(score).toBe(0);
    expect(breakdown.distance?.pct).toBe(0);
  });

  it("clamps score to 0 when ratio exceeds 1", () => {
    const { score } = scoreTour(
      makeTour({ distance: 50000 }),
      makeWorkout({ plannedDistanceM: 10000 }),
    );
    expect(score).toBe(0);
  });

  it("weighs all three metrics when all planned values are present", () => {
    // Perfect match on all metrics → score 1
    const { score } = scoreTour(
      makeTour({ distance: 10000, duration: 3600, elevation_up: 200 }),
      makeWorkout({
        plannedDistanceM: 10000,
        plannedDurationSec: 3600,
        plannedElevationM: 200,
      }),
    );
    expect(score).toBe(1);
  });

  it("populates breakdown for each matched metric", () => {
    const { breakdown } = scoreTour(
      makeTour({ distance: 10000, duration: 3600, elevation_up: 200 }),
      makeWorkout({
        plannedDistanceM: 10000,
        plannedDurationSec: 3600,
        plannedElevationM: 200,
      }),
    );
    expect(breakdown.distance?.pct).toBe(100);
    expect(breakdown.duration?.pct).toBe(100);
    expect(breakdown.elevation?.pct).toBe(100);
  });

  it("respects custom weights", () => {
    // Only distance planned; custom weights should not affect single-metric normalisation
    const weights = { duration: 0.8, distance: 0.1, elevation: 0.1 };
    const { score } = scoreTour(
      makeTour({ distance: 10000 }),
      makeWorkout({ plannedDistanceM: 10000 }),
      weights,
    );
    expect(score).toBe(1);
  });
});

// ─── rankRoutes ───────────────────────────────────────────────────────────────

describe("rankRoutes", () => {
  it("sorts tours from best to worst match", () => {
    const workout = makeWorkout({ plannedDistanceM: 10000 });
    const poor = makeTour({ id: "poor", distance: 18000 });
    const good = makeTour({ id: "good", distance: 10500 });
    const perfect = makeTour({ id: "perfect", distance: 10000 });

    const ranked = rankRoutes([poor, good, perfect], workout);
    expect(ranked.map((t) => t.id)).toEqual(["perfect", "good", "poor"]);
  });

  it("attaches _score and _scoreBreakdown to each tour", () => {
    const workout = makeWorkout({ plannedDistanceM: 10000 });
    const [top] = rankRoutes([makeTour({ distance: 10000 })], workout);
    expect(top._score).toBe(1);
    expect(top._scoreBreakdown?.distance?.pct).toBe(100);
  });

  it("limits results to topN", () => {
    const workout = makeWorkout({ plannedDistanceM: 10000 });
    const tours = Array.from({ length: 10 }, (_, i) =>
      makeTour({ id: String(i), distance: 10000 + i * 100 }),
    );
    const ranked = rankRoutes(tours, workout, DEFAULT_WEIGHTS, 3);
    expect(ranked).toHaveLength(3);
  });

  it("returns all tours when topN exceeds the list length", () => {
    const workout = makeWorkout({ plannedDistanceM: 10000 });
    const ranked = rankRoutes(
      [makeTour(), makeTour()],
      workout,
      DEFAULT_WEIGHTS,
      10,
    );
    expect(ranked).toHaveLength(2);
  });
});

// ─── filterActivitiesByDate ───────────────────────────────────────────────────

describe("filterActivitiesByDate", () => {
  it("returns activities matching the given date", () => {
    const activities = [
      makeTour({ id: "1", date: "2026-02-28T08:00:00Z" }),
      makeTour({ id: "2", date: "2026-02-27T10:00:00Z" }),
      makeTour({ id: "3", date: "2026-02-28T17:30:00Z" }),
    ];
    const result = filterActivitiesByDate(activities, "2026-02-28");
    expect(result.map((a) => a.id)).toEqual(["1", "3"]);
  });

  it("returns empty array when no activities match", () => {
    const activities = [makeTour({ id: "1", date: "2026-02-27T08:00:00Z" })];
    expect(filterActivitiesByDate(activities, "2026-02-28")).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(filterActivitiesByDate([], "2026-02-28")).toEqual([]);
  });
});
