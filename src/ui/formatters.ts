/**
 * Shared formatting utilities for Komoot tour metadata.
 */

import type { KomootSportType } from "../types/komoot";

export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatSpeed(meters: number, seconds: number): string {
  if (seconds === 0) return "";
  const kmh = (meters / seconds) * 3.6;
  return `${kmh.toFixed(1)} km/h`;
}

export function formatDate(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return isoDate;
  }
}

const SPORT_LABELS: Record<KomootSportType, string> = {
  touringbicycle: "Touring Bike",
  mtb: "MTB",
  e_touringbicycle: "E-Bike",
  jogging: "Running",
  trailrunning: "Trail Running",
  hiking: "Hiking",
  cycling: "Cycling",
  mtb_advanced: "MTB Advanced",
  road_cycling: "Road Cycling",
  racecycling: "Road Cycling",
  walking: "Walking",
  snowshoeing: "Snowshoeing",
  skitour: "Ski Tour",
  nordic: "Nordic",
  other: "Other",
};

export function formatSport(sport: KomootSportType): string {
  return SPORT_LABELS[sport] ?? sport;
}
