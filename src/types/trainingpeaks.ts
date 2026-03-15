/**
 * TrainingPeaks type definitions.
 * Describes the workout metadata parsed from the TP DOM or page state.
 */

export type SportType =
  | "Cycling"
  | "MountainBike"
  | "GravelCycling"
  | "Running"
  | "TrailRunning"
  | "Hiking"
  | "Walking"
  | "Swimming"
  | "Triathlon"
  | "Rowing"
  | "Strength"
  | "Other";

export interface WorkoutMetadata {
  /** TP workout ID — from data-workoutid attribute */
  workoutId?: string;
  /** TP athlete/user ID — from localStorage ajs_user_id */
  athleteId?: string;
  sportType: SportType;
  /** ISO date YYYY-MM-DD */
  date: string;
  /** Planned distance in meters */
  plannedDistanceM?: number;
  /** Planned duration in seconds */
  plannedDurationSec?: number;
  /** Planned elevation gain in meters */
  plannedElevationM?: number;
  /** Whether the workout has a completed result */
  isCompleted: boolean;
  /** Workout title/name */
  title?: string;
}

/**
 * Maps TrainingPeaks sport types to Komoot sport_types[] values.
 * Returns null if no route search should be offered (e.g. Swimming).
 */
export const SPORT_TYPE_MAP: Record<SportType, string | null> = {
  Cycling: "touringbicycle",
  MountainBike: "mtb",
  GravelCycling: "e_touringbicycle",
  Running: "jogging",
  TrailRunning: "trailrunning",
  Hiking: "hiking",
  Walking: "hiking",
  Swimming: null,
  Triathlon: "jogging",
  Rowing: null,
  Strength: null,
  Other: "touringbicycle",
};
