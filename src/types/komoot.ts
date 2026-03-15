/**
 * Komoot API type definitions.
 * Based on the unofficial Komoot API (api/v007) response structures.
 */

export type KomootSportType =
  | "touringbicycle"
  | "mtb"
  | "e_touringbicycle"
  | "jogging"
  | "trailrunning"
  | "hiking"
  | "cycling"
  | "mtb_advanced"
  | "road_cycling"
  | "racecycling"
  | "walking"
  | "snowshoeing"
  | "skitour"
  | "nordic"
  | "other";

export interface KomootCoordinate {
  lat: number;
  lng: number;
  alt: number;
  t?: number; // timestamp offset in ms
}

export interface KomootElevationData {
  // Elevation array in the form of [distance_m, elevation_m] pairs
  items: Array<[number, number]>;
}

export interface KomootTourSurface {
  type: string; // e.g. "sf#asphalt", "sf#gravel"
  amount: number; // 0–1 fraction
}

export interface KomootTourWayType {
  type: string; // e.g. "wt#way", "wt#footway"
  amount: number; // 0–1 fraction
}

export interface KomootTour {
  id: string;
  name: string;
  sport: KomootSportType;
  status: "public" | "private" | "friends";
  type?: "tour_planned" | "tour_recorded";
  date: string; // ISO 8601

  // Stats — top-level in the API response
  distance: number; // meters
  duration: number; // seconds
  elevation_up: number; // meters
  elevation_down: number; // meters

  difficulty?: {
    grade: "easy" | "moderate" | "difficult" | "expert";
    explanation_fitness?: string;
    explanation_technical?: string;
  };

  // summary contains surface/way-type breakdowns, NOT numeric stats
  summary?: {
    surfaces?: KomootTourSurface[];
    way_types?: KomootTourWayType[];
  };

  map_image?: {
    src: string; // may contain {width}/{height}/{crop} placeholders
    attribution?: string;
    type?: string;
    templated?: boolean;
  };
  map_image_preview?: {
    src: string;
    templated?: boolean;
  };
  vector_map_image?: {
    src: string; // no placeholders — preferred for display
    attribution?: string;
  };
  vector_map_image_preview?: {
    src: string; // no placeholders — preferred for display
  };

  // Engagement
  visitors?: number;
  rating_count?: number;
  rating_score?: number; // e.g. 4.17

  coordinates?: KomootCoordinate[];
  elevation?: KomootElevationData;

  // Computed ranking score and breakdown (client-side only)
  _score?: number;
  _scoreBreakdown?: KomootScoreBreakdown;
}

export interface KomootScoreBreakdownMetric {
  planned: number;
  actual: number;
  /** Match percentage 0–100 */
  pct: number;
}

export interface KomootScoreBreakdown {
  distance?: KomootScoreBreakdownMetric;
  duration?: KomootScoreBreakdownMetric;
  elevation?: KomootScoreBreakdownMetric;
}

export interface KomootUser {
  username: string;
  display_name: string;
  email?: string;
  avatar?: {
    src: string;
    template_src?: string;
  };
}

export interface KomootAuthStatus {
  loggedIn: boolean;
  userId?: string;
  displayName?: string;
}

export interface KomootActivitiesResponse {
  _embedded: {
    items: KomootTour[];
  };
  page: {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number;
  };
}
