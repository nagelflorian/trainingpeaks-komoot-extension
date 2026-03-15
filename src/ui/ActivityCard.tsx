/**
 * Displays a single matched Komoot activity (completed workout).
 */

import React from "react";
import type { KomootTour } from "../types/komoot";
import {
  formatDistance,
  formatDuration,
  formatSpeed,
  formatDate,
  formatSport,
} from "./formatters";

interface Props {
  tour: KomootTour;
}

export function ActivityCard({ tour }: Props): React.ReactElement {
  const komootUrl = `https://www.komoot.com/tour/${tour.id}`;
  const thumbnail =
    tour.vector_map_image_preview?.src ??
    tour.vector_map_image?.src ??
    (tour.map_image_preview?.src ?? tour.map_image?.src)
      ?.replace("{width}", "200")
      .replace("{height}", "200")
      .replace("{crop}", "true");

  return (
    <div className="flex gap-3 border border-gray-200 rounded-lg p-3 bg-white shadow-sm hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      {thumbnail && (
        <div className="flex-shrink-0 w-16 h-16 rounded overflow-hidden bg-gray-100">
          <img
            src={thumbnail}
            alt={tour.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900 text-sm leading-tight truncate">
          {tour.name}
        </h3>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-gray-500">{formatDate(tour.date)}</p>
          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
            {formatSport(tour.sport)}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-600 mt-1">
          {tour.distance > 0 && (
            <span title="Distance">📏 {formatDistance(tour.distance)}</span>
          )}
          {tour.duration > 0 && (
            <span title="Duration">⏱ {formatDuration(tour.duration)}</span>
          )}
          {tour.distance > 0 && tour.duration > 0 && (
            <span title="Average speed">
              ⚡ {formatSpeed(tour.distance, tour.duration)}
            </span>
          )}
          {tour.elevation_up > 0 && (
            <span title="Elevation gain">
              ↑ {Math.round(tour.elevation_up)} m
            </span>
          )}
          {tour.elevation_down > 0 && (
            <span title="Elevation descent">
              ↓ {Math.round(tour.elevation_down)} m
            </span>
          )}
        </div>
      </div>

      {/* Link */}
      <div className="flex-shrink-0 self-center">
        <a
          href={komootUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-primary hover:text-primary-hover whitespace-nowrap"
        >
          View →
        </a>
      </div>
    </div>
  );
}
