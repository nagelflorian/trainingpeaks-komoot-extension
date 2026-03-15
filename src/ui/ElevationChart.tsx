/**
 * SVG elevation chart rendered from Komoot's elevation data.
 * Optionally shows a dashed horizontal line for the planned workout target elevation.
 */

import React from "react";

interface Props {
  /** Array of [distance_m, elevation_m] pairs */
  data: Array<[number, number]>;
  /** Planned workout target elevation in meters (optional dashed line) */
  plannedElevationM?: number;
  width?: number;
  height?: number;
  className?: string;
}

export function ElevationChart({
  data,
  plannedElevationM,
  width = 300,
  height = 80,
  className = "",
}: Props): React.ReactElement | null {
  if (!data || data.length < 2) return null;

  const padX = 0;
  const padY = 4;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const elevations = data.map(([, e]) => e);
  const distances = data.map(([d]) => d);

  const minElev = Math.min(...elevations);
  const maxElev = Math.max(...elevations);
  const maxDist = Math.max(...distances);

  const elevRange = maxElev - minElev || 1;

  const toX = (d: number) => padX + (d / maxDist) * innerW;
  const toY = (e: number) =>
    padY + innerH - ((e - minElev) / elevRange) * innerH;

  // Build SVG path
  const points = data.map(
    ([d, e]) => `${toX(d).toFixed(1)},${toY(e).toFixed(1)}`,
  );
  const linePath = `M ${points.join(" L ")}`;
  const fillPath = `${linePath} L ${toX(maxDist).toFixed(1)},${(padY + innerH).toFixed(1)} L ${padX},${(padY + innerH).toFixed(1)} Z`;

  // Planned elevation dashed line
  let plannedY: number | null = null;
  if (plannedElevationM !== undefined) {
    const clamped = Math.max(minElev, Math.min(maxElev, plannedElevationM));
    plannedY = toY(clamped);
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      className={className}
      aria-hidden="true"
    >
      {/* Fill gradient */}
      <defs>
        <linearGradient id="elevGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      <path d={fillPath} fill="url(#elevGradient)" />
      <path
        d={linePath}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {plannedY !== null && (
        <line
          x1={padX}
          y1={plannedY}
          x2={padX + innerW}
          y2={plannedY}
          stroke="#f59e0b"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          opacity="0.8"
        />
      )}
    </svg>
  );
}
